import { kioskSockets, userSessionIdWithKioskId, userTimeouts } from "../../state/runtimeStore.js";
import { verifyToken } from "../../util/jwt.util.js";
import { sendToKioskViaSocket } from "../../ws/handlers/kiosk.handler.js";
import dotenv from "dotenv";
dotenv.config();

const pingPong = async (req, res) => {
    const authHeader = req.headers["authorization"];

    const timeout_period = Number(process.env.USER_SESSION_TIMEOUT) || 20000;
    const warning_grace_period = timeout_period / 2;

    if (!authHeader) {
        return res.status(401).json({ msg: "Unauthorized" });
    }

    try {
        const token = authHeader.split(" ")[1];
        const decodedToken = verifyToken(token);
        const sessionNumber = decodedToken.userSessionNumber;

        const kioskId = userSessionIdWithKioskId[sessionNumber];
        if (!kioskId) {
            return res.status(404).json({ msg: "Please try again with new QR code" });
        }

        const socket = kioskSockets[kioskId]?.kiosk;

        if (userTimeouts[sessionNumber]) {
            clearTimeout(userTimeouts[sessionNumber]);
        }

        userTimeouts[sessionNumber] = setTimeout(() => {
            console.log(`⚠️ User ${sessionNumber} warning triggered.`);

            const currentSocket = kioskSockets[kioskId]?.kiosk;
            if (currentSocket && currentSocket.readyState === currentSocket.OPEN) {
                sendToKioskViaSocket(currentSocket, kioskId, "user-disconnection-warning", {
                    msg: "User disconnection Warning",
                    color: "red",
                    isActive: false,
                    timeout_period: warning_grace_period / 1000
                });
            }

            userTimeouts[sessionNumber] = setTimeout(() => {
                console.log(`🚫 User ${sessionNumber} definitively timed out and deleted.`);

                const finalSocket = kioskSockets[kioskId]?.kiosk;
                if (finalSocket && finalSocket.readyState === finalSocket.OPEN) {
                    sendToKioskViaSocket(finalSocket, kioskId, "user-disconnected", {
                        msg: "Session closed due to inactivity.",
                        isActive: false
                    });
                }

                delete userSessionIdWithKioskId[sessionNumber];
                delete userTimeouts[sessionNumber];

            }, warning_grace_period);

        }, timeout_period);

        if (socket && socket.readyState === socket.OPEN) {
            sendToKioskViaSocket(socket, kioskId, "user-disconnection-warning", {
                msg: "Active",
                color: "white",
                isActive: true,
                timeout_period: warning_grace_period / 1000
            });
        }

        return res.status(200).json({ msg: "pong", alive: true });

    } catch (err) {
        return res.status(401).json({ msg: "Invalid or expired token" });
    }
}

export default pingPong;