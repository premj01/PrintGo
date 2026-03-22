import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import {
    userSessionIdWithKioskId,
    userWithFiles,
    adminSockets,
    printJobStatusBySession,
    pendingS3PrintJobs,
    s3UploadRecords,
} from "../../state/runtimeStore.js";
import Kiosk from "../../models/kiosk.model.js";
import send_file_to_kiosk from "./send_to_kiosk.js";
import prisma from "../../config/prisma.js";

function normalizePrinter(printer) {
    if (typeof printer === "string") {
        return {
            name: printer,
            isDefault: false,
            accepting: true,
            status: "unknown",
            supportsColor: null,
            printMode: "unknown"
        };
    }

    return {
        name: printer?.name || "",
        isDefault: Boolean(printer?.isDefault),
        accepting: printer?.accepting,
        status: printer?.status || "unknown",
        supportsColor: printer?.supportsColor ?? null,
        printMode: printer?.printMode || "unknown"
    };
}

function isColorPrinter(printer) {
    const mode = String(printer?.printMode || "").toLowerCase();
    if (["color", "colour"].includes(mode)) return true;
    if (printer?.supportsColor === true) return true;
    return false;
}

function isBwPrinter(printer) {
    const mode = String(printer?.printMode || "").toLowerCase();
    if (["bw", "b&w", "blackwhite", "mono", "monochrome", "grayscale", "greyscale"].includes(mode)) return true;
    if (printer?.supportsColor === false) return true;
    return false;
}

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

    ws.on("message", async (message) => {
        try {
            const msg = JSON.parse(message.toString());
            const sessionForKiosk = Object.keys(userSessionIdWithKioskId).find(
                (key) => userSessionIdWithKioskId[key] === kioskId
            );
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

                case "download-file-from-s3-ack": {
                    const ackSessionId = msg.data?.sessionId || msg.sessionId;
                    const success = Boolean(msg.data?.success);
                    const fileKey = msg.data?.fileKey || null;
                    const fileName = msg.data?.fileName || null;
                    const error = msg.data?.error || null;

                    if (!ackSessionId) {
                        console.log("download-file-from-s3-ack received without sessionId");
                        break;
                    }

                    Object.values(adminSockets).forEach(admin => {
                        if (admin.ws && admin.ws.readyState === admin.ws.OPEN) {
                            admin.ws.send(JSON.stringify({
                                type: "download-file-from-s3-ack",
                                kioskId,
                                data: msg.data || {},
                            }));
                        }
                    });

                    const pendingJob = pendingS3PrintJobs[ackSessionId];

                    if (!success) {
                        if (pendingJob) {
                            pendingS3PrintJobs[ackSessionId] = {
                                ...pendingJob,
                                downloadStatus: "failed",
                                updatedAt: new Date().toISOString(),
                            };
                        }

                        printJobStatusBySession[ackSessionId] = {
                            status: "kiosk-download-failed",
                            kioskId,
                            fileKey,
                            fileName,
                            error,
                            updatedAt: new Date().toISOString(),
                        };

                        // ── Prisma: UPDATE kioskDownloadStatus → "failed" ──
                        try {
                            await prisma.noAuthUser.updateMany({
                                where: { userSessionNumber: ackSessionId },
                                data: { kioskDownloadStatus: "failed" },
                            });
                            console.log(`⚠️ [Prisma] kioskDownloadStatus → failed for session: ${ackSessionId}`);
                        } catch (dbErr) {
                            console.error(`❌ [Prisma] Failed to update kioskDownloadStatus (fail): ${dbErr.message}`);
                        }

                        break;
                    }

                    if (pendingJob) {
                        pendingS3PrintJobs[ackSessionId] = {
                            ...pendingJob,
                            downloadStatus: "success",
                            downloadedFileName: fileName || pendingJob.fileName,
                            updatedAt: new Date().toISOString(),
                        };
                    }

                    printJobStatusBySession[ackSessionId] = {
                        status: "kiosk-download-success",
                        kioskId,
                        fileKey,
                        fileName,
                        updatedAt: new Date().toISOString(),
                    };

                    // ── Prisma: UPDATE kioskDownloadStatus → "downloaded" ──
                    try {
                        await prisma.noAuthUser.updateMany({
                            where: { userSessionNumber: ackSessionId },
                            data: { kioskDownloadStatus: "downloaded" },
                        });
                        console.log(`✅ [Prisma] kioskDownloadStatus → downloaded for session: ${ackSessionId}`);
                    } catch (dbErr) {
                        console.error(`❌ [Prisma] Failed to update kioskDownloadStatus: ${dbErr.message}`);
                    }

                    const updatedPendingJob = pendingS3PrintJobs[ackSessionId];

                    if (
                        updatedPendingJob &&
                        updatedPendingJob.kioskId === kioskId &&
                        updatedPendingJob.paymentConfirmed
                    ) {
                        const printPayload = {
                            fileName: updatedPendingJob.downloadedFileName || updatedPendingJob.fileName,
                            sessionId: updatedPendingJob.sessionId,
                            copies: updatedPendingJob.printOptions?.copies ?? 1,
                            printer: updatedPendingJob.printOptions?.printer ?? null,
                            orientation: updatedPendingJob.printOptions?.orientation ?? "portrait",
                            paperSize: updatedPendingJob.printOptions?.paperSize ?? "A4",
                            sides: updatedPendingJob.printOptions?.sides ?? "one-sided",
                            pageRanges: updatedPendingJob.printOptions?.pageRanges ?? null,
                            fitToPage: updatedPendingJob.printOptions?.fitToPage ?? true,
                            colorMode: updatedPendingJob.printOptions?.colorMode ?? "monochrome",
                        };

                        sendToKiosk(kioskSockets, kioskId, "print-file-request-from-user-via-server", printPayload);

                        if (updatedPendingJob.fileKey && s3UploadRecords[updatedPendingJob.fileKey]) {
                            s3UploadRecords[updatedPendingJob.fileKey].status = "printing";
                        }

                        printJobStatusBySession[ackSessionId] = {
                            status: "print-requested",
                            kioskId,
                            fileKey: updatedPendingJob.fileKey,
                            fileName: updatedPendingJob.downloadedFileName || updatedPendingJob.fileName,
                            updatedAt: new Date().toISOString(),
                        };

                        delete pendingS3PrintJobs[ackSessionId];
                    } else if (updatedPendingJob && !updatedPendingJob.paymentConfirmed) {
                        printJobStatusBySession[ackSessionId] = {
                            status: "kiosk-file-ready-awaiting-payment",
                            kioskId,
                            fileKey: updatedPendingJob.fileKey,
                            fileName: updatedPendingJob.downloadedFileName || updatedPendingJob.fileName,
                            updatedAt: new Date().toISOString(),
                        };
                    }
                    break;
                }

                case "testing-file-request-from-kiosk":
                    console.log("Testing file request received from kiosk");
                    {
                        const testFilePath = path.join(process.cwd(), "uploads", "cdpr.pdf");
                        const targetKioskSocket = kioskSockets[kioskId]?.kiosk;
                        const activeSessionId =
                            kioskSockets[kioskId]?.userSessionUUID ||
                            sessionForKiosk ||
                            msg.data?.sessionId;

                        if (!targetKioskSocket) {
                            console.log(`❌ Cannot run test send: kiosk socket not connected for ${kioskId}`);
                            break;
                        }

                        if (!activeSessionId) {
                            console.log(`❌ Cannot run test send: no active session UUID for ${kioskId}`);
                            break;
                        }

                        if (!fs.existsSync(testFilePath)) {
                            console.log(`❌ Cannot run test send: file not found at ${testFilePath}`);
                            break;
                        }

                        send_file_to_kiosk({
                            kioskId,
                            kiosk: targetKioskSocket,
                            sessionId: activeSessionId,
                            fileDetails: {
                                userName: "PrintGo Test User",
                                fileName: "cdpr.pdf",
                                mail: null,
                                filePath: testFilePath,
                            },
                        });
                    }
                    break;


                // print document cases receved from kiosk
                case "printing-started":
                    console.log(`printing started : ${msg.status}`);

                    if (sessionForKiosk) {
                        printJobStatusBySession[sessionForKiosk] = {
                            ...(printJobStatusBySession[sessionForKiosk] || {}),
                            status: "printing-started",
                            kioskId,
                            details: msg.data || null,
                            updatedAt: new Date().toISOString(),
                        };
                    }


                    break;
                case "print-file-response-to-server": {
                    const sessionId = msg.sessionId || msg.data?.sessionId || sessionForKiosk;
                    if (sessionId) {
                        const printSuccess = Boolean(msg.success);
                        printJobStatusBySession[sessionId] = {
                            ...(printJobStatusBySession[sessionId] || {}),
                            status: printSuccess ? "print-completed" : "print-failed",
                            kioskId,
                            details: msg,
                            updatedAt: new Date().toISOString(),
                        };

                        // ── Prisma: UPDATE isPrinted flag ──
                        try {
                            await prisma.noAuthUser.updateMany({
                                where: { userSessionNumber: sessionId },
                                data: {
                                    isPrinted: printSuccess,
                                    printStatus: printSuccess ? "success" : "failed",
                                    printedAt: printSuccess ? new Date() : null,
                                },
                            });
                            console.log(`✅ [Prisma] isPrinted → ${printSuccess}, printStatus → ${printSuccess ? "success" : "failed"} for session: ${sessionId}`);
                        } catch (dbErr) {
                            console.error(`❌ [Prisma] Failed to update isPrinted: ${dbErr.message}`);
                        }
                    }
                    break;
                }
                case "printer-status-response-to-server": {
                    if (sessionForKiosk) {
                        printJobStatusBySession[sessionForKiosk] = {
                            ...(printJobStatusBySession[sessionForKiosk] || {}),
                            status: "printer-status",
                            kioskId,
                            printer: msg.data || msg,
                            updatedAt: new Date().toISOString(),
                        };
                    }
                    break;
                }
                case "printed-status":  //success , error , halt , waiting etc. 
                    console.log(`Printer status from ${kioskId}: ${msg.status}`);

                    if (sessionForKiosk) {
                        printJobStatusBySession[sessionForKiosk] = {
                            ...(printJobStatusBySession[sessionForKiosk] || {}),
                            status: msg.status || "printed-status",
                            kioskId,
                            details: msg.data || null,
                            updatedAt: new Date().toISOString(),
                        };
                    }

                    if (msg.status === "success") {
                        const price = msg.data?.price || 0;
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

                        // ── Prisma: UPDATE isPrinted → true on printed-status success ──
                        if (sessionForKiosk) {
                            try {
                                await prisma.noAuthUser.updateMany({
                                    where: { userSessionNumber: sessionForKiosk },
                                    data: {
                                        isPrinted: true,
                                        printStatus: "success",
                                        printedAt: new Date(),
                                    },
                                });
                                console.log(`✅ [Prisma] isPrinted → true (printed-status success) for session: ${sessionForKiosk}`);
                            } catch (dbErr) {
                                console.error(`❌ [Prisma] isPrinted update failed (printed-status): ${dbErr.message}`);
                            }
                        }
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
                    const normalizedPrinters = printers.map(normalizePrinter).filter((p) => p.name);
                    const colorPrinters = normalizedPrinters.filter(isColorPrinter);
                    const bwPrinters = normalizedPrinters.filter(isBwPrinter);
                    const unknownPrinters = normalizedPrinters.filter((p) => !isColorPrinter(p) && !isBwPrinter(p));

                    // Build update object with categorized printers
                    const printersUpdate = {};

                    // Store available printers for selection (keep as arrays for UI to display)
                    printersUpdate["printers.availableList"] = normalizedPrinters.map((p) => ({
                        name: p.name,
                        isDefault: p.isDefault,
                        accepting: p.accepting,
                        status: p.status,
                        supportsColor: p.supportsColor,
                        printMode: p.printMode
                    }));

                    const defaultPrinter = normalizedPrinters.find((p) => p.isDefault);
                    const selectedBw = bwPrinters.find((p) => p.isDefault) || defaultPrinter || bwPrinters[0] || normalizedPrinters[0];
                    const selectedColor = colorPrinters.find((p) => p.isDefault) || defaultPrinter || colorPrinters[0] || normalizedPrinters[0];

                    if (selectedBw) {
                        printersUpdate["printers.bw.name"] = selectedBw.name;
                        printersUpdate["printers.bw.model"] = selectedBw.name;
                        printersUpdate["printers.bw.status"] = selectedBw.status || "unknown";
                    }

                    if (selectedColor) {
                        printersUpdate["printers.color.name"] = selectedColor.name;
                        printersUpdate["printers.color.model"] = selectedColor.name;
                        printersUpdate["printers.color.status"] = selectedColor.status || "unknown";
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
                                    printers: normalizedPrinters,
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