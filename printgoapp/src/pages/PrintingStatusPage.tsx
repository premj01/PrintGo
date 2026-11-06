import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { STORAGE_KEYS } from "@/config/constants";
import { kioskPrintService } from "@/services";
import CustomerBill from "@/components/CustomerBill";
import type { PrintStatusPayload } from "@/types";

function formatStatus(status?: string): string {
    const statusMap: Record<string, string> = {
        waiting: "Waiting for print flow to start",
        "upload-url-issued": "Upload URL generated",
        "uploaded-to-s3": "PDF uploaded to secure storage",
        "kiosk-download-requested": "Kiosk is fetching your PDF",
        "kiosk-download-success": "PDF fetched on kiosk",
        "kiosk-file-ready-awaiting-payment": "PDF ready on kiosk. Waiting for payment confirmation",
        "payment-confirmed-waiting-for-download": "Payment confirmed. Fetching PDF on kiosk",
        "print-requested": "Print request sent to kiosk",
        "printing-started": "Printing started",
        printing: "Printing in progress",
        "print-completed": "Print completed successfully",
        success: "Print completed successfully",
        failed: "Printing failed",
        "print-failed": "Printing failed",
        "partially-printed": "Only part of your document printed",
        "needs-review": "Printer outcome needs review",
        "kiosk-download-failed": "Kiosk failed to fetch PDF",
        "kiosk-download-request-failed": "Could not request kiosk download",
        "print-request-failed": "Could not send print command to kiosk",
    };

    if (!status) return "Waiting for print flow to start";
    return statusMap[status] || status;
}

export default function PrintingStatusPage() {
    const navigate = useNavigate();
    const [events, setEvents] = useState<PrintStatusPayload[]>([]);
    const [streamError, setStreamError] = useState("");

    useEffect(() => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) {
            navigate("/");
            return;
        }

        const stream = kioskPrintService.createPrintStatusStream(
            token,
            (payload) => {
                setEvents((prev) => [payload, ...prev].slice(0, 20));
            },
            () => {
                setStreamError("Failed to fetch status. Retrying in 5 seconds...");
            }
        );

        return () => {
            stream.close();
        };
    }, [navigate]);

    const latest = events[0];

    return (
        <div className="min-h-[calc(100vh-10rem)] bg-gradient-to-br from-surface via-background to-accent/20 p-6">
            <Card className="mx-auto w-full max-w-3xl shadow-xl">
                <CardHeader>
                    <CardTitle>Print status</CardTitle>
                    <CardDescription>
                        Follow your print job here. You can email yourself the bill while printing continues.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-sm text-muted-foreground">Current Status</p>
                        <p className="text-xl font-semibold">{formatStatus(latest?.status)}</p>
                        {latest?.kioskId && (
                            <p className="mt-1 text-sm text-muted-foreground">Kiosk: {latest.kioskId}</p>
                        )}
                    </div>

                    {latest?.sections?.map(part => (
                        <p key={part.mode}>{part.mode === "bw" ? "Black and white" : "Color"} · Pages {part.pageRanges} · {part.status}</p>
                    ))}
                    {latest?.refundStatus === "needs-review" && <p>Your refund needs review by the kiosk operator.</p>}
                    {/* ── Refund Info Banner ── */}
                    {latest?.refundStatus && ["processed", "pending", "requested", "refunded"].includes(latest.refundStatus) && (
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                                💸 Automatic Refund Initiated
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                A refund was requested for the failed print pages.
                                Refund amount: <strong>Rs {latest.refundAmount}</strong>
                                {latest.refundId && (
                                    <span className="ml-2 font-mono">({latest.refundId})</span>
                                )}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Refunds typically take 5-7 business days to reflect in your account.
                            </p>
                        </div>
                    )}

                    {streamError && (
                        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                            {streamError}
                        </div>
                    )}

                    <div className="max-h-80 overflow-auto rounded-xl border border-border bg-card p-3">
                        <p className="mb-2 text-sm font-medium text-muted-foreground">Status Timeline</p>
                        {events.length === 0 && (
                            <p className="text-sm text-muted-foreground">Waiting for first status event...</p>
                        )}
                        {events.map((event, index) => (
                            <div key={`${event.updatedAt}-${index}`} className="border-b border-border py-2 last:border-b-0">
                                <p className="text-sm font-medium">{formatStatus(event.status)}</p>
                                <p className="text-xs text-muted-foreground">{event.updatedAt}</p>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <CustomerBill />
                        <Button variant="outline" onClick={() => navigate("/")}>Go Home</Button>
                        <Button onClick={() => navigate("/upload")}>Start New Job</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
