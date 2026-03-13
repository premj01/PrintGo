/**
 * Printer Service
 * ───────────────
 * High-level functions that send printer-related events to a kiosk via WebSocket.
 * Each function validates its inputs and logs clearly on failure so the kiosk
 * never receives malformed payloads.
 *
 * Usage:
 *   import { printFile, getPrinterStatus, ... } from "./printer.service.js";
 *   await printFile(kioskId, { fileName: "doc.pdf", sessionId, copies: 2 });
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

// ─── Print File ───────────────────────────────────────────────────────────────

/**
 * Request the kiosk to print an already-transferred file.
 *
 * @param {string}  kioskId
 * @param {object}  options
 * @param {string}  options.fileName      – name of the file on the kiosk
 * @param {string}  options.sessionId     – current user session id
 * @param {number}  [options.copies=1]
 * @param {string}  [options.printer]     – target printer name (null = default)
 * @param {string}  [options.orientation="portrait"]
 * @param {string}  [options.paperSize="A4"]
 * @param {string}  [options.sides="one-sided"]
 * @param {string}  [options.pageRanges]  – e.g. "1-3,5"
 * @param {boolean} [options.fitToPage=true]
 * @param {string}  [options.colorMode="monochrome"]
 * @returns {boolean} true if the event was dispatched
 */
export function printFile(kioskId, options = {}) {
    const tag = "printFile";

    if (!_kioskExists(kioskId, tag)) return false;
    if (!_required(options.fileName, "fileName", tag)) return false;
    if (!_required(options.sessionId, "sessionId", tag)) return false;

    const payload = {
        fileName: options.fileName,
        sessionId: options.sessionId,
        copies: options.copies ?? 1,
        printer: options.printer ?? null,
        orientation: options.orientation ?? "portrait",
        paperSize: options.paperSize ?? "A4",
        sides: options.sides ?? "one-sided",
        pageRanges: options.pageRanges ?? null,
        fitToPage: options.fitToPage ?? true,
        colorMode: options.colorMode ?? "monochrome",
    };

    sendToKiosk(kioskSockets, kioskId, "print-file-request-from-user-via-server", payload);
    return true;
}

// ─── Printer Status ───────────────────────────────────────────────────────────

/**
 * Request the kiosk to report its printer status.
 *
 * @param {string} kioskId
 * @returns {boolean}
 */
export function getPrinterStatus(kioskId) {
    const tag = "getPrinterStatus";
    if (!_kioskExists(kioskId, tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "printer-status-request-from-server", {});
    return true;
}

// ─── Printer List ─────────────────────────────────────────────────────────────

/**
 * Request the list of printers available on the kiosk.
 *
 * @param {string} kioskId
 * @returns {boolean}
 */
export function getPrinterList(kioskId) {
    const tag = "getPrinterList";
    if (!_kioskExists(kioskId, tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "printer-get-list-request-from-server", {});
    return true;
}

// ─── Cancel Printing ──────────────────────────────────────────────────────────

/**
 * Cancel a print job on the kiosk.
 *
 * @param {string}  kioskId
 * @param {object}  [options]
 * @param {string}  [options.printer] – target printer (null = default)
 * @returns {boolean}
 */
export function cancelPrinting(kioskId, options = {}) {
    const tag = "cancelPrinting";
    if (!_kioskExists(kioskId, tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "cancle-printing-request-from-server", {
        printer: options.printer ?? null,
    });
    return true;
}

// ─── Reset Printer Settings ──────────────────────────────────────────────────

/**
 * Reset printer settings on the kiosk.
 *
 * @param {string}  kioskId
 * @param {object}  [options]
 * @param {string}  [options.printer]
 * @returns {boolean}
 */
export function resetPrinterSettings(kioskId, options = {}) {
    const tag = "resetPrinterSettings";
    if (!_kioskExists(kioskId, tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "reset-printer-settings-from-server", {
        printer: options.printer ?? null,
    });
    return true;
}

// ─── Get Job Queue ────────────────────────────────────────────────────────────

/**
 * Request the current print job queue from the kiosk.
 *
 * @param {string} kioskId
 * @returns {boolean}
 */
export function getJobQueue(kioskId) {
    const tag = "getJobQueue";
    if (!_kioskExists(kioskId, tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "get-job-queue-request-from-server", {});
    return true;
}

// ─── Set Default Printer ──────────────────────────────────────────────────────

/**
 * Set the default printer on the kiosk.
 *
 * @param {string} kioskId
 * @param {string} printerName – exact printer name
 * @returns {boolean}
 */
export function setDefaultPrinter(kioskId, printerName) {
    const tag = "setDefaultPrinter";
    if (!_kioskExists(kioskId, tag)) return false;
    if (!_required(printerName, "printerName", tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "set-default-printer-request-from-server", {
        printerName,
    });
    return true;
}

// ─── Test Print ───────────────────────────────────────────────────────────────

/**
 * Send a test-print request to the kiosk.
 *
 * @param {string}  kioskId
 * @param {object}  [options]
 * @param {string}  [options.printer]
 * @returns {boolean}
 */
export function testPrint(kioskId, options = {}) {
    const tag = "testPrint";
    if (!_kioskExists(kioskId, tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "test-print-request-from-server", {
        printer: options.printer ?? null,
    });
    return true;
}

// ─── Get Ink Levels ───────────────────────────────────────────────────────────

/**
 * Request ink / toner levels from the kiosk.
 *
 * @param {string}  kioskId
 * @param {object}  [options]
 * @param {string}  [options.printer]
 * @returns {boolean}
 */
export function getInkLevels(kioskId, options = {}) {
    const tag = "getInkLevels";
    if (!_kioskExists(kioskId, tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "ink-levels-request-from-server", {
        printer: options.printer ?? null,
    });
    return true;
}

// ─── Pause Printer ────────────────────────────────────────────────────────────

/**
 * Pause the printer on the kiosk.
 *
 * @param {string}  kioskId
 * @param {object}  [options]
 * @param {string}  [options.printer]
 * @param {string}  [options.reason]
 * @returns {boolean}
 */
export function pausePrinter(kioskId, options = {}) {
    const tag = "pausePrinter";
    if (!_kioskExists(kioskId, tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "pause-printer-request-from-server", {
        printer: options.printer ?? null,
        reason: options.reason ?? "Paused by PrintGo Server",
    });
    return true;
}

// ─── Resume Printer ───────────────────────────────────────────────────────────

/**
 * Resume the printer on the kiosk.
 *
 * @param {string}  kioskId
 * @param {object}  [options]
 * @param {string}  [options.printer]
 * @returns {boolean}
 */
export function resumePrinter(kioskId, options = {}) {
    const tag = "resumePrinter";
    if (!_kioskExists(kioskId, tag)) return false;

    sendToKiosk(kioskSockets, kioskId, "resume-printer-request-from-server", {
        printer: options.printer ?? null,
    });
    return true;
}

// ─── Print History ────────────────────────────────────────────────────────────

/**
 * Request print history from the kiosk.
 *
 * @param {string}  kioskId
 * @param {object}  [options]
 * @param {number}  [options.limit=50]
 * @returns {boolean}
 */
export function getPrintHistory(kioskId, options = {}) {
    const tag = "getPrintHistory";
    if (!_kioskExists(kioskId, tag)) return false;

    const limit = Number(options.limit) || 50;
    if (limit < 1 || limit > 1000) {
        console.error(`[${tag}] ❌ Validation failed: "limit" must be between 1 and 1000. Got ${limit}`);
        return false;
    }

    sendToKiosk(kioskSockets, kioskId, "print-history-request-from-server", {
        limit,
    });
    return true;
}
