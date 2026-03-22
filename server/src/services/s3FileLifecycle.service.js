import cron from "node-cron";
import { deleteObjectByKey } from "./s3Storage.service.js";
import { s3UploadRecords } from "../state/runtimeStore.js";

const EXPIRE_MS = 20 * 60 * 1000;

export function startS3LifecycleCleanupJob() {
    cron.schedule("*/5 * * * *", async () => {
        const now = Date.now();
        const candidates = Object.values(s3UploadRecords);

        for (const record of candidates) {
            const uploadedAt = record.uploadedAt ? new Date(record.uploadedAt).getTime() : null;
            const createdAt = new Date(record.createdAt).getTime();
            const age = uploadedAt ? now - uploadedAt : now - createdAt;

            if (age <= EXPIRE_MS) continue;

            try {
                await deleteObjectByKey(record.fileKey);
                delete s3UploadRecords[record.fileKey];
                console.log(`[S3-Cleanup] Deleted expired file: ${record.fileKey}`);
            } catch (err) {
                console.error(`[S3-Cleanup] Failed to delete ${record.fileKey}:`, err.message);
            }
        }
    });
}
