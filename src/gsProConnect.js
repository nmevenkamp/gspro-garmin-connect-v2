const net = require('net')
const ENV = require('./env')

const TIMEOUT_MS = 5000

class GsProConnect {
    constructor(ipcPort) {
        this.deviceID = ENV.DEVICE_ID
        this.apiVersion = ENV.API_VERSION
        this.sendClubData = ENV.CLUB_DATA

        this.shotNumber = 1
        this.socket = null
        this.ipcPort = ipcPort

        this.connectSocket()
    }

    connectSocket() {
        this.ipcPort.postMessage({
            type: 'gsProStatus',
            status: 'connecting',
        })
        this.ipcPort.postMessage({
            type: 'gsProMessage',
            message: 'Trying to connect to GSPro...',
        })

        this.socket = net.createConnection({
            address: ENV.IP_ADDRESS,
            port: ENV.PORT,
        })
        this.socket.setTimeout(5000)

        this.socket.on('timeout', () => {
            this.ipcPort.postMessage({
                type: 'GSProMessage',
                message: "Can't connect to GSPro.  Trying again...",
            })
            this.socket.destroy()
            this.connectSocket()
        })

        this.socket.on('connect', () => this.handleConnection())

        this.socket.on('error', (e) => {
            if (e.code === 'ECONNREFUSED') {
                this.ipcPort.postMessage({
                    type: 'R10Message',
                    message:
                        'Connection refused.  Do you have the GSPro Connect window open?  Retrying...',
                })
                setTimeout(() => {
                    this.connectSocket()
                }, TIMEOUT_MS)
            } else {
                console.log('error with gspro socket', e)
                this.handleDisconnect()
                this.ipcPort.postMessage({
                    type: 'GSProMessage',
                    message: 'Error with GSPro connection.  Trying to reconnect...',
                })
                setTimeout(() => {
                    console.log('reconnecting')
                    this.connectSocket()
                }, TIMEOUT_MS)
            }
        })
    }

    handleDisconnect() {
        if (this.socket) {
            this.socket.destroy()

            this.socket = null
            this.ipcPort.postMessage({
                type: 'gsProStatus',
                status: 'disconnected',
            })
            this.ipcPort.postMessage({
                type: 'gsProMessage',
                message: 'Disconnected from GSPro...',
                level: 'error',
            })
            this.ipcPort.postMessage({
                type: 'gsProShotStatus',
                ready: false,
            })
        }
    }

    handleConnection() {
        this.ipcPort.postMessage({
            type: 'gsProStatus',
            status: 'connected',
        })
        this.ipcPort.postMessage({
            type: 'gsProMessage',
            message: 'Connected to GSPro',
            level: 'success',
        })

        this.socket.setEncoding('UTF8')
        this.socket.setTimeout(0)

        this.socket.on('close', (hadError) => {
            console.log('gsPro connection closed.  Had error: ', hadError)
            if (!hadError) {
                this.handleDisconnect()
                setTimeout(() => this.connectSocket(), TIMEOUT_MS)
            }
        })

        this.socket.on('data', (data) => {
            try {
                const dataObj = JSON.parse(data)
                this.handleIncomingData(dataObj);
            } catch (e) {
                console.log('error parsing incoming gsPro message', e)
            }
        })
    }

    handleIncomingData(data) {
        console.log('incoming message from gsPro:', data);

        switch (data.Code) {
            case 200:
                this.ipcPort.postMessage({
                    type: 'gsProShotReceived',
                });
                break;
            case 202:
                this.ipcPort.postMessage({
                    type: 'gsProReady',
                });
                break;
            default:
                console.log('unknown code!', data.Code);
        }
    }

    sendLaunchMonitorStatus(units, lmReady, ballDetected) {
        const APIData = {
            DeviceID: this.deviceID,
            Units: units,
            ShotNumber: this.shotNumber,
            APIversion: this.apiVersion,
            ShotDataOptions: {
                ContainsBallData: false,
                ContainsClubData: false,
                LaunchMonitorIsReady: lmReady,
                LaunchMonitorBallDetected: lmReady && ballDetected,
                IsHeartBeat: false,                                   // not required
            },
        }

        this.socket.write(JSON.stringify(APIData));
    }

    launchBall(units, ballData, clubData) {
        const APIData = {
            DeviceID: this.deviceID,
            Units: units,
            ShotNumber: this.shotNumber,
            APIversion: this.apiVersion,
            BallData: ballData,
            ShotDataOptions: {
                ContainsBallData: true,
                ContainsClubData: false,
                LaunchMonitorIsReady: true, 		// not required
                LaunchMonitorBallDetected: true,    // not required
                IsHeartBeat: false,                 // not required
            },
        }

        if (this.sendClubData) {
            APIData.ShotDataOptions.ContainsClubData = true
            APIData.ClubData = clubData
        }

        this.socket.write(JSON.stringify(APIData))

        this.shotNumber++
    }
}

module.exports = GsProConnect
