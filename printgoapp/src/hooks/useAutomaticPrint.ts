import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { kioskPrintService } from "@/services";
import type { MergedPdfMeta } from "@/types";

// Starting the job is independent of the receipt dialog. The server queues
// the paid job if the kiosk is still downloading and dispatches it when ready.
export function useAutomaticPrint(isPaid: boolean, fileKey: string | null, meta: MergedPdfMeta | null, alreadyStarted: boolean) {
    const attempted = useRef<string | null>(null);
    const inFlight = useRef(false);
    const [loading, setLoading] = useState(false);
    const [requested, setRequested] = useState(false);
    const [error, setError] = useState("");

    const start = useCallback(async () => {
        if (!isPaid || !fileKey || !meta || inFlight.current || alreadyStarted) return;
        inFlight.current = true;
        attempted.current = fileKey;
        setLoading(true);
        setError("");
        let rejected = false;
        try {
            const result = await kioskPrintService.startPrint({
                fileKey, copies: 1, orientation: "portrait", paperSize: "A4",
                fitToPage: true, colorMode: "monochrome", printMeta: meta,
            });
            if (!result.success) {
                rejected = true;
                throw new Error(result.message || "The kiosk could not start printing.");
            }
            setRequested(true);
        } catch (err) {
            // A dropped HTTP response may follow a successfully queued job.
            // Reconcile with the server before offering a retry.
            if (!rejected) {
                try {
                    const status = await kioskPrintService.checkDownloadStatus();
                    if (status.isPrintStarted || status.isPrinted) {
                        setRequested(true);
                        return;
                    }
                } catch { /* Keep the original failure message below. */ }
            }
            setError(isAxiosError(err)
                ? err.response?.data?.message || "Could not start printing. Check the kiosk connection and retry."
                : err instanceof Error ? err.message : "Could not start printing. Please retry.");
        } finally {
            inFlight.current = false;
            setLoading(false);
        }
    }, [isPaid, fileKey, meta, alreadyStarted]);

    useEffect(() => {
        if (isPaid && fileKey && meta && attempted.current !== fileKey && !alreadyStarted) void start();
    }, [isPaid, fileKey, meta, alreadyStarted, start]);

    return { loading, requested: requested || alreadyStarted, error, retry: start };
}
