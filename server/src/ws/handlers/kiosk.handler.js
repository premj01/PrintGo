import { v4 as uuidv4 } from "uuid";
import { userSessionIdWithKioskId, userWithFiles } from "../../state/runtimeStore.js";

export function handleKioskConnection(ws, kioskId, kioskSockets) {
    if (!kioskId || kioskSockets[kioskId] === undefined) {
        ws.send(JSON.stringify({ type: "error", data: "No kiosk id present" }));
        ws.close();
        return;
    }

    const inUseKiosk = kioskSockets[kioskId];
    console.log(`🖥️ Kiosk connected: ${kioskId}`);

    ws.send(
        JSON.stringify({
            type: "setting-reference-id-for-user-identification",
            data: { referenceId: inUseKiosk.referenceId, serverStatus: true },
        })
    );

    ws.on("message", (message) => {
        try {
            const msg = JSON.parse(message.toString());
            switch (msg.type) {
                case "register-kiosk":
                    console.log(`✅ Kiosk ${msg.data.kioskid} registered successfully.`);
                    break;

                case "job-status":
                    console.log(`📄 Status from kiosk ${kioskId}:`, msg.data);
                    break;

                case "unique-user-id-setuped":
                    console.log(
                        `📄Status from kiosk : unique-user-id-setuped:${msg.kioskStatus}: ${msg.kioskid}: ${msg.userUniqueReferenceId}`
                    );
                    break;

                case "reset-user-session-id-kiosk": {
                    console.log("reset-user-id-uuid", msg.msg);
                    const oldId = msg.oldId;
                    const newID = `${uuidv4()}-${Date.now()}`;

                    kioskSockets[kioskId].uuid = newID;

                    if (userSessionIdWithKioskId[oldId] === kioskId) {
                        delete userSessionIdWithKioskId[oldId];
                        userSessionIdWithKioskId[newID] = kioskId;
                    } else {
                        if (Object.values(userSessionIdWithKioskId).includes(kioskId)) {
                            const previousKey = Object.keys(userSessionIdWithKioskId).find(
                                (key) => userSessionIdWithKioskId[key] === kioskId
                            );
                            delete userSessionIdWithKioskId[previousKey];
                        }
                        userSessionIdWithKioskId[newID] = kioskId;
                    }

                    if (userWithFiles[oldId] !== undefined) {
                        delete userWithFiles[oldId];
                    }

                    ws.send(
                        JSON.stringify({
                            type: "setting-reference-id-for-user-identification",
                            data: { referenceId: newID },
                        })
                    );
                    break;
                }

                case "ack-of-file-from-kiosk": {
                    if (msg.data.ack === true) {
                        const user = userWithFiles[msg.data.sessionId];
                        if (user) user.isFileOnKiosk = true;
                    }
                    break;
                }

                default:
                    console.log(`❓ Unknown message type from kiosk ${kioskId}:`, msg);
            }
        } catch (err) {
            console.error(`⚠️ Invalid message format from kiosk ${kioskId}:`, message.toString());
        }
    });

    ws.on("close", () => {
        console.log(`🚪 Kiosk disconnected: ${kioskId}`);
        if (kioskSockets[kioskId]) {
            kioskSockets[kioskId].kiosk = null;
            if (kioskSockets[kioskId].agent) {
                kioskSockets[kioskId].agent.send(
                    JSON.stringify({
                        type: "restart-kiosk-now",
                        data: { msg: `Kiosk ${kioskId} disconnected. Please restart.` },
                    })
                );
            }
        }
    });

    ws.on("error", (err) => {
        console.error(`⚠️ Kiosk socket error for ${kioskId}:`, err.message);
    });
}


//kioskSockets  - all agent + kiosk info
export function sendToKiosk(kioskSockets, kioskId, type, data = {}) {
    const kioskSocket = kioskSockets[kioskId]?.kiosk;
    if (kioskSocket && kioskSocket.readyState === kioskSocket.OPEN) {
        kioskSocket.send(JSON.stringify({ type, data }));
        console.log(`📤 Sent "${type}" to kiosk ${kioskId}`);
    } else {
        console.log(`❌ Cannot send "${type}", kiosk ${kioskId} not connected`);
    }
}
// kioskSocket just a socket object of kiosk
export function sendToKioskViaSocket(kioskSocket, type, data = {}) {
    if (kioskSocket && kioskSocket.readyState === kioskSocket.OPEN) {
        kioskSocket.send(JSON.stringify({ type, data }));
        console.log(`📤 Sent "${type}" to kiosk ${kioskId}`);
    } else {
        console.log(`❌ Cannot send "${type}", kiosk ${kioskId} not connected`);
    }
}
