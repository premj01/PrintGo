/**
 * Agent Service
 * ─────────────
 * High-level functions that send commands to a kiosk agent via WebSocket.
 * Each function validates inputs and logs on failure.
 *
 * Usage:
 *   import { startKiosk, getSystemInfo } from "./agent.service.js";
 *   startKiosk("KIOSK001");
 */

import { kioskSockets } from "../../state/runtimeStore.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _sendToAgent(kioskId, type, data, caller) {
    if (!kioskId) {
        console.error(`[${caller}] ❌ Validation failed: kioskId is required.`);
        return false;
    }
    const agentSocket = kioskSockets[kioskId]?.agent;
    if (!agentSocket || agentSocket.readyState !== agentSocket.OPEN) {
        console.error(`[${caller}] ❌ Agent for kiosk "${kioskId}" is not connected.`);
        return false;
    }
    agentSocket.send(JSON.stringify({ type, data }));
    console.log(`[${caller}] 📤 Sent "${type}" to agent for kiosk ${kioskId}`);
    return true;
}

function _required(value, fieldName, caller) {
    if (value === undefined || value === null || value === "") {
        console.error(`[${caller}] ❌ Validation failed: "${fieldName}" is required.`);
        return false;
    }
    return true;
}

// ─── Kiosk Management ─────────────────────────────────────────────────────────

/** Start the kiosk app via PM2. */
export function startKiosk(kioskId) {
    return _sendToAgent(kioskId, "start-kiosk-now", {}, "startKiosk");
}

/** Stop the kiosk app via PM2. */
export function stopKiosk(kioskId) {
    return _sendToAgent(kioskId, "stop-kiosk-now", {}, "stopKiosk");
}

/** Restart the kiosk app via PM2. */
export function restartKiosk(kioskId) {
    return _sendToAgent(kioskId, "restart-kiosk-now", {}, "restartKiosk");
}

/** Get PM2 kiosk process status. */
export function getKioskStatus(kioskId) {
    return _sendToAgent(kioskId, "kiosk-status-check", {}, "getKioskStatus");
}

/** Persist the PM2 process list to disk. */
export function pm2Save(kioskId) {
    return _sendToAgent(kioskId, "pm2-save", {}, "pm2Save");
}

/**
 * Fetch PM2 logs from the kiosk.
 * @param {string} kioskId
 * @param {object} [options]
 * @param {number} [options.lines=100]
 */
export function getLogs(kioskId, options = {}) {
    return _sendToAgent(kioskId, "get-logs", {
        lines: options.lines ?? 100,
    }, "getLogs");
}

// ─── OS Management ───────────────────────────────────────────────────────────

/** Reboot the kiosk machine. Socket will disconnect. */
export function restartSystem(kioskId) {
    return _sendToAgent(kioskId, "restart-system-now", {}, "restartSystem");
}


/** Run apt-get update + upgrade on the kiosk. Long-running. */
export function updateSystem(kioskId) {
    return _sendToAgent(kioskId, "update-system-now", {}, "updateSystem");
}

/** Run git pull + npm install + pm2 restart on the kiosk. */
export function updateKiosk(kioskId) {
    return _sendToAgent(kioskId, "update-kiosk-now", {}, "updateKiosk");
}

// ─── System Information ───────────────────────────────────────────────────────

/** Get full system info (CPU, memory, disk, temp, IPs). */
export function getSystemInfo(kioskId) {
    return _sendToAgent(kioskId, "get-system-info", {}, "getSystemInfo");
}

/** List all PM2 processes. */
export function listProcesses(kioskId) {
    return _sendToAgent(kioskId, "list-processes", {}, "listProcesses");
}

/**
 * Kill a process by PID on the kiosk.
 * @param {string} kioskId
 * @param {number} pid
 */
export function killProcess(kioskId, pid) {
    const tag = "killProcess";
    if (!_required(pid, "pid", tag)) return false;
    return _sendToAgent(kioskId, "kill-process", { pid }, tag);
}

// ─── Shell Execution ──────────────────────────────────────────────────────────

/**
 * Execute an arbitrary shell command on the kiosk.
 * @param {string} kioskId
 * @param {object} options
 * @param {string} options.cmd       – Shell command to run
 * @param {string} [options.cwd]     – Working directory
 * @param {number} [options.timeout] – Timeout in ms (default 30000)
 * @param {string} [options.requestId] – Echoed back for correlation
 */
export function executeCommand(kioskId, options = {}) {
    const tag = "executeCommand";
    if (!_required(options.cmd, "cmd", tag)) return false;

    return _sendToAgent(kioskId, "execute-command", {
        cmd: options.cmd,
        cwd: options.cwd ?? undefined,
        timeout: options.timeout ?? 30000,
        requestId: options.requestId ?? undefined,
    }, tag);
}

// ─── Real-time Terminal (PTY) ─────────────────────────────────────────────────

/**
 * Open a new PTY terminal session on the kiosk.
 * @param {string} kioskId
 * @param {object} options
 * @param {string} options.sessionId – Unique session ID
 * @param {number} [options.cols=80]
 * @param {number} [options.rows=24]
 */
export function openTerminal(kioskId, options = {}) {
    const tag = "openTerminal";
    if (!_required(options.sessionId, "sessionId", tag)) return false;

    return _sendToAgent(kioskId, "open-terminal", {
        sessionId: options.sessionId,
        cols: options.cols ?? 80,
        rows: options.rows ?? 24,
    }, tag);
}

/**
 * Send input to a PTY session.
 * @param {string} kioskId
 * @param {string} sessionId
 * @param {string} inputData – Raw input (use \r for Enter, \u0003 for Ctrl+C)
 */
export function terminalInput(kioskId, sessionId, inputData) {
    const tag = "terminalInput";
    if (!_required(sessionId, "sessionId", tag)) return false;
    if (!_required(inputData, "data", tag)) return false;

    return _sendToAgent(kioskId, "terminal-input", {
        sessionId,
        data: inputData,
    }, tag);
}

/**
 * Resize a PTY session.
 * @param {string} kioskId
 * @param {string} sessionId
 * @param {number} cols
 * @param {number} rows
 */
export function terminalResize(kioskId, sessionId, cols, rows) {
    const tag = "terminalResize";
    if (!_required(sessionId, "sessionId", tag)) return false;

    return _sendToAgent(kioskId, "terminal-resize", {
        sessionId,
        cols: cols ?? 80,
        rows: rows ?? 24,
    }, tag);
}

/**
 * Close a PTY session.
 * @param {string} kioskId
 * @param {string} sessionId
 */
export function closeTerminal(kioskId, sessionId) {
    const tag = "closeTerminal";
    if (!_required(sessionId, "sessionId", tag)) return false;

    return _sendToAgent(kioskId, "close-terminal", {
        sessionId,
    }, tag);
}
