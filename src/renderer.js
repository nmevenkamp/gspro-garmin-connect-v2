window.addEventListener('DOMContentLoaded', () => {
    let timeout = false
    let gsProConnected = false
    let port

    let ipOptionsOpen = false

    window.onmessage = (event) => {
        if (event.source === window && event.data === 'main-port') {
            const [_port] = event.ports
            port = _port
            _port.onmessage = (event) => {
                handleMessage(event.data)
            }

            const sendTestShotButton = document.querySelector('#send-test-shot')
            const ballSpeedInput = document.querySelector('#ball-speed')
            const spinAxisInput = document.querySelector('#spin-axis')
            const vlaInput = document.querySelector('#vla')
            const spinInput = document.querySelector('#spin')
            const hlaInput = document.querySelector('#hla')
            const carryInput = document.querySelector('#carry')
            const unitsSelect = document.querySelector('#units');

            sendTestShotButton.addEventListener('click', () => {
                if (!gsProConnected) {
                    return
                }
                timeout = true

                port.postMessage({
                    action: 'sendTestShot',
                    units: unitsSelect.value,
                    ballData: {
                        Speed: ballSpeedInput.value,
                        SpinAxis: spinAxisInput.value,
                        TotalSpin: spinInput.value,
                        HLA: hlaInput.value,
                        VLA: vlaInput.value,
                        CarryDistance: carryInput.value,
                    }
                })

                // sendTestShotButton.classList.remove('send-test-shot')
                // sendTestShotButton.classList.add('send-test-shot-disabled')
                // setTimeout(() => {
                //     sendTestShotButton.classList.remove('send-test-shot-disabled')
                //     sendTestShotButton.classList.add('send-test-shot')
                //     timeout = false
                // }, 3000)
            })

            const sendTestStatusButton = document.querySelector('#send-test-status')
            const lmReadyCheckbox = document.querySelector('#lm-ready')
            const ballDetectedCheckbox = document.querySelector('#ball-detected')
            sendTestStatusButton.addEventListener('click', () => {
                if (!gsProConnected) {
                    return
                }

                port.postMessage({
                    action: 'sendTestStatus',
                    units:  unitsSelect.value,
                    lmReady: lmReadyCheckbox.checked,
                    ballDetected: ballDetectedCheckbox.checked,
                })
            })
        }
    }

    function toggleModal() {
        const ipOptionsContainer = document.querySelector('.ip-settings-options-container')

        if (ipOptionsOpen) {
            ipOptionsContainer.style.visibility = 'hidden'
        } else {
            ipOptionsContainer.style.visibility = 'visible'
        }
        ipOptionsOpen = !ipOptionsOpen
    }

    document.querySelector('#ip-settings').addEventListener('click', toggleModal)

    function handleMessage(data) {
        if (data.type) {
            if (data.type === 'garminStatus') {
                updateStatus('garmin', data.status)
            } else if (data.type === 'R10Message') {
                printMessage('R10', data.message, data.level)
            } else if (data.type === 'gsProStatus') {
                updateStatus('gspro', data.status)
            } else if (data.type === 'gsProMessage') {
                printMessage('GSPro', data.message, data.level)
            } else if (data.type === 'gsProShotStatus') {
                updateShotStatus(data.ready)
            } else if (data.type === 'ipOptions') {
                setIPOptions(data.data, true)
            } else if (data.type === 'setIP') {
                setIP(data.data)
            }
        }
    }

    function setIP(ip) {
        const IPText = document.getElementById('ip-address')
        IPText.innerText = ip
        updateIPOptions(ip)
    }

    function updateIPOptions(activeIp) {
        const ipOptionsContainer = document.querySelector('.ip-settings-options-container')

        ipOptionsContainer.querySelectorAll('.ip-option-text').forEach((ipOption) => {
            if (ipOption.innerHTML === activeIp) {
                ipOption.classList.add('ip-option-text-selected')
            } else {
                ipOption.classList.remove('ip-option-text-selected')
            }
        })
    }

    function setIPOptions(ips) {
        const ipOptionsContainer = document.querySelector('.ip-settings-options-container')

        const ipTextNode = ipOptionsContainer.querySelector('.ip-option-text').cloneNode(true)

        ipOptionsContainer.innerHTML = ''

        for (let ip of ips) {
            const ipText = ipTextNode.cloneNode(true)

            ipText.innerHTML = ip
            ipOptionsContainer.append(ipText)
        }

        ipOptionsContainer.addEventListener('click', (e) => {
            port.postMessage({
                type: 'setIP',
                data: e.target.innerHTML,
            })
            toggleModal()
            // ipOptionsOpen = !ipOptionsOpen
        })
    }

    function updateStatus(element, status) {
        if (element === 'gspro') {
            const sendTestShotButton = document.querySelector('#send-test-shot')

            if (status === 'connected') {
                gsProConnected = true
                sendTestShotButton.classList.remove('send-test-shot-disabled')
                sendTestShotButton.classList.add('send-test-shot')
            } else {
                gsProConnected = false
                sendTestShotButton.classList.remove('send-test-shot')
                sendTestShotButton.classList.add('send-test-shot-disabled')
            }
        }
        const COLOR_CLASSES = ['status-color-red', 'status-color-yellow', 'status-color-green']

        const el = document.getElementById(element)
        const statusColor = el.querySelector('.status-icon')
        const statusText = el.querySelector('.status-text-container .status-status')

        statusColor.classList.remove(...COLOR_CLASSES)

        if (status === 'connected') {
            statusColor.classList.add(COLOR_CLASSES[2])
            statusText.innerHTML = 'Connected'
        } else if (status === 'connecting') {
            statusColor.classList.add(COLOR_CLASSES[1])
            statusText.innerHTML = 'Connecting...'
        } else {
            statusColor.classList.add(COLOR_CLASSES[0])
            statusText.innerHTML = 'Disconnected'
        }
    }

    // function onGSProShotReceived() {
    //     const sendTestShotButton = document.querySelector('#send-test-shot')
    //     sendTestShotButton.classList.remove('send-test-shot')
    //     sendTestShotButton.classList.add('send-test-shot-disabled')
    // }
    //
    // function onGSProReady() {
    //     const sendTestShotButton = document.querySelector('#send-test-shot')
    //     sendTestShotButton.classList.remove('send-test-shot-disabled')
    //     sendTestShotButton.classList.add('send-test-shot')
    // }

    function printMessage(system, message, level) {
        const mw = document.querySelector('.messages-window')

        const messageEl = mw.querySelector('.message-text').cloneNode(true)

        if (level === 'error') {
            messageEl.classList.add('message-text-red')
        }
        if (level === 'success') {
            messageEl.classList.add('message-text-green')
        }

        const title = messageEl.querySelectorAll('span')[0]
        const text = messageEl.querySelectorAll('span')[1]

        const date = new Date()

        title.innerHTML = `${system}  🔅  ${date.getHours().toString().padStart(2, '0')}:${date
            .getHours()
            .toString()
            .padStart(2, '0')}>`

        text.innerHTML = message

        mw.append(messageEl)
    }

    function updateShotStatus(ready) {
        const shotReadyText = document.querySelector('.shot-status')
        if (ready) {
            shotReadyText.innerHTML = 'Ready For Shot'

            shotReadyText.classList.remove('message-text-red')
            shotReadyText.classList.add('message-text-green')

            const sendTestShotButton = document.querySelector('#send-test-shot')
            sendTestShotButton.classList.remove('send-test-shot-disabled')
            sendTestShotButton.classList.add('send-test-shot')
        } else {
            shotReadyText.innerHTML = 'Wait ✋'

            shotReadyText.classList.remove('message-text-green')
            shotReadyText.classList.add('message-text-red')

            const sendTestShotButton = document.querySelector('#send-test-shot')
            sendTestShotButton.classList.remove('send-test-shot')
            sendTestShotButton.classList.add('send-test-shot-disabled')
        }
    }
})
