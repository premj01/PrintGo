export const kioskSockets = {};
export const userSessionIdWithKioskId = {};
export const userWithFiles = {};
export const allFiles = [];
export const userTimeouts = {};
export const adminSockets = {}; // { wsId: { ws, connectedAt, adminInfo, viewingKioskId: null } }
// Single admin connection is obsolete, replacing with adminSockets
export const adminState = { ws: null, connectedAt: null }; // Keeping as fallback for now if anything breaks
// { sessionId: { kioskId } }
export const terminalSessions = {};

// { sessionId: { status, kioskId, updatedAt, ...details } }
export const printJobStatusBySession = {};

// { fileKey: { fileKey, sessionId, kioskId, fileName, contentType, size, metadata, status, createdAt, uploadedAt } }
export const s3UploadRecords = {};

// { sessionId: { kioskId, fileKey, fileName, printOptions, createdAt } }
export const pendingS3PrintJobs = {};

// remember only one file will be comming from frontend...all files must contain metadata to remove unused files regulary so we can make it more cleaner approach 