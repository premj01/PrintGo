import { v4 as uuidv4 } from "uuid";
import { userSessionIdWithKioskId, userWithFiles } from "../../state/runtimeStore.js";
import test_file_sending_to_kiosk from "../testfilesend.js";

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
            data: { userSessionUUID: inUseKiosk.userSessionUUID, serverStatus: true },
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
                    const kioskStatus = msg.kioskStatus ?? msg.data?.kioskStatus;
                    const kioskIdFromMsg = msg.kioskid ?? msg.data?.kioskid ?? kioskId;
                    const userRef = msg.userUniqueReferenceId ?? msg.data?.userUniqueReferenceId;
                    console.log(
                        `📄Status from kiosk : unique-user-id-setuped:${kioskStatus}: ${kioskIdFromMsg}: ${userRef}`
                    );
                    break;

                case "reset-user-session-id-kiosk": {

                    console.log("reset-user-id-uuid", msg.msg);
                    const oldId = msg.oldId;
                    const newID = `${uuidv4()}-${Date.now()}`;

                    kioskSockets[kioskId].userSessionUUID = newID;

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
                            data: { userSessionUUID: newID },
                        })
                    );

                    break;
                }

                case "ack-of-file-from-kiosk": {
                    if (userWithFiles[msg.data.sessionId]) {
                        const user = userWithFiles[msg.data.sessionId];
                        if (user) user.isFileOnKiosk = true;

                        console.log("ack-of-file-from-kiosk: file sending success ");
                    } else {
                        console.log("ack-of-file-from-kiosk : userSession Not found ");
                    }
                    break;
                }



                case "testing-file-request-from-kiosk":

                    // ----------temp block start----------
                    setTimeout(() => {
                        test_file_sending_to_kiosk();
                    }, 5000)
                    // ----------temp block end----------
                    break;


                // print document cases receved from kiosk
                case "printing-started":
                    console.log(`printing started : ${msg.status}`);


                    break;
                case "printed-status":  //success , error , halt , waiting etc. 
                    // need to update database for perticular JWT user in database
                    console.log(`Printer status: ${msg.status}`);

                    break;



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
export function sendToKioskViaSocket(kioskSocket, kioskid, type, data = {}) {
    if (kioskSocket && kioskSocket.readyState === kioskSocket.OPEN) {
        kioskSocket.send(JSON.stringify({ type, data }));
        console.log(`📤 Sent "${type}" to kiosk ${kioskid}`);
    } else {
        console.log(`❌ Cannot send "${type}", kiosk not connected ${kioskid}`);
    }
}