class simMessages {
    static get_success_message(type) {
        const message = {
            Details: 'Success.',
            SubType: type,
            Type: 'ACK',
        }
        return JSON.stringify(message)
    }

    static get_sim_command(type) {
        const message = {
            SubType: type,
            Type: 'SimCommand',
        }
        return JSON.stringify(message)
    }

    static get_handshake_message(step) {
        let message
        if (step == 1) {
            message = {
                Challenge: 'gQW3om37uK4OOU4FXQH9GWgljxOrNcL5MvubVHAtQC0x6Z1AwJTgAIKyamJJMzm9',
                E6Version: '2, 0, 0, 0',
                ProtocolVersion: '1.0.0.5',
                RequiredProtocolVersion: '1.0.0.0',
                Type: 'Handshake',
            }
        } else {
            message = {
                Success: 'true',
                Type: 'Authentication',
            }
        }

        return JSON.stringify(message)
    }

    static get_shot_complete_message(clubType) {
        if (clubType == null)
            clubType = '7Iron';

        const message = {
            Details: {
                Apex: 0,
                BallData: {
                    BackSpin: 0,
                    BallSpeed: 0,
                    LaunchAngle: 0,
                    LaunchDirection: 0,
                    SideSpin: 0,
                    SpinAxis: 0,
                    TotalSpin: 0,
                },
                BallInHole: false,
                BallLocation: 'Fairway',
                CarryDeviationAngle: 0,
                CarryDeviationFeet: 0,
                CarryDistance: 0,
                ClubData: {
                    ClubAngleFace: 0,
                    ClubAnglePath: 0,
                    ClubHeadSpeed: 0,
                    ClubHeadSpeedMPH: 0,
                    ClubType: clubType,
                    SmashFactor: 0,
                },
                DistanceToPin: 0,
                TotalDeviationAngle: 0,
                TotalDeviationFeet: 0,
                TotalDistance: 0,
            },
            SubType: 'ShotComplete',
            Type: 'SimCommand',
        }
        return JSON.stringify(message)
    }
}

module.exports = simMessages
