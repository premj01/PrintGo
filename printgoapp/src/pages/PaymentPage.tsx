import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { STORAGE_KEYS } from "@/config/constants";
import { ENV } from "@/config";
import { kioskPrintService } from "@/services";
import CustomerBill from "@/components/CustomerBill";
import { useAutomaticPrint } from "@/hooks/useAutomaticPrint";
import type { MergedPdfMeta, RazorpayCheckoutOptions, RazorpayPaymentResponse, RazorpayInstance } from "@/types";
import { Loader2, CheckCircle2, AlertCircle, Download, Printer, CreditCard, ShieldCheck } from "lucide-react";

import { get as idbGet } from "idb-keyval";

// Declare Razorpay on window (loaded via checkout.js in index.html)
declare global {
    interface Window {
        Razorpay: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
    }
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
            return "Kiosk download failed. Check the print status for next steps.";
        default:
            return "Preparing...";
    }
}

export default function PaymentPage() {
    const navigate = useNavigate();
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const [preparedFileKey, setPreparedFileKey] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [downloadPhase, setDownloadPhase] = useState<DownloadPhase>("idle");

    // Payment verification starts printing and opens the receipt dialog independently.
    const [isPaid, setIsPaid] = useState(false);
    const [paymentId, setPaymentId] = useState<string | null>(null);
    const [alreadyStarted, setAlreadyStarted] = useState(false);
    const [openBillAfterPayment, setOpenBillAfterPayment] = useState(false);
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [mergedPdfBlob, setMergedPdfBlob] = useState<Blob | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    const uploadStartedRun = useRef(false);

    // ── Load Merged PDF Blob from IndexedDB ──
    useEffect(() => {
        idbGet<Blob>(STORAGE_KEYS.MERGED_PDF_BASE64)
            .then(blob => {
                if (blob) setMergedPdfBlob(blob);
            })
            .finally(() => setIsLoaded(true));
    }, []);

    const meta = useMemo(() => {
        const raw = localStorage.getItem(STORAGE_KEYS.MERGED_PDF_META);
        if (!raw) return null;
        try {
            return JSON.parse(raw) as MergedPdfMeta;
        } catch {
            return null;
        }
    }, []);

    const automaticPrint = useAutomaticPrint(isPaid, preparedFileKey, meta, alreadyStarted);

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
                return true;
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

    // ── Upload PDF in background ──
    useEffect(() => {
        if (uploadStartedRun.current || !mergedPdfBlob || !meta) return;
        uploadStartedRun.current = true;

        const prepareInBackground = async () => {
            try {
                const existingFileKey = localStorage.getItem(STORAGE_KEYS.UPLOADED_FILE_NAME);
                if (existingFileKey) {
                    try {
                        const statusCheck = await kioskPrintService.checkDownloadStatus();
                        if (statusCheck.s3UploadStatus !== "unknown") {
                            setPreparedFileKey(existingFileKey);
                            setDownloadPhase(statusCheck.isDownloaded ? "downloaded" : "uploaded");
                            if (["success", "refunded", "partially_refunded"].includes(statusCheck.paymentStatus || "")) {
                                setAlreadyStarted(statusCheck.isPrintStarted || statusCheck.isPrinted || statusCheck.paymentStatus !== "success");
                                setPaymentId(statusCheck.paymentId || null);
                                setIsPaid(true);
                            }
                            return;
                        }
                    } catch {
                        // Backend check failed — fall through
                    }
                    console.log("[PaymentPage] Stale fileKey cache detected, re-uploading...");
                    localStorage.removeItem(STORAGE_KEYS.UPLOADED_FILE_NAME);
                }

                setPreparing(true);
                setDownloadPhase("uploading");

                const mergedFile = new File([mergedPdfBlob], "merged-printgo.pdf", {
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
    }, [mergedPdfBlob, meta]);

    // ── Polling Effect ──
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

    // ── Cleanup Polling on Unmount ──
    useEffect(() => {
        return () => {
            stopPolling();
        };
    }, [stopPolling]);

    // ── Conditional Returns ──
    if (!isLoaded) {
        return (
            <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-6 text-muted-foreground animate-pulse">
                Loading payment details...
            </div>
        );
    }

    if (!mergedPdfBlob || !meta) {
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

    // ── Calculated Values and Handlers ──
    const bwAmount = meta.bwPageCount * 1;
    const colorAmount = meta.colorPageCount * 4;
    const totalAmount = bwAmount + colorAmount;

    // ── Razorpay Payment Flow ──
    const handlePay = async () => {
        try {
            setPaymentLoading(true);
            setError("");

            // 1. Create order on backend
            const orderData = await kioskPrintService.createPaymentOrder(totalAmount, preparedFileKey || localStorage.getItem(STORAGE_KEYS.UPLOADED_FILE_NAME) || undefined);

            if (!orderData.success || !orderData.orderId) {
                throw new Error("Failed to create payment order");
            }

            // 2. Open Razorpay Checkout
            const options: RazorpayCheckoutOptions = {
                key: ENV.RAZORPAY_KEY_ID,
                amount: orderData.amount,
                currency: orderData.currency || "INR",
                name: "PrintGo",
                description: `Print Job — ${meta.totalPages} pages`,
                order_id: orderData.orderId,
                handler: async (response: RazorpayPaymentResponse) => {
                    try {
                        // 3. Verify payment signature on backend
                        const verifyResult = await kioskPrintService.verifyPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });

                        if (verifyResult.success) {
                            setOpenBillAfterPayment(true);
                            setIsPaid(true);
                            setPaymentId(verifyResult.paymentId);
                            setError("");
                            console.log("[PaymentPage] Payment verified:", verifyResult.paymentId);
                        } else {
                            setError("Payment verification failed. Please contact support.");
                        }
                    } catch (err) {
                        console.error("Payment verification error:", err);
                        setError("Payment verification failed. Your money is safe — contact support if charged.");
                    } finally {
                        setPaymentLoading(false);
                    }
                },
                prefill: {
                    name: "PrintGo User",
                },
                theme: {
                    color: "#10b981",
                },
                modal: {
                    ondismiss: () => {
                        setPaymentLoading(false);
                        console.log("[PaymentPage] Razorpay checkout dismissed");
                    },
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.on("payment.failed", () => {
                setError("Payment failed. Please try again.");
                setPaymentLoading(false);
            });
            rzp.open();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
            setPaymentLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-10rem)] bg-gradient-to-br from-surface via-background to-accent/20 p-6">
            <Card className="mx-auto w-full max-w-3xl shadow-xl">
                <CardHeader>
                    <CardTitle>{isPaid ? "Payment Successful!" : "Complete Payment"}</CardTitle>
                    <CardDescription>
                        {isPaid
                            ? "Your payment is confirmed. Printing starts automatically, and you can email yourself the bill."
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

                    {/* ── Payment Security Badge ── */}
                    {!isPaid && (
                        <div className="flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 p-3">
                            <ShieldCheck className="h-5 w-5 text-accent shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-foreground">Secure Payment via Razorpay</p>
                                <p className="text-xs text-muted-foreground">
                                    UPI, Cards, Net Banking, Wallets supported. Auto-refund if print fails.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Payment ID display ── */}
                    {isPaid && paymentId && (
                        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-3">
                            <CreditCard className="h-5 w-5 text-success shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-foreground">Payment ID</p>
                                <p className="text-xs text-muted-foreground font-mono">{paymentId}</p>
                            </div>
                        </div>
                    )}

                    {/* ── Kiosk Download Status ── */}
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

                    {isPaid && (
                        <div role="status" className="rounded-xl border border-border bg-card p-4 text-sm">
                            {automaticPrint.loading ? <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Starting your print job automatically...</p>
                                : automaticPrint.requested ? <p>Your print job has been submitted. View print status to follow its progress.</p>
                                    : automaticPrint.error ? <p>Printing could not start automatically.</p>
                                    : <p>Preparing to start your print job...</p>}
                            {automaticPrint.error && <div role="alert" className="mt-2 space-y-2"><p className="text-destructive">{automaticPrint.error}</p><Button variant="outline" onClick={() => void automaticPrint.retry()} disabled={automaticPrint.loading}>Retry printing</Button></div>}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                        {!isPaid && <Button variant="outline" onClick={() => navigate("/preview")} disabled={paymentLoading}>
                            Back To Preview
                        </Button>}

                        {!isPaid ? (
                            <Button
                                onClick={handlePay}
                                disabled={paymentLoading || preparing || !preparedFileKey}
                                className="gap-2"
                            >
                                {preparing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Preparing PDF...
                                    </>
                                ) : paymentLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Processing Payment...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="h-4 w-4" />
                                        {`Pay Rs ${totalAmount}`}
                                    </>
                                )}
                            </Button>
                        ) : (
                            <>
                                <CustomerBill initialOpen={openBillAfterPayment} paymentId={paymentId} />
                                <Button variant="outline" className="gap-2" disabled={automaticPrint.loading} onClick={() => navigate("/printing")}><Printer className="h-4 w-4" />View print status</Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
