/**
 * Admin WebSocket Handler
 * ───────────────────────
 * Handles the single admin dashboard connection. Admin can:
 *  - Send printer commands to any kiosk (via printer/osmgt services)
 *  - Send agent commands to any kiosk (via agent service)
 *  - Open live PTY terminal sessions on kiosk machines
 *
 * Connection URL:  ws://host?role=admin
 *
 * Message format:
 *   { type: "command-name", data: { kioskId: "KIOSK001", ... } }
 */

import { kioskSockets, adminSockets, terminalSessions } from "../../state/runtimeStore.js";
import {
    printFile,
    getPrinterStatus,
    getPrinterList,
    cancelPrinting,
    resetPrinterSettings,
    getJobQueue,
    setDefaultPrinter,
    testPrint,
    getInkLevels,
    pausePrinter,
    resumePrinter,
    getPrintHistory,
} from "../services/printer.service.js";
import {
    notifyUserConnected,
    sendStatusMessage,
    sendDisconnectionWarning,
    disconnectUser,
    setSessionReferenceId,
    sendFileAcknowledgement,
    sendFileMetadata,
} from "../services/osmgt.service.js";
import {
    startKiosk,
    stopKiosk,
    restartKiosk,
    getKioskStatus,
    pm2Save,
    getLogs,
    restartSystem,

    updateSystem,
    updateKiosk,
    getSystemInfo,
    listProcesses,
    killProcess,
    executeCommand,
    openTerminal,
    terminalInput,
    terminalResize,
    closeTerminal,
} from "../services/agent.service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function send(ws, type, data = {}) {
    if (ws && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type, data }));
    }
}

function requireField(field, name, ws, responseType) {
    if (field === undefined || field === null || field === "") {
        send(ws, responseType, {
            success: false,
            message: `"${name}" is required`,
        });
        return false;
    }
    return true;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export function handleAdminConnection(ws, adminSessionId) {
    console.log(`🛡️  Admin connected: ${adminSessionId}`);

    // Send list of connected kiosks on connect
    const getKiosks = () => Object.keys(kioskSockets).map((id) => ({
        kioskId: id,
        kioskConnected: !!kioskSockets[id]?.kiosk,
        agentConnected: !!kioskSockets[id]?.agent,
        userSessionUUID: kioskSockets[id]?.userSessionUUID ?? null,
        agentMeta: kioskSockets[id]?.agentMeta ?? null,
        status: kioskSockets[id]?.status ?? "unknown",
        lockedBy: kioskSockets[id]?.lockedByAdmin ? (adminSockets[kioskSockets[id].lockedByAdmin]?.adminInfo?.username || "Another Admin") : null
    }));

    send(ws, "admin-connected", {
        kiosks: getKiosks(),
        message: "Connected to PrintGo Admin",
    });

    ws.on("message", (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            send(ws, "error", { message: "Invalid JSON" });
            return;
        }

        const { type, data } = msg;

        if (!type) {
            send(ws, "error", { message: "Missing message type" });
            return;
        }

        const kioskId = data?.kioskId;

        switch (type) {

            // ══════════════════════════════════════════════════════════════
            // ── Info ──────────────────────────────────────────────────────
            // ══════════════════════════════════════════════════════════════

            case "get-kiosk-list": {
                const list = Object.keys(kioskSockets).map((id) => ({
                    kioskId: id,
                    kioskConnected: !!kioskSockets[id]?.kiosk,
                    agentConnected: !!kioskSockets[id]?.agent,
                    userSessionUUID: kioskSockets[id]?.userSessionUUID ?? null,
                    agentMeta: kioskSockets[id]?.agentMeta ?? null,
                    status: kioskSockets[id]?.status ?? "unknown",
                    lastSeen: kioskSockets[id]?.lastSeen ?? null,
                    metrics: kioskSockets[id]?.metrics ?? null,
                    lockedBy: kioskSockets[id]?.lockedByAdmin ? (adminSockets[kioskSockets[id].lockedByAdmin]?.adminInfo?.username || "Another Admin") : null
                }));
                send(ws, "kiosk-list", { kiosks: list });
                break;
            }

            // ══════════════════════════════════════════════════════════════
            // ── Request Aliases (Frontend sends -request suffix) ─────────
            // ══════════════════════════════════════════════════════════════

            case "restart-kiosk-request": {
                if (!requireField(kioskId, "kioskId", ws, "restart-kiosk-result")) break;
                send(ws, "restart-kiosk-result", { dispatched: restartKiosk(kioskId), kioskId });
                break;
            }

            case "get-printers-request": {
                if (!requireField(kioskId, "kioskId", ws, "printer-list-result")) break;
                send(ws, "printer-list-result", { dispatched: getPrinterList(kioskId), kioskId });
                break;
            }

            case "test-print-request": {
                if (!requireField(kioskId, "kioskId", ws, "test-print-result")) break;
                send(ws, "test-print-result", { dispatched: testPrint(kioskId, { printer: data.printer }), kioskId });
                break;
            }

            case "open-terminal-request": {
                if (!requireField(kioskId, "kioskId", ws, "terminal-error")) break;

                const sessionId = data?.sessionId || `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                // Register terminal session
                terminalSessions[sessionId] = { kioskId };

                const ok = openTerminal(kioskId, {
                    sessionId,
                    cols: data?.cols || 80,
                    rows: data?.rows || 24,
                });

                if (!ok) {
                    delete terminalSessions[sessionId];
                    send(ws, "terminal-error", {
                        sessionId,
                        error: `Agent for kiosk "${kioskId}" is not connected`,
                    });
                } else {
                    send(ws, "terminal-opening", { sessionId, kioskId });
                }
                break;
            }

            case "close-terminal-request": {
                const sessionId = data?.sessionId;
                if (!sessionId) { send(ws, "terminal-error", { error: "sessionId required" }); break; }
                const session = terminalSessions[sessionId];
                if (!session) { send(ws, "terminal-error", { sessionId, error: "Session not found" }); break; }
                closeTerminal(session.kioskId, sessionId);
                break;
            }

            case "start-kiosk-request": {
                if (!requireField(kioskId, "kioskId", ws, "start-kiosk-result")) break;
                send(ws, "start-kiosk-result", { dispatched: startKiosk(kioskId), kioskId });
                break;
            }

            case "stop-kiosk-request": {
                if (!requireField(kioskId, "kioskId", ws, "stop-kiosk-result")) break;
                send(ws, "stop-kiosk-result", { dispatched: stopKiosk(kioskId), kioskId });
                break;
            }

            case "get-kiosk-status-request": {
                if (!requireField(kioskId, "kioskId", ws, "kiosk-status-result")) break;
                send(ws, "kiosk-status-result", { dispatched: getKioskStatus(kioskId), kioskId });
                break;
            }

            case "get-system-info-request": {
                if (!requireField(kioskId, "kioskId", ws, "system-info-result")) break;
                send(ws, "system-info-result", { dispatched: getSystemInfo(kioskId), kioskId });
                break;
            }

            case "get-logs-request": {
                if (!requireField(kioskId, "kioskId", ws, "logs-result")) break;
                send(ws, "logs-result", { dispatched: getLogs(kioskId, { lines: data.lines }), kioskId });
                break;
            }

            case "view-kiosk": {
                if (!requireField(kioskId, "kioskId", ws, "view-kiosk-result")) break;

                // Check if kiosk exists in runtime
                if (!kioskSockets[kioskId]) {
                    send(ws, "view-kiosk-result", { success: false, message: "Kiosk not found in runtime state" });
                    break;
                }

                const currentLock = kioskSockets[kioskId].lockedByAdmin;
                if (currentLock && currentLock !== adminSessionId) {
                    const otherAdmin = adminSockets[currentLock]?.adminInfo?.username || "Another Admin";
                    send(ws, "view-kiosk-result", {
                        success: false,
                        message: `Kiosk is currently being managed by ${otherAdmin}`,
                        lockedBy: otherAdmin
                    });
                    break;
                }

                // Exclusive lock
                kioskSockets[kioskId].lockedByAdmin = adminSessionId;
                if (adminSockets[adminSessionId]) {
                    adminSockets[adminSessionId].viewingKioskId = kioskId;
                }

                send(ws, "view-kiosk-result", { success: true, kioskId, message: "Exclusive access granted" });

                // Broadcast update to all admins so they see it's locked
                const updatedList = Object.keys(kioskSockets).map(id => ({
                    kioskId: id,
                    lockedBy: kioskSockets[id].lockedByAdmin ? (adminSockets[kioskSockets[id].lockedByAdmin]?.adminInfo?.username || "Another Admin") : null
                }));
                Object.values(adminSockets).forEach(admin => {
                    if (admin.ws !== ws) send(admin.ws, "kiosk-lock-update", { kiosks: updatedList });
                });
                break;
            }

            case "leave-kiosk": {
                if (adminSockets[adminSessionId]) {
                    const kid = adminSockets[adminSessionId].viewingKioskId;
                    if (kid && kioskSockets[kid] && kioskSockets[kid].lockedByAdmin === adminSessionId) {
                        kioskSockets[kid].lockedByAdmin = null;
                        adminSockets[adminSessionId].viewingKioskId = null;

                        send(ws, "leave-kiosk-result", { success: true, kioskId: kid });

                        // Broadcast update
                        Object.values(adminSockets).forEach(admin => {
                            send(admin.ws, "kiosk-lock-update", {
                                kioskId: kid,
                                lockedBy: null
                            });
                        });
                    }
                }
                break;
            }

            // ══════════════════════════════════════════════════════════════
            // ── Printer Services (→ kiosk app) ───────────────────────────
            // ══════════════════════════════════════════════════════════════

            case "print-file": {
                if (!requireField(kioskId, "kioskId", ws, "print-file-result")) break;
                const ok = printFile(kioskId, {
                    fileName: data.fileName, sessionId: data.sessionId,
                    copies: data.copies, printer: data.printer,
                    orientation: data.orientation, paperSize: data.paperSize,
                    sides: data.sides, pageRanges: data.pageRanges,
                    fitToPage: data.fitToPage, colorMode: data.colorMode,
                });
                send(ws, "print-file-result", { dispatched: ok, kioskId });
                break;
            }

            case "get-printer-status": {
                if (!requireField(kioskId, "kioskId", ws, "printer-status-result")) break;
                send(ws, "printer-status-result", { dispatched: getPrinterStatus(kioskId), kioskId });
                break;
            }

            case "get-printer-list": {
                if (!requireField(kioskId, "kioskId", ws, "printer-list-result")) break;
                send(ws, "printer-list-result", { dispatched: getPrinterList(kioskId), kioskId });
                break;
            }

            case "cancel-printing": {
                if (!requireField(kioskId, "kioskId", ws, "cancel-printing-result")) break;
                send(ws, "cancel-printing-result", { dispatched: cancelPrinting(kioskId, { printer: data.printer }), kioskId });
                break;
            }

            case "reset-printer-settings": {
                if (!requireField(kioskId, "kioskId", ws, "reset-printer-settings-result")) break;
                send(ws, "reset-printer-settings-result", { dispatched: resetPrinterSettings(kioskId, { printer: data.printer }), kioskId });
                break;
            }

            case "get-job-queue": {
                if (!requireField(kioskId, "kioskId", ws, "job-queue-result")) break;
                send(ws, "job-queue-result", { dispatched: getJobQueue(kioskId), kioskId });
                break;
            }

            case "set-default-printer": {
                if (!requireField(kioskId, "kioskId", ws, "set-default-printer-result")) break;
                if (!requireField(data.printerName, "printerName", ws, "set-default-printer-result")) break;
                send(ws, "set-default-printer-result", { dispatched: setDefaultPrinter(kioskId, data.printerName), kioskId });
                break;
            }

            case "test-print": {
                if (!requireField(kioskId, "kioskId", ws, "test-print-result")) break;
                send(ws, "test-print-result", { dispatched: testPrint(kioskId, { printer: data.printer }), kioskId });
                break;
            }

            case "get-ink-levels": {
                if (!requireField(kioskId, "kioskId", ws, "ink-levels-result")) break;
                send(ws, "ink-levels-result", { dispatched: getInkLevels(kioskId, { printer: data.printer }), kioskId });
                break;
            }

            case "pause-printer": {
                if (!requireField(kioskId, "kioskId", ws, "pause-printer-result")) break;
                send(ws, "pause-printer-result", { dispatched: pausePrinter(kioskId, { printer: data.printer, reason: data.reason }), kioskId });
                break;
            }

            case "resume-printer": {
                if (!requireField(kioskId, "kioskId", ws, "resume-printer-result")) break;
                send(ws, "resume-printer-result", { dispatched: resumePrinter(kioskId, { printer: data.printer }), kioskId });
                break;
            }

            case "get-print-history": {
                if (!requireField(kioskId, "kioskId", ws, "print-history-result")) break;
                send(ws, "print-history-result", { dispatched: getPrintHistory(kioskId, { limit: data.limit }), kioskId });
                break;
            }

            // ══════════════════════════════════════════════════════════════
            // ── OS / Session Management (→ kiosk app) ────────────────────
            // ══════════════════════════════════════════════════════════════

            case "notify-user-connected": {
                if (!requireField(kioskId, "kioskId", ws, "notify-user-connected-result")) break;
                send(ws, "notify-user-connected-result", { dispatched: notifyUserConnected(kioskId, { userName: data.userName }), kioskId });
                break;
            }

            case "send-status-message": {
                if (!requireField(kioskId, "kioskId", ws, "send-status-message-result")) break;
                if (!requireField(data.message, "message", ws, "send-status-message-result")) break;
                send(ws, "send-status-message-result", { dispatched: sendStatusMessage(kioskId, data.message), kioskId });
                break;
            }

            case "send-disconnection-warning": {
                if (!requireField(kioskId, "kioskId", ws, "send-disconnection-warning-result")) break;
                send(ws, "send-disconnection-warning-result", {
                    dispatched: sendDisconnectionWarning(kioskId, { message: data.message, isActive: data.isActive, timeoutPeriod: data.timeoutPeriod }),
                    kioskId,
                });
                break;
            }

            case "disconnect-user": {
                if (!requireField(kioskId, "kioskId", ws, "disconnect-user-result")) break;
                send(ws, "disconnect-user-result", { dispatched: disconnectUser(kioskId, { reason: data.reason }), kioskId });
                break;
            }

            case "set-session-reference-id": {
                if (!requireField(kioskId, "kioskId", ws, "set-session-reference-id-result")) break;
                if (!requireField(data.userSessionUUID, "userSessionUUID", ws, "set-session-reference-id-result")) break;
                send(ws, "set-session-reference-id-result", { dispatched: setSessionReferenceId(kioskId, data.userSessionUUID, data.serverStatus), kioskId });
                break;
            }

            case "send-file-acknowledgement": {
                if (!requireField(kioskId, "kioskId", ws, "send-file-acknowledgement-result")) break;
                send(ws, "send-file-acknowledgement-result", { dispatched: sendFileAcknowledgement(kioskId, { fileName: data.fileName, sessionId: data.sessionId }), kioskId });
                break;
            }

            case "send-file-metadata": {
                if (!requireField(kioskId, "kioskId", ws, "send-file-metadata-result")) break;
                send(ws, "send-file-metadata-result", {
                    dispatched: sendFileMetadata(kioskId, { userName: data.userName, fileName: data.fileName, fileSize: data.fileSize, totalChunks: data.totalChunks, sessionId: data.sessionId, mail: data.mail }),
                    kioskId,
                });
                break;
            }

            // ══════════════════════════════════════════════════════════════
            // ── Agent: Kiosk Management (→ agent) ────────────────────────
            // ══════════════════════════════════════════════════════════════

            case "start-kiosk": {
                if (!requireField(kioskId, "kioskId", ws, "start-kiosk-result")) break;
                send(ws, "start-kiosk-result", { dispatched: startKiosk(kioskId), kioskId });
                break;
            }

            case "stop-kiosk": {
                if (!requireField(kioskId, "kioskId", ws, "stop-kiosk-result")) break;
                send(ws, "stop-kiosk-result", { dispatched: stopKiosk(kioskId), kioskId });
                break;
            }

            case "restart-kiosk": {
                if (!requireField(kioskId, "kioskId", ws, "restart-kiosk-result")) break;
                send(ws, "restart-kiosk-result", { dispatched: restartKiosk(kioskId), kioskId });
                break;
            }

            case "get-kiosk-status": {
                if (!requireField(kioskId, "kioskId", ws, "kiosk-status-result")) break;
                send(ws, "kiosk-status-result", { dispatched: getKioskStatus(kioskId), kioskId });
                break;
            }

            case "pm2-save": {
                if (!requireField(kioskId, "kioskId", ws, "pm2-save-result")) break;
                send(ws, "pm2-save-result", { dispatched: pm2Save(kioskId), kioskId });
                break;
            }

            case "get-logs": {
                if (!requireField(kioskId, "kioskId", ws, "logs-result")) break;
                send(ws, "logs-result", { dispatched: getLogs(kioskId, { lines: data.lines }), kioskId });
                break;
            }

            // ══════════════════════════════════════════════════════════════
            // ── Agent: OS Management (→ agent) ───────────────────────────
            // ══════════════════════════════════════════════════════════════

            case "restart-system": {
                if (!requireField(kioskId, "kioskId", ws, "restart-system-result")) break;
                send(ws, "restart-system-result", { dispatched: restartSystem(kioskId), kioskId });
                break;
            }


            case "update-system": {
                if (!requireField(kioskId, "kioskId", ws, "update-system-result")) break;
                send(ws, "update-system-result", { dispatched: updateSystem(kioskId), kioskId });
                break;
            }

            case "update-kiosk": {
                if (!requireField(kioskId, "kioskId", ws, "update-kiosk-result")) break;
                send(ws, "update-kiosk-result", { dispatched: updateKiosk(kioskId), kioskId });
                break;
            }

            // ══════════════════════════════════════════════════════════════
            // ── Agent: System Info (→ agent) ─────────────────────────────
            // ══════════════════════════════════════════════════════════════

            case "get-system-info": {
                if (!requireField(kioskId, "kioskId", ws, "system-info-result")) break;
                send(ws, "system-info-result", { dispatched: getSystemInfo(kioskId), kioskId });
                break;
            }

            case "list-processes": {
                if (!requireField(kioskId, "kioskId", ws, "process-list-result")) break;
                send(ws, "process-list-result", { dispatched: listProcesses(kioskId), kioskId });
                break;
            }

            case "kill-process": {
                if (!requireField(kioskId, "kioskId", ws, "kill-process-result")) break;
                if (!requireField(data.pid, "pid", ws, "kill-process-result")) break;
                send(ws, "kill-process-result", { dispatched: killProcess(kioskId, data.pid), kioskId });
                break;
            }

            // ══════════════════════════════════════════════════════════════
            // ── Agent: Shell Execution (→ agent) ─────────────────────────
            // ══════════════════════════════════════════════════════════════

            case "execute-command": {
                if (!requireField(kioskId, "kioskId", ws, "execute-command-result")) break;
                if (!requireField(data.cmd, "cmd", ws, "execute-command-result")) break;
                send(ws, "execute-command-result", {
                    dispatched: executeCommand(kioskId, {
                        cmd: data.cmd, cwd: data.cwd,
                        timeout: data.timeout, requestId: data.requestId,
                    }),
                    kioskId,
                });
                break;
            }

            // ══════════════════════════════════════════════════════════════
            // ── Agent: Real-time Terminal PTY (→ agent) ──────────────────
            // ══════════════════════════════════════════════════════════════

            case "open-terminal": {
                if (!requireField(kioskId, "kioskId", ws, "terminal-error")) break;

                const sessionId = data?.sessionId || `term-${uuidv4()}`;

                // Register terminal session
                terminalSessions[sessionId] = { kioskId };

                const ok = openTerminal(kioskId, {
                    sessionId,
                    cols: data?.cols,
                    rows: data?.rows,
                });

                if (!ok) {
                    delete terminalSessions[sessionId];
                    send(ws, "terminal-error", {
                        sessionId,
                        error: `Agent for kiosk "${kioskId}" is not connected`,
                    });
                } else {
                    send(ws, "terminal-opening", { sessionId, kioskId });
                }
                break;
            }

            case "terminal-input": {
                const sessionId = data?.sessionId;
                if (!sessionId) { send(ws, "terminal-error", { error: "sessionId required" }); break; }
                const session = terminalSessions[sessionId];
                if (!session) { send(ws, "terminal-error", { sessionId, error: "Session not found" }); break; }
                terminalInput(session.kioskId, sessionId, data.data);
                break;
            }

            case "terminal-resize": {
                const sessionId = data?.sessionId;
                if (!sessionId) break;
                const session = terminalSessions[sessionId];
                if (!session) break;
                terminalResize(session.kioskId, sessionId, data.cols, data.rows);
                break;
            }

            case "close-terminal": {
                const sessionId = data?.sessionId;
                if (!sessionId) break;
                const session = terminalSessions[sessionId];
                if (!session) { send(ws, "terminal-error", { sessionId, error: "Session not found" }); break; }
                closeTerminal(session.kioskId, sessionId);
                break;
            }

            // ══════════════════════════════════════════════════════════════
            // ── Fallback ─────────────────────────────────────────────────
            // ══════════════════════════════════════════════════════════════

            default:
                console.log(`❓ Unknown admin command: ${type}`);
                send(ws, "error", { message: `Unknown command: ${type}` });
        }
    });

    ws.on("close", () => {
        console.log(`🚪 Admin disconnected`);

        // Close any open terminal sessions
        for (const [sessionId, session] of Object.entries(terminalSessions)) {
            console.log(`🖥️  Closing terminal ${sessionId} (admin disconnected)`);
            closeTerminal(session.kioskId, sessionId);
            delete terminalSessions[sessionId];
        }
    });

    ws.on("error", (err) => {
        console.error(`⚠️ Admin socket error:`, err.message);
    });
}