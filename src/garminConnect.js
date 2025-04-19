const net = require('net');
const { localIP, localIPs } = require('./helpers/helpers');
const SimMessages = require('./helpers/simMessages');
const ENV = require('./env');

const HEARTBEAT_INTERVAL = 10000; // 10 seconds

class GarminConnect {
    constructor(ipcPort, gsProConnect) {
        this.server = net.createServer();
        this.client = null;
        this.units = "Yards";
        this.ready = false;
        this.ballDetected = false;
        this.ballData = {};
        this.clubData = {};
        this.clubType = '7Iron';
        this.ipcPort = ipcPort;
        this.gsProConnect = gsProConnect;
        this.localIP = localIP;
        this.pingTimeout = false;
        this.intervalID = null; //heatbeat ID
        this.gsProShotReceived = false;
        this.launchTimeoutID = null;

        ipcPort.on('message', (event) => {
            if (event.data && event.data.action === 'sendTestShot') {
                this.setUnits(event.data.units);
                this.ballData = event.data.ballData;
                this.sendTestShot();
            } else if (event.data && event.data.action === 'sendTestStatus') {
                this.setUnits(event.data.units);
                this.setReady(event.data.lmReady);
                this.setBallDetected(event.data.ballDetected);
                this.sendTestStatus();
            } else if (event.data && event.data.type === 'setIP') {
                this.setNewIP(event.data.data);
            }
        });

        this.ipcPort.postMessage({
            type: 'ipOptions',
            data: localIPs,
        });
        this.ipcPort.postMessage({
            type: 'setIP',
            data: this.localIP,
        });

        ipcPort.start();

        this.listen();
    }

    setNewIP(ip) {
        this.ipcPort.postMessage({
            type: 'setIP',
            data: ip,
        });

        this.localIP = ip;

        this.ipcPort.postMessage({
            type: 'R10Message',
            message: `Switching IP to ${ip}`,
        });

        if (this.client) {
            handleDisconnect();
        }
        this.listen();
    }

    listen() {
        if (this.server) {
            this.server.close();
        }
        this.server = net.createServer();

        this.server.on('connection', (conn) => {
            this.handleConnection(conn);
        });

        this.server.on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                this.ipcPort.postMessage({
                    type: 'R10Message',
                    message:
                        'Address already in use.  Do you have this program open in another window?  Retrying...',
                });
            } else {
                console.log('error with garmin server', e);
            }
            setTimeout(() => {
                this.listen();
            }, 5000);
        });

        this.server.listen(ENV.GARMIN_PORT, this.localIP, () => {
            this.ipcPort.postMessage({
                type: 'garminStatus',
                status: 'connecting',
            });
            this.ipcPort.postMessage({
                type: 'R10Message',
                message: 'Waiting for connection from R10...',
            });
        });
    }

    handleIncomingData(data) {
        console.log('incoming message from R10:', data);

        switch (data.Type) {
            case 'Handshake':
                this.client.write(SimMessages.get_handshake_message(1));
                break;
            case 'Challenge':
                this.client.write(SimMessages.get_handshake_message(2));
                break;
            case 'Disconnect':
                this.handleDisconnect();
                break;
            case 'Pong':
                this.handlePong();
                break;
            case 'SetClubType':
                this.updateClubType(data.ClubType);
                break;
            case 'SetBallData':
                this.setBallData(data.BallData);
                break;
            case 'SetClubData':
                this.setClubData(data.ClubData);
                break;
            case 'SendShot':
                this.sendShot();
                break;
            default:
                console.log('unknown type!', data.Type);
        }
    }

    handleDisconnect() {
        this.ready = false;
        this.sendStatus();

        this.client.end();

        if (this.intervalID) {
            clearInterval(this.intervalID);
        }

        this.client = null;
        this.ipcPort.postMessage({
            type: 'garminStatus',
            status: 'disconnected',
        });
        this.ipcPort.postMessage({
            type: 'R10Message',
            message: 'Disconnected from R10...',
            level: 'error',
        });
        this.ipcPort.postMessage({
            type: 'gsProShotStatus',
            ready: false,
        });
    }

    handlePong() {
        this.pingTimeout = false;
        this.ready = true;
        this.sendStatus();
    }

    sendPing() {
        this.pingTimeout = true;

        if (this.client) {
            this.client.write(SimMessages.get_sim_command('Ping'));

            setTimeout(() => {
                if (this.pingTimeout === true) {
                    this.ipcPort.postMessage({
                        type: 'R10Message',
                        message: 'R10 stopped responding...',
                        level: 'error',
                    });
                    if (this.intervalID) {
                        clearInterval(this.intervalID);
                    }
                    this.handleDisconnect();
                    this.listen();
                }
            }, 3000);
        } else {
            this.ipcPort.postMessage({
                type: 'R10Message',
                message: 'R10 client not set...',
                level: 'error',
            });
            if (this.intervalID) {
                clearInterval(this.intervalID);
            }
            this.listen();
        }
    }

    handleConnection(conn) {
        this.ipcPort.postMessage({
            type: 'garminStatus',
            status: 'connected',
        });
        this.ipcPort.postMessage({
            type: 'R10Message',
            message: 'Connected to R10',
            level: 'success',
        });
        this.ipcPort.postMessage({
            type: 'gsProShotStatus',
            ready: true,
        });
        this.client = conn;

        this.client.setEncoding('UTF8');

        if (this.intervalID) {
            clearInterval(this.intervalID);
        }
        this.intervalID = setInterval(() => {
            this.sendPing();
        }, HEARTBEAT_INTERVAL);

        this.client.on('data', (data) => {
            try {
                const dataObj = JSON.parse(data);
                this.handleIncomingData(dataObj);
            } catch (e) {
                console.log('error parsing incoming message', e);
            }
        });

        this.client.on('close', (hadError) => {
            console.log('client connection closed.  Had error: ', hadError);
            if (this.intervalID) {
                clearInterval(this.intervalID);
            }
            this.listen();
        });

        this.client.on('error', (e) => {
            console.log('client connection error', e);
        });
    }

    updateClubType(clubType) {
        this.clubType = clubType;

        this.client.write(SimMessages.get_success_message('SetClubType'));
    }

    setClubType(clubType) {
        this.clubType = clubType;
        this.client.write(SimMessages.get_shot_complete_message(this.clubType));
    }

    sendTestShot() {
        this.sendShot();
    }

    sendTestStatus() {
        this.sendStatus();
    }

    setUnits(units) {
        this.units = units;
    }

    setReady(ready) {
        this.ready = ready;
    }

    setBallDetected(ballDetected) {
        this.ballDetected = ballDetected;
    }

    setBallData(ballData) {
        let spinAxis = Number(ballData.SpinAxis);
        if (spinAxis > 90) {
            spinAxis -= 360;
        }
        spinAxis *= -1;
        this.ballData = {
            Speed: ballData.BallSpeed,
            SpinAxis: spinAxis,
            TotalSpin: ballData.TotalSpin,
            BackSpin: 0.0, // TODO
            SideSpin: 0.0, // TODO
            HLA: ballData.LaunchDirection,
            VLA: ballData.LaunchAngle,
            CarryDistance: 0.0, // TODO
        };

        this.ipcPort.postMessage({
            type: 'gsProShotStatus',
            ready: false,
        });

        this.client.write(SimMessages.get_success_message('SetBallData'));
    }j

    setClubData(clubData) {
        this.clubData = {
            Speed: clubData.ClubHeadSpeed,
            AngleOfAttack: 0.0,
            FaceToTarget: clubData.ClubAngleFace,
            Lie: 0.0,
            Loft: 0.0,
            Path: clubData.ClubAnglePath,
            SpeedAtImpact: clubData.ClubHeadSpeed,
            VerticalFaceImpact: 0.0,
            HorizontalFaceImpact: 0.0,
            ClosureRate: 0.0,
        };

        this.ipcPort.postMessage({
            type: 'gsProShotStatus',
            ready: false,
        });

        this.client.write(SimMessages.get_success_message('SetClubData'));
    }

    async sendShot() {
        this.gsProShotReceived = false;
        this.ipcPort.postMessage({
            type: 'gsProShotStatus',
            ready: false,
        });
        this.gsProConnect.launchBall(this.units, this.ballData, this.clubData);

        if (this.client) {
            this.client.write(SimMessages.get_success_message('SendShot'));
            setTimeout(() => {
                this.client.write(SimMessages.get_shot_complete_message(this.clubType));
            }, 300);
            setTimeout(() => {
                this.client.write(SimMessages.get_sim_command('Disarm'));
            }, 700);
        }
        this.launchTimeoutID = setTimeout(() => this.handleShotTimeOut(), 3000);
    }

    setShotReceived(shotReceived) {
        this.gsProShotReceived = shotReceived;
        this.ipcPort.postMessage({
            type: 'gsProMessage',
            message: 'GSPro: shot received.',
            level: 'success',
        });
    }

    setShotFinished() {
        if (this.client) {
            this.client.write(SimMessages.get_sim_command('Arm'));
        }

        if (this.launchTimeoutID != null) {
            clearTimeout(this.launchTimeoutID);
            this.launchTimeoutID = null;
        }

        this.ipcPort.postMessage({
            type: 'gsProMessage',
            message: 'GSPro: shot finished.',
            level: 'success',
        });
        this.ipcPort.postMessage({
            type: 'gsProShotStatus',
            ready: true,
        });
    }

    handleShotTimeOut() {
        if (this.gsProShotReceived) {
            return;
        }

        if (this.client) {
            this.client.write(SimMessages.get_sim_command('Arm'));
        }

        this.ipcPort.postMessage({
            type: 'gsProMessage',
            message: 'GSPro failed to receive the shot!',
            level: 'error',
        });
        this.ipcPort.postMessage({
            type: 'gsProShotStatus',
            ready: true,
        });

        this.gsProConnect.handleDisconnect();
        this.ipcPort.postMessage({
            type: 'GSProMessage',
            message: 'Error with GSPro connection.  Trying to reconnect...',
        })
        setTimeout(() => {
            console.log('reconnecting')
            this.gsProConnect.connectSocket()
        }, 1000)
    }

    async sendStatus() {
        this.gsProConnect.sendLaunchMonitorStatus(this.units, this.ready, this.ballDetected);
    }
}

module.exports = GarminConnect;
