import api from "./api";
import type { S3UploadUrlResponse } from "@/types";

// ===== Upload Service =====
// Legacy wrapper retained for compatibility with old hooks.

export const uploadService = {
    /**
     * Upload a single PDF file via S3 signed URL flow.
     */
    async uploadFile(file: File): Promise<{ success: boolean; fileKey: string }> {
        const { data } = await api.post<S3UploadUrlResponse>("/userdocs/upload-url", {
            fileName: file.name,
            contentType: file.type || "application/pdf",
            size: file.size,
            metadata: {},
        });

        const uploadRes = await fetch(data.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/pdf" },
            body: file,
        });

        if (!uploadRes.ok) {
            throw new Error(`S3 upload failed with status ${uploadRes.status}`);
        }

        await api.post("/userdocs/upload-complete", {
            fileKey: data.fileKey,
            metadata: {},
        });

        return { success: true, fileKey: data.fileKey };
    },
};
