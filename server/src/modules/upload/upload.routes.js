import express from "express";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { requireUserAuth } from "../../middleware/userAuth.middleware.js";
import {
    userSessionIdWithKioskId,
    printJobStatusBySession,
    s3UploadRecords,
    pendingS3PrintJobs,
} from "../../state/runtimeStore.js";
import { printFile, requestKioskS3Download } from "../../ws/services/printer.service.js";
import { createSignedDownloadUrl, createSignedUploadUrl } from "../../services/s3Storage.service.js";
import { verifyToken } from "../../util/jwt.util.js";
import prisma from "../../config/prisma.js";
import Kiosk from "../../models/kiosk.model.js";

const router = express.Router();
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const UPLOAD_URL_EXPIRES_SECONDS = 600;
const DOWNLOAD_URL_EXPIRES_SECONDS = 300;
const SIGNED_URL_WINDOW_MS = UPLOAD_URL_EXPIRES_SECONDS * 1000;
const uploadUrlRateLimitBySession = {};

function parseJsonField(value, fallback = {}) {
    if (!value) return fallback;
    try {
        return typeof value === "string" ? JSON.parse(value) : value;
    } catch {
        return fallback;
    }
}

function getSessionIdFromAuthHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    try {
        const token = authHeader.split(" ")[1];
        const decoded = verifyToken(token);
        return decoded.userSessionNumber || null;
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /upload-url — Generate S3 signed URL & CREATE Prisma transaction record
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/upload-url", requireUserAuth, async (req, res) => {
    try {
        const sessionId = req.userSessionNumber;
        const kioskId = userSessionIdWithKioskId[sessionId];

        console.log(`\n📥 [upload-url] Request received`);
        console.log(`   ├─ sessionId : ${sessionId}`);
        console.log(`   ├─ kioskId   : ${kioskId}`);

        if (!sessionId) {
            return res.status(401).json({ success: false, message: "Invalid session token" });
        }

        if (!kioskId) {
            return res.status(404).json({ success: false, message: "Kiosk not found for current session" });
        }

        const now = Date.now();
        const lastIssued = uploadUrlRateLimitBySession[sessionId] || 0;
        if (now - lastIssued < 2000) {
            return res.status(429).json({ success: false, message: "Too many upload URL requests. Please retry shortly." });
        }
        uploadUrlRateLimitBySession[sessionId] = now;

        const requestedFileName = String(req.body?.fileName || "merged-printgo.pdf");
        const contentType = String(req.body?.contentType || "application/pdf").toLowerCase();
        const size = Number(req.body?.size || 0);
        const metadata = parseJsonField(req.body?.metadata, {});

        console.log(`   ├─ fileName  : ${requestedFileName}`);
        console.log(`   ├─ type      : ${contentType}`);
        console.log(`   ├─ size      : ${size} bytes`);
        console.log(`   └─ metadata  :`, JSON.stringify(metadata));

        if (contentType !== "application/pdf") {
            return res.status(400).json({ success: false, message: "Only PDF uploads are allowed" });
        }

        if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE_BYTES) {
            return res.status(400).json({ success: false, message: "Invalid file size. Max allowed is 50MB" });
        }

        const safeName = requestedFileName.endsWith(".pdf") ? requestedFileName : `${requestedFileName}.pdf`;
        const fileKey = `uploads/${sessionId}/${uuidv4()}.pdf`;

        const uploadUrl = await createSignedUploadUrl({
            key: fileKey,
            contentType: "application/pdf",
            expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
        });

        // ── In-memory records (existing logic) ──
        s3UploadRecords[fileKey] = {
            fileKey,
            kioskId,
            sessionId,
            fileName: safeName,
            contentType: "application/pdf",
            size,
            metadata,
            status: "url-issued",
            createdAt: new Date().toISOString(),
            uploadedAt: null,
        };

        printJobStatusBySession[sessionId] = {
            status: "upload-url-issued",
            kioskId,
            fileKey,
            fileName: safeName,
            updatedAt: new Date().toISOString(),
        };

        // ── Prisma: CREATE user transaction record ──
        try {
            const dbRecord = await prisma.noAuthUser.create({
                data: {
                    userSessionNumber: sessionId,
                    kioskId: kioskId,
                    fileName: safeName,
                    s3UploadStatus: "pending",
                    kioskDownloadStatus: "pending",
                    paymentStatus: "pending",
                    printStatus: "pending",
                },
            });

            console.log(`\n✅ [Prisma] NoAuthUser CREATED for session: ${sessionId}`);
            console.log(`   ├─ db id               : ${dbRecord.id}`);
            console.log(`   ├─ sessionNumber        : ${dbRecord.userSessionNumber}`);
            console.log(`   ├─ kioskId              : ${dbRecord.kioskId}`);
            console.log(`   ├─ fileName             : ${dbRecord.fileName}`);
            console.log(`   ├─ s3UploadStatus       : ${dbRecord.s3UploadStatus}`);
            console.log(`   ├─ kioskDownloadStatus  : ${dbRecord.kioskDownloadStatus}`);
            console.log(`   └─ createdAt            : ${dbRecord.createdAt}`);
        } catch (dbErr) {
            console.error(`\n❌ [Prisma] Failed to CREATE NoAuthUser for session: ${sessionId}`);
            console.error(`   └─ error: ${dbErr.message}`);
            // Non-blocking: don't fail the upload URL flow for a DB error
        }

        console.log(`\n🔗 [upload-url] Signed URL issued`);
        console.log(`   ├─ fileKey   : ${fileKey}`);
        console.log(`   └─ expiresIn : ${UPLOAD_URL_EXPIRES_SECONDS}s`);

        return res.json({
            success: true,
            uploadUrl,
            fileKey,
            expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
        });
    } catch (err) {
        console.error("Error generating S3 upload URL:", err.message);
        return res.status(500).json({ success: false, message: "Failed to generate upload URL" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /upload-complete — Confirm upload & UPDATE Prisma record
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/upload-complete", requireUserAuth, async (req, res) => {
    const sessionId = req.userSessionNumber;
    const kioskId = userSessionIdWithKioskId[sessionId];
    const fileKey = String(req.body?.fileKey || "").trim();
    const metadata = parseJsonField(req.body?.metadata, {});

    console.log(`\n📤 [upload-complete] Request received`);
    console.log(`   ├─ sessionId : ${sessionId}`);
    console.log(`   ├─ kioskId   : ${kioskId}`);
    console.log(`   └─ fileKey   : ${fileKey}`);

    if (!fileKey) {
        return res.status(400).json({ success: false, message: "fileKey is required" });
    }

    const record = s3UploadRecords[fileKey];
    if (!record) {
        return res.status(404).json({ success: false, message: "Unknown fileKey" });
    }

    if (record.sessionId !== sessionId) {
        return res.status(403).json({ success: false, message: "fileKey does not belong to this session" });
    }

    const isExpired = Date.now() - new Date(record.createdAt).getTime() > SIGNED_URL_WINDOW_MS;
    if (isExpired) {
        return res.status(400).json({ success: false, message: "Upload URL expired. Request a new URL" });
    }

    s3UploadRecords[fileKey] = {
        ...record,
        metadata,
        status: "uploaded",
        uploadedAt: new Date().toISOString(),
    };

    const existingPending = pendingS3PrintJobs[sessionId] || {};
    pendingS3PrintJobs[sessionId] = {
        ...existingPending,
        sessionId,
        kioskId,
        fileKey,
        fileName: record.fileName,
        printOptions: existingPending.printOptions || null,
        paymentConfirmed: Boolean(existingPending.paymentConfirmed),
        downloadStatus: "requesting",
        downloadedFileName: existingPending.downloadedFileName || null,
        createdAt: existingPending.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    let prefetchRequested = false;
    let prefetchMessage = "Kiosk pre-download request failed";

    try {
        const downloadUrl = await createSignedDownloadUrl({
            key: fileKey,
            expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS,
        });

        prefetchRequested = requestKioskS3Download(kioskId, {
            sessionId,
            fileKey,
            fileName: record.fileName,
            downloadUrl,
        });

        pendingS3PrintJobs[sessionId].downloadStatus = prefetchRequested ? "requested" : "request-failed";
        pendingS3PrintJobs[sessionId].updatedAt = new Date().toISOString();
        prefetchMessage = prefetchRequested
            ? "Upload recorded and kiosk pre-download requested"
            : "Upload recorded, but kiosk pre-download request failed";
    } catch (err) {
        console.error("Error requesting kiosk pre-download:", err.message);
        pendingS3PrintJobs[sessionId].downloadStatus = "request-failed";
        pendingS3PrintJobs[sessionId].updatedAt = new Date().toISOString();
    }

    printJobStatusBySession[sessionId] = {
        status: prefetchRequested ? "kiosk-download-requested" : "kiosk-download-request-failed",
        kioskId,
        fileKey,
        fileName: record.fileName,
        updatedAt: new Date().toISOString(),
    };

    // ── Prisma: UPDATE record — file uploaded to S3 + kiosk download requested ──
    try {
        const updatedRecord = await prisma.noAuthUser.updateMany({
            where: { userSessionNumber: sessionId },
            data: {
                fileName: record.fileName,
                s3UploadStatus: "uploaded",
                kioskDownloadStatus: prefetchRequested ? "requested" : "failed",
            },
        });

        console.log(`\n✅ [Prisma] NoAuthUser UPDATED (upload-complete) for session: ${sessionId}`);
        console.log(`   ├─ matchedCount         : ${updatedRecord.count}`);
        console.log(`   ├─ fileName             : ${record.fileName}`);
        console.log(`   ├─ s3UploadStatus       : uploaded`);
        console.log(`   └─ kioskDownloadStatus  : ${prefetchRequested ? "requested" : "failed"}`);
    } catch (dbErr) {
        console.error(`\n❌ [Prisma] Failed to UPDATE NoAuthUser (upload-complete) for session: ${sessionId}`);
        console.error(`   └─ error: ${dbErr.message}`);
    }

    console.log(`\n📤 [upload-complete] Done`);
    console.log(`   ├─ prefetchRequested : ${prefetchRequested}`);
    console.log(`   └─ message           : ${prefetchMessage}`);

    return res.json({ success: true, message: prefetchMessage, prefetchRequested });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /start-print — Confirm payment, dispatch print & UPDATE Prisma record
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/start-print", requireUserAuth, async (req, res) => {
    const sessionId = req.userSessionNumber;
    const kioskId = userSessionIdWithKioskId[sessionId];

    console.log(`\n🖨️  [start-print] Request received`);
    console.log(`   ├─ sessionId : ${sessionId}`);
    console.log(`   └─ kioskId   : ${kioskId}`);

    if (!kioskId) {
        return res.status(404).json({ success: false, message: "Kiosk not found for current session" });
    }

    const {
        fileKey,
        copies,
        printer,
        orientation,
        paperSize,
        sides,
        pageRanges,
        fitToPage,
        colorMode,
        printMeta,
    } = req.body;

    console.log(`   ├─ fileKey     : ${fileKey}`);
    console.log(`   ├─ copies      : ${copies}`);
    console.log(`   ├─ orientation  : ${orientation}`);
    console.log(`   ├─ paperSize    : ${paperSize}`);
    console.log(`   ├─ sides        : ${sides}`);
    console.log(`   ├─ colorMode    : ${colorMode}`);
    console.log(`   └─ printMeta    :`, JSON.stringify(printMeta));

    if (!fileKey) {
        return res.status(400).json({ success: false, message: "fileKey is required" });
    }

    const fileRecord = s3UploadRecords[fileKey];
    if (!fileRecord || fileRecord.sessionId !== sessionId || fileRecord.status !== "uploaded") {
        return res.status(400).json({ success: false, message: "File is not ready for printing" });
    }

    try {
        const fileName = fileRecord.fileName || path.posix.basename(fileKey);
        const existingPending = pendingS3PrintJobs[sessionId] || {};
        
        let printerToUse = printer || null;
        try {
            const kioskSettings = await Kiosk.findOne({ kioskId: kioskId });
            if (kioskSettings && kioskSettings.printers) {
                if (colorMode === "color" && kioskSettings.printers.color?.name && kioskSettings.printers.color.name !== "dummy") {
                    printerToUse = kioskSettings.printers.color.name;
                } else if ((colorMode === "monochrome" || colorMode === "bw") && kioskSettings.printers.bw?.name && kioskSettings.printers.bw.name !== "dummy") {
                    printerToUse = kioskSettings.printers.bw.name;
                } else {
                    // fallback based on what's available if exact match isn't present
                    if (kioskSettings.printers.bw?.name && kioskSettings.printers.bw.name !== "dummy") {
                        printerToUse = kioskSettings.printers.bw.name;
                    } else if (kioskSettings.printers.color?.name && kioskSettings.printers.color.name !== "dummy") {
                        printerToUse = kioskSettings.printers.color.name;
                    }
                }
            }
        } catch (dbErr) {
            console.error(`❌ [start-print] Failed to fetch printer settings for kiosk ${kioskId}: ${dbErr.message}`);
        }

        const mergedPrintOptions = {
            copies,
            printer: printerToUse,
            orientation,
            paperSize,
            sides,
            pageRanges,
            fitToPage,
            colorMode,
        };

        pendingS3PrintJobs[sessionId] = {
            ...existingPending,
            sessionId,
            kioskId,
            fileKey,
            fileName,
            printOptions: mergedPrintOptions,
            paymentConfirmed: true,
            createdAt: existingPending.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const pendingJob = pendingS3PrintJobs[sessionId];
        const downloadedFileName = pendingJob.downloadedFileName || fileName;

        // ── Prisma: UPDATE record — print config + payment confirmed ──
        try {
            const printConfig = {
                copies: copies || 1,
                printer: printerToUse || null,
                orientation: orientation || "portrait",
                paperSize: paperSize || "A4",
                sides: sides || "one-sided",
                pageRanges: pageRanges || null,
                fitToPage: fitToPage !== undefined ? fitToPage : true,
                colorMode: colorMode || "color",
            };

            const updatedRecord = await prisma.noAuthUser.updateMany({
                where: { userSessionNumber: sessionId },
                data: {
                    fileConfig: printConfig,
                    paymentStatus: "success",
                    paymentTimestamp: new Date(),
                    printStatus: "pending",
                },
            });

            console.log(`\n✅ [Prisma] NoAuthUser UPDATED (start-print) for session: ${sessionId}`);
            console.log(`   ├─ matchedCount   : ${updatedRecord.count}`);
            console.log(`   ├─ fileConfig     :`, JSON.stringify(printConfig));
            console.log(`   ├─ paymentStatus  : success`);
            console.log(`   └─ printStatus    : pending`);
        } catch (dbErr) {
            console.error(`\n❌ [Prisma] Failed to UPDATE NoAuthUser (start-print) for session: ${sessionId}`);
            console.error(`   └─ error: ${dbErr.message}`);
        }

        if (pendingJob.downloadStatus === "success") {
            const dispatched = printFile(kioskId, {
                fileName: downloadedFileName,
                sessionId,
                ...mergedPrintOptions,
            });

            printJobStatusBySession[sessionId] = {
                status: dispatched ? "print-requested" : "print-request-failed",
                kioskId,
                fileKey,
                fileName: downloadedFileName,
                printMeta: printMeta || null,
                updatedAt: new Date().toISOString(),
            };

            if (dispatched && s3UploadRecords[fileKey]) {
                s3UploadRecords[fileKey].status = "printing";
            }

            if (dispatched) {
                delete pendingS3PrintJobs[sessionId];
            }

            // ── Prisma: UPDATE print status after dispatch ──
            try {
                await prisma.noAuthUser.updateMany({
                    where: { userSessionNumber: sessionId },
                    data: {
                        printStatus: dispatched ? "printing" : "failed",
                        isPrintStarted: dispatched,
                        printedAt: dispatched ? new Date() : null,
                    },
                });
                console.log(`   ✅ [Prisma] printStatus → ${dispatched ? "printing" : "failed"}, isPrintStarted → ${dispatched}`);
            } catch (dbErr) {
                console.error(`   ❌ [Prisma] printStatus update failed: ${dbErr.message}`);
            }

            console.log(`\n🖨️  [start-print] Print dispatched: ${dispatched}`);

            return res.status(200).json({
                success: dispatched,
                message: dispatched ? "Payment confirmed and print started" : "Payment confirmed, but print dispatch failed",
                kioskId,
                sessionId,
                waitingForDownload: false,
            });
        }

        if (
            !pendingJob.downloadStatus ||
            pendingJob.downloadStatus === "request-failed" ||
            pendingJob.downloadStatus === "failed"
        ) {
            const retryDownloadUrl = await createSignedDownloadUrl({
                key: fileKey,
                expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS,
            });

            const retried = requestKioskS3Download(kioskId, {
                sessionId,
                fileKey,
                fileName,
                downloadUrl: retryDownloadUrl,
            });

            pendingS3PrintJobs[sessionId].downloadStatus = retried ? "requested" : "request-failed";
            pendingS3PrintJobs[sessionId].updatedAt = new Date().toISOString();

            printJobStatusBySession[sessionId] = {
                status: retried ? "payment-confirmed-waiting-for-download" : "kiosk-download-request-failed",
                kioskId,
                fileKey,
                fileName,
                printMeta: printMeta || null,
                updatedAt: new Date().toISOString(),
            };

            console.log(`\n🖨️  [start-print] Waiting for download, retry: ${retried}`);

            return res.status(200).json({
                success: retried,
                message: retried
                    ? "Payment confirmed. Waiting for kiosk to finish downloading PDF"
                    : "Payment confirmed, but kiosk download retry failed",
                kioskId,
                sessionId,
                waitingForDownload: true,
            });
        }

        printJobStatusBySession[sessionId] = {
            status: "payment-confirmed-waiting-for-download",
            kioskId,
            fileKey,
            fileName,
            printMeta: printMeta || null,
            updatedAt: new Date().toISOString(),
        };

        console.log(`\n🖨️  [start-print] Waiting for kiosk download...`);

        return res.json({
            success: true,
            message: "Payment confirmed. Waiting for kiosk to finish downloading PDF",
            kioskId,
            sessionId,
            waitingForDownload: true,
        });
    } catch (err) {
        console.error("Error starting S3 print flow:", err.message);
        return res.status(500).json({ success: false, message: "Failed to start print flow" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /print-status — Poll current print job status
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/print-status", (req, res) => {
    const tokenFromQuery = req.query.token;
    const tokenHeader = req.headers["authorization"];
    const sessionIdFromHeader = getSessionIdFromAuthHeader(tokenHeader);

    let sessionId = sessionIdFromHeader;

    if (!sessionId && tokenFromQuery) {
        try {
            const decoded = verifyToken(tokenFromQuery);
            sessionId = decoded.userSessionNumber;
        } catch {
            return res.status(401).json({ message: "Invalid token" });
        }
    }

    if (!sessionId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const kioskId = userSessionIdWithKioskId[sessionId] || null;
    const status = printJobStatusBySession[sessionId] || {
        status: "waiting",
        kioskId,
        updatedAt: new Date().toISOString(),
    };

    res.json({ sessionId, ...status });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /download-status — Check if kiosk has downloaded the file (from Prisma)
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/download-status", requireUserAuth, async (req, res) => {
    const sessionId = req.userSessionNumber;

    console.log(`\n🔍 [download-status] Checking for session: ${sessionId}`);

    if (!sessionId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    try {
        // Get the latest record for this session
        const records = await prisma.noAuthUser.findMany({
            where: { userSessionNumber: sessionId },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
                s3UploadStatus: true,
                kioskDownloadStatus: true,
                fileName: true,
                isPrintStarted: true,
                isPrinted: true,
                paymentStatus: true,
                updatedAt: true,
            },
        });

        const record = records[0] || null;

        if (!record) {
            return res.json({
                success: true,
                s3UploadStatus: "unknown",
                kioskDownloadStatus: "unknown",
                isDownloaded: false,
                isPrintStarted: false,
                isPrinted: false,
            });
        }

        const isDownloaded = record.kioskDownloadStatus === "downloaded";

        console.log(`   ├─ s3UploadStatus       : ${record.s3UploadStatus}`);
        console.log(`   ├─ kioskDownloadStatus  : ${record.kioskDownloadStatus}`);
        console.log(`   ├─ isDownloaded         : ${isDownloaded}`);
        console.log(`   ├─ isPrintStarted       : ${record.isPrintStarted}`);
        console.log(`   └─ isPrinted            : ${record.isPrinted}`);

        return res.json({
            success: true,
            s3UploadStatus: record.s3UploadStatus,
            kioskDownloadStatus: record.kioskDownloadStatus,
            fileName: record.fileName,
            isDownloaded,
            isPrintStarted: record.isPrintStarted,
            isPrinted: record.isPrinted,
            paymentStatus: record.paymentStatus,
            updatedAt: record.updatedAt,
        });
    } catch (err) {
        console.error(`❌ [download-status] Error: ${err.message}`);
        return res.status(500).json({ success: false, message: "Failed to check download status" });
    }
});

export default router;
