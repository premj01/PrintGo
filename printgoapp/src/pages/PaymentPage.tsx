import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { STORAGE_KEYS } from "@/config/constants";
import { kioskPrintService } from "@/services";
import type { MergedPdfMeta } from "@/types";
import { Loader2, CheckCircle2, AlertCircle, Download, Printer } from "lucide-react";

function base64ToBlob(base64: string, type: string): Blob {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type });
}

type DownloadPhase = "idle" | "uploading" | "uploaded" | "kiosk-downloading" | "downloaded" | "failed";

function downloadPhaseLabel(phase: DownloadPhase): string {
    switch (phase) {
        case "idle":
            return "Preparing...";
        case "uploading":
            return "Uploading PDF to secure storage...";
        case "uploaded":
            return "PDF uploaded. Kiosk is fetching your file...";
        case "kiosk-downloading":
            return "Kiosk is downloading your file...";
        case "downloaded":
            return "File ready on kiosk!";
        case "failed":
            return "Kiosk download failed. Will retry when you print.";
        default:
            return "Preparing...";
    }
}

export default function PaymentPage() {
    const navigate = useNavigate();
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [printLoading, setPrintLoading] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const [preparedFileKey, setPreparedFileKey] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [downloadPhase, setDownloadPhase] = useState<DownloadPhase>("idle");

    // Payment state — after payment, show Print button
    const [isPaid, setIsPaid] = useState(false);
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const mergedPdfBase64 = localStorage.getItem(STORAGE_KEYS.MERGED_PDF_BASE64);
    const meta = useMemo(() => {
        const raw = localStorage.getItem(STORAGE_KEYS.MERGED_PDF_META);
        if (!raw) return null;
        try {
            return JSON.parse(raw) as MergedPdfMeta;
        } catch {
            return null;
        }
    }, []);

    // ── Poll download status from backend ──
    const pollDownloadStatus = useCallback(async () => {
        try {
            const status = await kioskPrintService.checkDownloadStatus();
            console.log("[PaymentPage] download-status:", status);

            if (status.kioskDownloadStatus === "downloaded") {
                setDownloadPhase("downloaded");
                return true; // stop polling
            } else if (status.kioskDownloadStatus === "failed") {
                setDownloadPhase("failed");
                return true; // stop, will retry on print click
            } else if (
                status.kioskDownloadStatus === "requested" ||
                status.kioskDownloadStatus === "downloading"
            ) {
                setDownloadPhase("kiosk-downloading");
                return false; // keep polling
            } else if (status.s3UploadStatus === "uploaded") {
                setDownloadPhase("uploaded");
                return false; // keep polling
            } else {
                setDownloadPhase("idle");
                return false; // keep polling
            }
        } catch {
            return false;
        }
    }, []);

    const stopPolling = useCallback(() => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    }, []);

    const startPolling = useCallback(() => {
        stopPolling();

        void pollDownloadStatus();

        pollTimerRef.current = setInterval(async () => {
            const shouldStop = await pollDownloadStatus();
            if (shouldStop) {
                stopPolling();
            }
        }, 3000);
    }, [pollDownloadStatus, stopPolling]);

    if (!mergedPdfBase64 || !meta) {
        return (
            <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-6">
                <Card className="w-full max-w-xl">
                    <CardHeader>
                        <CardTitle>Bill Data Missing</CardTitle>
                        <CardDescription>Please process and preview your PDF first.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate("/upload")}>Go To Upload</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const bwAmount = meta.bwPageCount * 1;
    const colorAmount = meta.colorPageCount * 4;
    const totalAmount = bwAmount + colorAmount;

    const uploadStartedRun = useRef(false);

    useEffect(() => {
        return () => {
            stopPolling();
        };
    }, [stopPolling]);

    // ── Upload PDF in background ──
    useEffect(() => {
        if (uploadStartedRun.current) return;
        uploadStartedRun.current = true;

        const prepareInBackground = async () => {
            try {
                const existingFileKey = localStorage.getItem(STORAGE_KEYS.UPLOADED_FILE_NAME);
                if (existingFileKey) {
                    // Verify the cached key is still valid on the backend
                    try {
                        const statusCheck = await kioskPrintService.checkDownloadStatus();
                        if (statusCheck.s3UploadStatus !== "unknown") {
                            // Valid record exists — use cached key
                            setPreparedFileKey(existingFileKey);
                            setDownloadPhase(statusCheck.isDownloaded ? "downloaded" : "uploaded");
                            return;
                        }
                    } catch {
                        // Backend check failed — fall through to fresh upload
                    }

                    // Stale cache (server restarted / no matching record) — clear and re-upload
                    console.log("[PaymentPage] Stale fileKey cache detected, re-uploading...");
                    localStorage.removeItem(STORAGE_KEYS.UPLOADED_FILE_NAME);
                }

                setPreparing(true);
                setDownloadPhase("uploading");

                const mergedBlob = base64ToBlob(mergedPdfBase64, "application/pdf");
                const mergedFile = new File([mergedBlob], "merged-printgo.pdf", {
                    type: "application/pdf",
                });

                const uploadResponse = await kioskPrintService.uploadMergedPdf(mergedFile, meta);
                const uploadedFileKey = uploadResponse.fileKey;

                if (!uploadedFileKey) {
                    throw new Error("Merged file key missing from upload response");
                }

                localStorage.setItem(STORAGE_KEYS.UPLOADED_FILE_NAME, uploadedFileKey);

                setPreparedFileKey(uploadedFileKey);
                setDownloadPhase("uploaded");
            } catch (err) {
                console.error(err);
                setError("Failed to prepare PDF. Please retry.");
                setDownloadPhase("failed");
            } finally {
                setPreparing(false);
            }
        };

        void prepareInBackground();
    }, [mergedPdfBase64, meta]);

    // Poll kiosk download only after payment so payment is never blocked by download progress.
    useEffect(() => {
        if (!isPaid || !preparedFileKey) {
            return;
        }

        if (downloadPhase === "downloaded") {
            stopPolling();
            return;
        }

        startPolling();
    }, [isPaid, preparedFileKey, downloadPhase, startPolling, stopPolling]);

    const isKioskReady = downloadPhase === "downloaded";

    // ── Handle Payment (dummy — always succeeds) ──
    const handlePay = async () => {
        try {
            setPaymentLoading(true);
            setError("");

            // Simulate payment processing
            await new Promise((resolve) => setTimeout(resolve, 1200));

            setIsPaid(true);
        } catch (err) {
            console.error(err);
            setError("Payment failed. Please try again.");
        } finally {
            setPaymentLoading(false);
        }
    };

    // ── Handle Print (after payment, checks isDownloaded) ──
    const handlePrint = async () => {
        try {
            setPrintLoading(true);
            setError("");

            const uploadedFileKey = preparedFileKey || localStorage.getItem(STORAGE_KEYS.UPLOADED_FILE_NAME);

            if (!uploadedFileKey) {
                throw new Error("PDF is not prepared yet. Please wait a moment and try again.");
            }

            // Check if kiosk has the file
            if (!isKioskReady) {
                // One more check before failing
                const latestStatus = await kioskPrintService.checkDownloadStatus();
                if (!latestStatus.isDownloaded) {
                    setError("Kiosk is still downloading your file. Please wait a moment and try again.");
                    setPrintLoading(false);
                    return;
                }
                setDownloadPhase("downloaded");
            }

            await kioskPrintService.startPrint({
                fileKey: uploadedFileKey,
                copies: 1,
                orientation: "portrait",
                paperSize: "A4",
                fitToPage: true,
                colorMode: "monochrome",
                printMeta: meta,
            });

            navigate("/printing");
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to start printing. Please retry.");
        } finally {
            setPrintLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-10rem)] bg-gradient-to-br from-surface via-background to-accent/20 p-6">
            <Card className="mx-auto w-full max-w-3xl shadow-xl">
                <CardHeader>
                    <CardTitle>{isPaid ? "Payment Successful!" : "Dummy Payment"}</CardTitle>
                    <CardDescription>
                        {isPaid
                            ? "Your payment has been processed. You can now print your document."
                            : "Billing: Rs 1 per B/W page and Rs 4 per Color page"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-sm text-muted-foreground">B/W Pages ({meta.bwRanges || "none"})</p>
                        <p className="text-lg font-semibold">{meta.bwPageCount} x Rs 1 = Rs {bwAmount}</p>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-sm text-muted-foreground">Color Pages ({meta.colorRanges || "none"})</p>
                        <p className="text-lg font-semibold">{meta.colorPageCount} x Rs 4 = Rs {colorAmount}</p>
                    </div>

                    <div className={`rounded-xl border p-4 ${isPaid ? "border-success/40 bg-success/10" : "border-success/30 bg-success/10"}`}>
                        <p className="text-sm text-muted-foreground">Total</p>
                        <div className="flex items-center gap-3">
                            <p className="text-2xl font-bold text-success">Rs {totalAmount}</p>
                            {isPaid && <CheckCircle2 className="h-6 w-6 text-success" />}
                        </div>
                    </div>

                    {/* ── Kiosk Download Status (informational, NOT blocking payment) ── */}
                    <div
                        className={`flex items-center gap-3 rounded-xl border p-4 transition-all duration-500 ${
                            downloadPhase === "downloaded"
                                ? "border-success/40 bg-success/10"
                                : downloadPhase === "failed"
                                    ? "border-destructive/40 bg-destructive/10"
                                    : "border-accent/30 bg-accent/5"
                        }`}
                    >
                        {downloadPhase === "downloaded" ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                        ) : downloadPhase === "failed" ? (
                            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                        ) : downloadPhase === "idle" || downloadPhase === "uploading" ? (
                            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent" />
                        ) : (
                            <Download className="h-5 w-5 shrink-0 animate-pulse text-accent" />
                        )}

                        <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">Kiosk File Status</p>
                            <p className="text-xs text-muted-foreground">
                                {downloadPhaseLabel(downloadPhase)}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
                    )}

                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" onClick={() => navigate("/preview")} disabled={paymentLoading || printLoading}>
                            Back To Preview
                        </Button>

                        {!isPaid ? (
                            /* ── PAYMENT BUTTON (available even while kiosk is downloading) ── */
                            <Button
                                onClick={handlePay}
                                disabled={paymentLoading || preparing || !preparedFileKey}
                            >
                                {preparing
                                    ? "Preparing PDF..."
                                    : paymentLoading
                                        ? "Processing Payment..."
                                        : `Pay Rs ${totalAmount}`}
                            </Button>
                        ) : (
                            /* ── PRINT BUTTON (shown only after payment) ── */
                            <Button
                                onClick={handlePrint}
                                disabled={printLoading}
                                className={`gap-2 ${
                                    isKioskReady
                                        ? "bg-gradient-to-r from-success to-accent text-foreground hover:from-accent hover:to-success"
                                        : ""
                                }`}
                            >
                                {printLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Starting Print...
                                    </>
                                ) : !isKioskReady ? (
                                    <>
                                        <Download className="h-4 w-4 animate-pulse" />
                                        Print (Kiosk Downloading...)
                                    </>
                                ) : (
                                    <>
                                        <Printer className="h-4 w-4" />
                                        Start Printing
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
