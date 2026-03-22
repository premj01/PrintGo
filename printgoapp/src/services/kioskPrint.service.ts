import api from "./api";
// import { ENV } from "@/config";
import type {
    KioskAuthResponse,
    MergedPdfMeta,
    PrintStatusPayload,
    S3UploadUrlResponse,
    DownloadStatusResponse,
} from "@/types";

export interface StartPrintPayload {
    fileKey: string;
    copies?: number;
    printer?: string | null;
    orientation?: "portrait" | "landscape";
    paperSize?: "A4" | "Letter" | "Legal";
    sides?: "one-sided" | "two-sided-long-edge" | "two-sided-short-edge";
    pageRanges?: string | null;
    fitToPage?: boolean;
    colorMode?: "monochrome" | "color";
    printMeta?: MergedPdfMeta;
}

export const kioskPrintService = {
    async authenticateKioskSession(userSessionNumber: string): Promise<KioskAuthResponse> {
        const response = await api.post<KioskAuthResponse>("/kisokRedirect", {
            userSessionNumber,
        });
        return response.data;
    },

    async requestUploadUrl(file: File, metadata: MergedPdfMeta): Promise<S3UploadUrlResponse> {
        const response = await api.post<S3UploadUrlResponse>("/userdocs/upload-url", {
            fileName: file.name,
            contentType: file.type || "application/pdf",
            size: file.size,
            metadata,
        });

        return response.data;
    },

    async uploadFileToS3(uploadUrl: string, file: File): Promise<void> {
        const response = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": "application/pdf",
            },
            body: file,
        });

        if (!response.ok) {
            throw new Error(`S3 upload failed with status ${response.status}`);
        }
    },

    async confirmUploadComplete(fileKey: string, metadata: MergedPdfMeta): Promise<void> {
        await api.post("/userdocs/upload-complete", {
            fileKey,
            metadata,
        });
    },

    async uploadMergedPdf(file: File, metadata: MergedPdfMeta): Promise<{ fileKey: string }> {
        const { uploadUrl, fileKey } = await this.requestUploadUrl(file, metadata);
        await this.uploadFileToS3(uploadUrl, file);
        await this.confirmUploadComplete(fileKey, metadata);

        return { fileKey };
    },

    async startPrint(payload: StartPrintPayload): Promise<{ success: boolean; message: string }> {
        const response = await api.post<{ success: boolean; message: string }>(
            "/userdocs/start-print",
            payload
        );
        return response.data;
    },

    async checkDownloadStatus(): Promise<DownloadStatusResponse> {
        const response = await api.get<DownloadStatusResponse>("/userdocs/download-status");
        return response.data;
    },

    createPrintStatusStream(
        token: string,
        onMessage: (payload: PrintStatusPayload) => void,
        onError?: (error: Error) => void
    ): { close: () => void } {
        let intervalId: ReturnType<typeof setInterval> | undefined;
        let isClosed = false;

        const pollStatus = async () => {
            if (isClosed) return;

            try {
                const response = await api.get<PrintStatusPayload>(
                    `/userdocs/print-status?token=${encodeURIComponent(token)}`
                );
                if (!isClosed) {
                    onMessage(response.data);
                }
            } catch (error) {
                if (!isClosed && onError) {
                    onError(error instanceof Error ? error : new Error("Failed to fetch status"));
                }
            }
        };

        // Poll immediately
        void pollStatus();

        // Poll every 5 seconds
        intervalId = setInterval(() => void pollStatus(), 5000);

        return {
            close: () => {
                isClosed = true;
                if (intervalId) clearInterval(intervalId);
            },
        };
    },
};

