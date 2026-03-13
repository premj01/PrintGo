/**

 * Re-exports every service function so consumers can import from a single path:
 *   import { printFile, getPrinterStatus, startKiosk, openTerminal } from "../ws/services/index.js";
 */

// ── Printer Services ──────────────────────────────────────────────────────────
export {
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
} from "./printer.service.js";

// ── OS & Session Management Services ──────────────────────────────────────────
export {
    notifyUserConnected,
    sendStatusMessage,
    sendDisconnectionWarning,
    disconnectUser,
    setSessionReferenceId,
    sendFileAcknowledgement,
    sendFileMetadata,
} from "./osmgt.service.js";

// ── Agent Services ────────────────────────────────────────────────────────────
export {
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
} from "./agent.service.js";
