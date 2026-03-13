/**
 * OS & Session Management Service
 * ────────────────────────────────
 * High-level functions that send session / OS-management events to a kiosk via
 * WebSocket.  Each function validates its inputs and logs clearly on failure so
 * the kiosk never receives malformed payloads.
 *
 * Usage:
 *   import { notifyUserConnected, sendDisconnectionWarning, ... } from "./osmgt.service.js";
 *   notifyUserConnected(kioskId, { userName: "Alice" });
 */

import { sendToKiosk } from "../handlers/kiosk.handler.js";
import { kioskSockets } from "../../state/runtimeStore.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _kioskExists(kioskId, caller) {
    if (!kioskId) {
        console.error(`[${caller}] ❌ Validation failed: kioskId is required.`);
        return false;
    }
    if (!kioskSockets[kioskId]) {
        console.error(`[${caller}] ❌ Kiosk "${kioskId}" not found in runtime store.`);
        return false;
    }
    return true;
}

function _required(value, fieldName, caller) {
    if (value === undefined || value === null || value === "") {
        console.error(`[${caller}] ❌ Validation failed: "${fieldName}" is required.`);
        return false;
    }
    return true;
}

// ─── Notify User Connected ───────────────────────────────────────────────────

/**
 * Inform the kiosk that a user has connected successfully.
 * Kiosk will display a thank-you message and hide the QR code.
 *
 * @param {string}  kioskId
 * @param {object}  options
 * @param {string}  [options.userName="Customer"] – display name for greeting
 * @returns {boolean}
 */
export function notifyUserConnected(kioskId, options = {}) {
    const tag = "notifyUserConnected";
    if (!_kioskExists(kioskId, tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "connected-to-user-successfully", {
        userName: options.userName ?? "Customer",
    });
    return true;
}

// ─── Send Status Message ──────────────────────────────────────────────────────

/**
 * Push a general status message to the kiosk UI.
 *
 * @param {string}  kioskId
 * @param {string}  message – human-readable status text
 * @returns {boolean}
 */
export function sendStatusMessage(kioskId, message) {
    const tag = "sendStatusMessage";
    if (!_kioskExists(kioskId, tag)) return false;
    if (!_required(message, "message", tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "status-user-connected-to-kiosk", {
        msg: message,
    });
    return true;
}

// ─── Send Disconnection Warning ──────────────────────────────────────────────

/**
 * Warn the kiosk that the user is about to be disconnected due to inactivity.
 * The kiosk will display a countdown.
 *
 * @param {string}  kioskId
 * @param {object}  options
 * @param {string}  options.message         – warning text shown on kiosk
 * @param {boolean} [options.isActive=true] – whether the warning is active
 * @param {number}  [options.timeoutPeriod=30] – countdown in seconds
 * @returns {boolean}
 */
export function sendDisconnectionWarning(kioskId, options = {}) {
    const tag = "sendDisconnectionWarning";
    if (!_kioskExists(kioskId, tag)) return false;
    if (!_required(options.message, "message", tag)) return false;

    const timeoutPeriod = Number(options.timeoutPeriod) || 30;
    if (timeoutPeriod < 1 || timeoutPeriod > 300) {
        console.error(`[${tag}] ❌ Validation failed: "timeoutPeriod" must be 1-300 seconds. Got ${timeoutPeriod}`);
        return false;
    }

    sendToKiosk(kioskSockets, kioskId, "user-disconnection-warning", {
        msg: options.message,
        isActive: options.isActive ?? true,
        timeout_period: String(timeoutPeriod),
    });
    return true;
}

// ─── Disconnect User ─────────────────────────────────────────────────────────

/**
 * Notify the kiosk that the user has been fully disconnected.
 * Kiosk will reset its UI and session state.
 *
 * @param {string}  kioskId
 * @param {object}  [options]
 * @param {string}  [options.reason="User disconnected"]
 * @returns {boolean}
 */
export function disconnectUser(kioskId, options = {}) {
    const tag = "disconnectUser";
    if (!_kioskExists(kioskId, tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "user-disconnected", {
        reason: options.reason ?? "User disconnected",
    });
    return true;
}

// ─── Set Session Reference ID ─────────────────────────────────────────────────

/**
 * Push a new user-session reference ID to the kiosk so it can display a fresh QR
 * code linking to the new session.
 *
 * @param {string}  kioskId
 * @param {string}  userSessionUUID – the unique session id
 * @param {boolean} [serverStatus=true]
 * @returns {boolean}
 */
export function setSessionReferenceId(kioskId, userSessionUUID, serverStatus = true) {
    const tag = "setSessionReferenceId";
    if (!_kioskExists(kioskId, tag)) return false;
    if (!_required(userSessionUUID, "userSessionUUID", tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "setting-reference-id-for-user-identification", {
        userSessionUUID,
        serverStatus,
    });
    return true;
}

// ─── Send File Acknowledgement ────────────────────────────────────────────────

/**
 * Acknowledge to the kiosk that the server is aware the file has been sent.
 * The kiosk uses this to start the print workflow.
 *
 * @param {string}  kioskId
 * @param {object}  options
 * @param {string}  options.fileName  – name of file that was sent
 * @param {string}  options.sessionId – user session id
 * @returns {boolean}
 */
export function sendFileAcknowledgement(kioskId, options = {}) {
    const tag = "sendFileAcknowledgement";
    if (!_kioskExists(kioskId, tag)) return false;
    if (!_required(options.fileName, "fileName", tag)) return false;
    if (!_required(options.sessionId, "sessionId", tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "ack-after-file-sent", {
        fileName: options.fileName,
        sessionId: options.sessionId,
        kioskId,
    });
    return true;
}

// ─── Send File Metadata ──────────────────────────────────────────────────────

/**
 * Send file metadata to the kiosk before streaming binary chunks.
 * The kiosk uses this to prepare a write stream for the incoming file.
 *
 * @param {string}  kioskId
 * @param {object}  options
 * @param {string}  options.userName
 * @param {string}  options.fileName
 * @param {number}  options.fileSize    – total file size in bytes
 * @param {number}  options.totalChunks – number of binary chunks to expect
 * @param {string}  options.sessionId   – user session id
 * @param {string}  [options.mail]      – user's email (optional)
 * @returns {boolean}
 */
export function sendFileMetadata(kioskId, options = {}) {
    const tag = "sendFileMetadata";
    if (!_kioskExists(kioskId, tag)) return false;
    if (!_required(options.userName, "userName", tag)) return false;
    if (!_required(options.fileName, "fileName", tag)) return false;
    if (!_required(options.fileSize, "fileSize", tag)) return false;
    if (!_required(options.totalChunks, "totalChunks", tag)) return false;
    if (!_required(options.sessionId, "sessionId", tag)) return false;

    if (typeof options.fileSize !== "number" || options.fileSize <= 0) {
        console.error(`[${tag}] ❌ Validation failed: "fileSize" must be a positive number.`);
        return false;
    }
    if (typeof options.totalChunks !== "number" || options.totalChunks < 1) {
        console.error(`[${tag}] ❌ Validation failed: "totalChunks" must be >= 1.`);
        return false;
    }

    sendToKiosk(kioskSockets, kioskId, "metadata-before-file-sending", {
        userName: options.userName,
        fileName: options.fileName,
        fileSize: options.fileSize,
        totalChunks: options.totalChunks,
        sessionId: options.sessionId,
        mail: options.mail ?? null,
    });
    return true;
}
