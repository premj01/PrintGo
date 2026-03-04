import { useState, useCallback, useRef } from "react";
import { uploadService } from "@/services";

interface UseFileUploadReturn {
    file: File | null;
    uploading: boolean;
    message: string;
    messageType: "success" | "error" | "warning" | null;
    dragOver: boolean;
    inputRef: React.RefObject<HTMLInputElement | null>;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDragLeave: () => void;
    handleUpload: () => Promise<void>;
    handleZoneClick: () => void;
    resetFile: () => void;
}

/**
 * Custom hook encapsulating all file upload logic:
 * drag-and-drop, file selection, upload, and status messages.
 */
export function useFileUpload(): UseFileUploadReturn {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState<
        "success" | "error" | "warning" | null
    >(null);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const handleFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files?.[0]) {
                setFile(e.target.files[0]);
                setMessage("");
                setMessageType(null);
            }
        },
        []
    );

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.[0]) {
            setFile(e.dataTransfer.files[0]);
            setMessage("");
            setMessageType(null);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOver(false);
    }, []);

    const handleZoneClick = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const handleUpload = useCallback(async () => {
        if (!file) {
            setMessage("Please select a file first!");
            setMessageType("warning");
            return;
        }

        try {
            setUploading(true);
            setMessage("");
            setMessageType(null);

            await uploadService.uploadFile(file);

            setMessage("File uploaded successfully!");
            setMessageType("success");
            setFile(null);
        } catch (error) {
            console.error("Upload failed:", error);
            setMessage("Upload failed. Please try again.");
            setMessageType("error");
        } finally {
            setUploading(false);
        }
    }, [file]);

    const resetFile = useCallback(() => {
        setFile(null);
        setMessage("");
        setMessageType(null);
    }, []);

    return {
        file,
        uploading,
        message,
        messageType,
        dragOver,
        inputRef,
        handleFileChange,
        handleDrop,
        handleDragOver,
        handleDragLeave,
        handleUpload,
        handleZoneClick,
        resetFile,
    };
}
