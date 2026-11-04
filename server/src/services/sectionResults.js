import { deleteObjectByKey } from "./s3Storage.service.js";
import prisma from "../config/prisma.js";
import { initiateRefund } from "./razorpay.service.js";
import { printJobStatusBySession, s3UploadRecords } from "../state/runtimeStore.js";
import { summarizeSections } from "./printSections.js";

export function sectionStatus(record) {
    const { sections, fileKey } = record.fileConfig;
    return {
        status: record.printStatus, sections, fileKey, kioskId: record.kioskId,
        updatedAt: record.updatedAt.toISOString(), refundStatus: record.refundStatus,
        refundAmount: record.refundAmount, refundId: record.refundId,
    };
}

export async function recordSectionUpdate(kioskId, { batchId, sessionId, revision, results, finished }) {
    if (!Number.isSafeInteger(revision) || revision < 1 || !Array.isArray(results)) return false;
    const record = await prisma.noAuthUser.findFirst({ where: { id: batchId, kioskId, userSessionNumber: sessionId } });
    const config = record?.fileConfig;
    if (!config?.sections || results.length !== config.sections.length) return false;
    if (config.revision >= revision || config.finished) return true;

    const sections = config.sections.map((part, i) => {
        const result = results[i];
        if (part.mode !== result?.mode || !["waiting", "queued", "completed", "failed", "unknown"].includes(result.status)) {
            throw new Error("Invalid print section result");
        }
        return { ...part, status: result.status, jobId: result.jobId || null, error: result.error || null };
    });
    const status = finished ? summarizeSections(sections) : "printing";
    const done = status !== "printing";
    const refund = done ? sections.reduce((sum, part) => sum + (part.status === "failed" ? part.amount : 0), 0) : 0;
    const claimRefund = refund > 0 && refund <= Math.round(record.paymentAmount * 100) &&
        record.paymentStatus === "success" && record.razorpayPaymentId && !record.refundStatus;
    const changed = await prisma.noAuthUser.updateMany({
        where: { id: batchId, fileConfig: { equals: config } },
        data: {
            fileConfig: { ...config, revision, sections, finished: Boolean(finished && done) }, printStatus: status,
            isPrinted: status === "print-completed", printedAt: status === "print-completed" ? new Date() : null,
            ...(claimRefund && { refundStatus: "requested", refundAmount: refund / 100 }),
        },
    });
    if (!changed.count) return false; // The kiosk retries its latest snapshot until acknowledged.
    if (done && status !== "needs-review") {
        try {
            await deleteObjectByKey(config.fileKey);
            delete s3UploadRecords[config.fileKey];
        } catch (error) {
            if (s3UploadRecords[config.fileKey]) s3UploadRecords[config.fileKey].status = "cleanup-pending";
            console.error("Scheduled cleanup will retry S3 deletion", config.fileKey, error.message);
        }
    }
    if (claimRefund) {
        try {
            const result = await initiateRefund(record.razorpayPaymentId, refund, { sessionId, reason: "Failed print sections" });
            if (result.status === "failed") throw new Error("Razorpay reported a failed refund: " + result.id);
            await prisma.noAuthUser.update({
                where: { id: batchId },
                data: {
                    refundId: result.id, refundStatus: result.status, refundTimestamp: new Date(),
                    paymentStatus: refund === Math.round(record.paymentAmount * 100) ? "refunded" : "partially_refunded",
                },
            });
        } catch (error) {
            // A timeout may follow a successful transfer. Reconcile before issuing another refund.
            console.error("Refund requires reconciliation", batchId, error.message);
            await prisma.noAuthUser.update({ where: { id: batchId }, data: { refundStatus: "needs-review" } });
        }
    }
    const latest = await prisma.noAuthUser.findUnique({ where: { id: batchId } });
    printJobStatusBySession[sessionId] = sectionStatus(latest);
    return true;
}
