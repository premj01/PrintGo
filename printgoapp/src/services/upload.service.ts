import api from "./api";
import type { UploadResponse } from "@/types";

// ===== Upload Service =====
// All file upload related API calls

export const uploadService = {
    /**
     * Upload a file to the server
     */
    async uploadFile(file: File): Promise<UploadResponse> {
        const formData = new FormData();
        formData.append("file", file);

        const response = await api.post<UploadResponse>(
            "/userdocs/upload",
            formData,
            {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            }
        );
        return response.data;
    },
};
