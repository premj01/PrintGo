/**
 * Agent WebSocket Handler
 * ───────────────────────
 * Handles agent connections from kiosk machines. The agent sends heartbeats,
 * command results, system info, and terminal output. This handler logs
 * everything, updates runtime state, and forwards relevant events to the
 * connected admin dashboard.
 */

import { kioskSockets, adminSockets, terminalSessions } from "../../state/runtimeStore.js";
import Kiosk from "../../models/kiosk.model.js";

function normalizePrinter(printer) {
    if (typeof printer === "string") {
        return {
            name: printer,
            isDefault: false,
            status: "unknown",
            supportsColor: null,
            printMode: "unknown"
        };
    }

    return {
        name: printer?.name || "",
        isDefault: Boolean(printer?.isDefault),
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

function buildPrinterDefaultsUpdate(printers) {
    const normalized = printers.map(normalizePrinter).filter((p) => p.name);
    if (normalized.length === 0) return {};

    const colorPrinters = normalized.filter(isColorPrinter);
    const bwPrinters = normalized.filter(isBwPrinter);
    const defaultPrinter = normalized.find((p) => p.isDefault);

    const selectedBw = bwPrinters.find((p) => p.isDefault) || defaultPrinter || bwPrinters[0] || normalized[0];
    const selectedColor = colorPrinters.find((p) => p.isDefault) || defaultPrinter || colorPrinters[0] || normalized[0];

    const update = { "printers.availableList": normalized };
    if (selectedBw) {
        update["printers.bw.name"] = selectedBw.name;
        update["printers.bw.model"] = selectedBw.name;
        update["printers.bw.status"] = selectedBw.status || "unknown";
    }
    if (selectedColor) {
        update["printers.color.name"] = selectedColor.name;
        update["printers.color.model"] = selectedColor.name;
        update["printers.color.status"] = selectedColor.status || "unknown";
    }
    return update;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Send typed JSON to all connected admin dashboards. */
function sendToAdmin(type, data = {}) {
    Object.values(adminSockets).forEach(admin => {
        const ws = admin.ws;
        if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type, data }));
        }
    });
}

/** Forward a terminal event to the admin. */
function forwardTerminalEvent(sessionId, type, data) {
    if (!terminalSessions[sessionId]) return;
    sendToAdmin(type, data);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export function handleAgentConnection(ws, kioskId, sockets) {
    console.log(`🧠 Agent connected for kiosk: ${kioskId}`);

    ws.on("message", (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            console.warn(`⚠️ Unparseable message from agent ${kioskId}:`, raw.toString().slice(0, 120));
            return;
        }

        const { type, data } = msg;

        switch (type) {

            // ── Connection lifecycle ──────────────────────────────────────

            case "agent-ready": {
                console.log(`✅ Agent ready for kiosk ${kioskId}:`, data?.kioskName);

                if (kioskSockets[kioskId]) {
                    kioskSockets[kioskId].agentMeta = {
                        kioskName: data?.kioskName ?? kioskId,
                        hostname: data?.hostname ?? null,
                        platform: data?.platform ?? null,
                        arch: data?.arch ?? null,
                        capabilities: data?.capabilities ?? [],
                        readyAt: data?.timestamp ?? new Date().toISOString(),
                    };
                    kioskSockets[kioskId].status = "online";
                    kioskSockets[kioskId].lastSeen = new Date().toISOString();
                }

                // Update MongoDB with machine details
                Kiosk.findOneAndUpdate(
                    { kioskId },
                    {
                        $set: {
                            "machineDetails.hostname": data?.hostname,
                            "machineDetails.platform": data?.platform,
                            "machineDetails.arch": data?.arch,
                            "machineDetails.capabilities": data?.capabilities,
                            "machineDetails.ipAddress": ws._socket?.remoteAddress,
                            "machineDetails.status": "online",
                        }
                    }
                ).catch(err => console.error(`❌ Agent DB Update Error (Ready):`, err.message));

                sendToAdmin("agent-ready", { kioskId, ...data });
                break;
            }

            case "agent-heartbeat": {
                if (kioskSockets[kioskId]) {
                    kioskSockets[kioskId].lastSeen = data?.timestamp ?? new Date().toISOString();
                    kioskSockets[kioskId].metrics = {
                        freeMemory: data?.freeMemory,
                        uptime: data?.uptime,
                        loadAvg: data?.loadAvg,
                    };
                }

                // Update MongoDB lastSeenAt
                Kiosk.findOneAndUpdate(
                    { kioskId },
                    { $set: { "machineDetails.lastSeenAt": new Date(), "machineDetails.status": "online" } }
                ).catch(err => console.error(`❌ Agent DB Update Error (Heartbeat):`, err.message));
                sendToAdmin("agent-heartbeat", { kioskId, ...data });
                break;
            }

            // ── Command results ───────────────────────────────────────────

            case "kiosk-command-result": {
                console.log(`📦 Command result from ${kioskId}: ${data?.command}`, data?.success ? "✅" : "❌");
                sendToAdmin("kiosk-command-result", { kioskId, ...data });
                break;
            }

            case "kiosk-status-result": {
                console.log(`📊 Kiosk status from ${kioskId}:`, data?.success ? "✅" : "❌");

                // If the agent sends back printer information or hardware specs, update DB:
                if (data?.printers) {
                    const printersUpdate = Array.isArray(data.printers)
                        ? buildPrinterDefaultsUpdate(data.printers)
                        : {};
                    if (Object.keys(printersUpdate).length > 0) {
                        Kiosk.findOneAndUpdate({ kioskId }, { $set: printersUpdate }).catch(err => console.error("DB Error:", err));
                    }
                }

                sendToAdmin("kiosk-status-result", { kioskId, ...data });
                break;
            }

            case "printer-list-result": {
                console.log(`🖨️ Printer list from ${kioskId}`);
                if (data?.printers && Array.isArray(data.printers)) {
                    const printersUpdate = buildPrinterDefaultsUpdate(data.printers);
                    if (Object.keys(printersUpdate).length > 0) {
                        Kiosk.findOneAndUpdate({ kioskId }, { $set: printersUpdate }).catch(console.error);
                    }
                }
                sendToAdmin("printer-list-result", { kioskId, ...data });
                break;
            }

            case "system-info-result": {
                console.log(`ℹ️  System info from ${kioskId}`);
                if (data?.os || data?.platform) {
                    Kiosk.findOneAndUpdate(
                        { kioskId },
                        {
                            $set: {
                                "machineDetails.platform": data.platform || data.os?.platform,
                                "machineDetails.arch": data.arch || data.os?.arch,
                                "machineDetails.hostname": data.hostname || data.os?.hostname
                            }
                        }
                    ).catch(console.error);
                }
                sendToAdmin("system-info-result", { kioskId, ...data });
                break;
            }

            case "process-list-result": {
                console.log(`📋 Process list from ${kioskId}`);
                sendToAdmin("process-list-result", { kioskId, ...data });
                break;
            }

            case "logs-result": {
                console.log(`📜 Logs from ${kioskId}`);
                sendToAdmin("logs-result", { kioskId, ...data });
                break;
            }

            case "execute-command-result": {
                console.log(`💻 Command exec result from ${kioskId}:`, data?.success ? "✅" : "❌");
                sendToAdmin("execute-command-result", { kioskId, ...data });
                break;
            }

            // ── Terminal (PTY) events ─────────────────────────────────────

            case "terminal-opened": {
                const sessionId = data?.sessionId;
                console.log(`🖥️  Terminal opened on ${kioskId}: ${sessionId}`);
                if (terminalSessions[sessionId]) {
                    terminalSessions[sessionId].active = true;
                }
                forwardTerminalEvent(sessionId, "terminal-opened", { kioskId, ...data });
                break;
            }

            case "terminal-output": {
                forwardTerminalEvent(data?.sessionId, "terminal-output", data);
                break;
            }

            case "terminal-closed": {
                const sessionId = data?.sessionId;
                console.log(`🖥️  Terminal closed on ${kioskId}: ${sessionId}`);
                forwardTerminalEvent(sessionId, "terminal-closed", { kioskId, ...data });
                delete terminalSessions[sessionId];
                break;
            }

            case "terminal-error": {
                const sessionId = data?.sessionId;
                console.error(`⚠️ Terminal error on ${kioskId}: ${data?.error}`);
                forwardTerminalEvent(sessionId, "terminal-error", { kioskId, ...data });
                if (sessionId) delete terminalSessions[sessionId];
                break;
            }

            // ── Fallback ──────────────────────────────────────────────────

            default:
                console.log(`❓ Unknown message type from agent ${kioskId}:`, type);
                sendToAdmin("agent-unknown-event", { kioskId, type, data });
        }
    });

    ws.on("close", () => {
        console.log(`🚪 Agent disconnected for kiosk: ${kioskId}`);

        if (kioskSockets[kioskId]) {
            kioskSockets[kioskId].status = "offline";
        }

        // Set offline in MongoDB
        Kiosk.findOneAndUpdate(
            { kioskId },
            { $set: { "machineDetails.status": "offline" } }
        ).catch(err => console.error(`❌ Agent DB Update Error (Offline):`, err.message));

        // Cleanup terminal sessions for this kiosk
        for (const [sessionId, session] of Object.entries(terminalSessions)) {
            if (session.kioskId === kioskId) {
                sendToAdmin("terminal-closed", {
                    sessionId,
                    kioskId,
                    reason: "agent-disconnected",
                });
                delete terminalSessions[sessionId];
            }
        }

        sendToAdmin("agent-disconnected", { kioskId });
        delete sockets[kioskId];
    });

    ws.on("error", (err) => {
        console.error(`⚠️ Agent socket error for kiosk ${kioskId}:`, err.message);
    });
}

/**
 * Send a typed message to a specific agent by kioskId.
 */
export function sendToAgent(kioskId, type, data = {}) {
    const agentSocket = kioskSockets[kioskId]?.agent;
    if (agentSocket && agentSocket.readyState === agentSocket.OPEN) {
        agentSocket.send(JSON.stringify({ type, data }));
        console.log(`📤 Sent "${type}" to agent for kiosk ${kioskId}`);
        return true;
    }
    console.log(`❌ Cannot send "${type}", agent for kiosk ${kioskId} not connected`);
    return false;
}
