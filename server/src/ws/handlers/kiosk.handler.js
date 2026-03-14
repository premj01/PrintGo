import { v4 as uuidv4 } from "uuid";
import { userSessionIdWithKioskId, userWithFiles, adminSockets } from "../../state/runtimeStore.js";
import Kiosk from "../../models/kiosk.model.js";

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
                    console.log("Testing file request received from kiosk");
                    break;


                // print document cases receved from kiosk
                case "printing-started":
                    console.log(`printing started : ${msg.status}`);


                    break;
                case "printed-status":  //success , error , halt , waiting etc. 
                    console.log(`Printer status from ${kioskId}: ${msg.status}`);

                    if (msg.status === "success") {
                        const price = msg.data?.price || 0; // The agent could return computed price or we just count it
                        Kiosk.findOneAndUpdate(
                            { kioskId },
                            {
                                $inc: {
                                    "metrics.totalPrintJobs": 1,
                                    "metrics.revenue.total": price,
                                    "metrics.revenue.monthly": price,
                                    "metrics.revenue.daily": price
                                }
                            }
                        ).catch(err => console.error("Error updating print metrics:", err.message));
                    }

                    // Forward to all admins
                    Object.values(adminSockets).forEach(admin => {
                        if (admin.ws && admin.ws.readyState === admin.ws.OPEN) {
                            admin.ws.send(JSON.stringify({ type: "printed-status", kioskId, ...msg }));
                        }
                    });
                    break;

                case "printer-list-result":
                case "printer-get-list-response-to-server":
                case "kiosk-status-result":
                    console.log(`🖨️ Printer/System info received from ${kioskId}`);

                    // Accept both payload styles:
                    // 1) { type, data: { printers: [...] } }
                    // 2) { type, printers: [...] }
                    const printers =
                        (Array.isArray(msg.data?.printers) && msg.data.printers) ||
                        (Array.isArray(msg.printers) && msg.printers) ||
                        [];
                    const colorPrinters = printers;
                    // printers.filter((p) => p.supportsColor === true);
                    const bwPrinters = printers;
                    // printers.filter((p) => p.supportsColor === false);
                    const unknownPrinters = printers;
                    // printers.filter((p) => p.supportsColor == null);

                    // Build update object with categorized printers
                    const printersUpdate = {};

                    // Store available printers for selection (keep as arrays for UI to display)
                    printersUpdate["printers.availableList"] = printers.map((p) => ({
                        name: p.name,
                        isDefault: p.isDefault,
                        accepting: p.accepting,
                        status: p.status,
                        supportsColor: p.supportsColor,
                        printMode: p.printMode
                    }));

                    // Store first available color printer as default color printer
                    if (colorPrinters.length > 0) {
                        const firstColor = colorPrinters[0];
                        printersUpdate["printers.color.name"] = firstColor.name;
                        printersUpdate["printers.color.status"] = firstColor.status || "unknown";
                    }

                    // Store first available BW printer as default BW printer
                    if (bwPrinters.length > 0) {
                        const firstBw = bwPrinters[0];
                        printersUpdate["printers.bw.name"] = firstBw.name;
                        printersUpdate["printers.bw.status"] = firstBw.status || "unknown";
                    }

                    // If no categorized printers found but we have printers, use first two
                    if (printers.length > 0 && colorPrinters.length === 0 && bwPrinters.length === 0) {
                        if (printers[0]) {
                            printersUpdate["printers.bw.name"] = printers[0].name;
                            printersUpdate["printers.bw.status"] = printers[0].status || "unknown";
                        }
                        if (printers[1]) {
                            printersUpdate["printers.color.name"] = printers[1].name;
                            printersUpdate["printers.color.status"] = printers[1].status || "unknown";
                        }
                    }

                    if (Object.keys(printersUpdate).length > 0) {
                        Kiosk.findOneAndUpdate({ kioskId }, { $set: printersUpdate }).catch(err => console.error(err));
                    }

                    // Forward to all admins with categorized data
                    Object.values(adminSockets).forEach(admin => {
                        if (admin.ws && admin.ws.readyState === admin.ws.OPEN) {
                            admin.ws.send(JSON.stringify({
                                // Always forward printer inventory as a single canonical event.
                                type: "printer-list-result",
                                kioskId,
                                data: {
                                    ...msg.data,
                                    printers,
                                    colorPrinters,
                                    bwPrinters,
                                    unknownPrinters
                                }
                            }));
                        }
                    });
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