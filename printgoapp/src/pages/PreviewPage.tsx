import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { STORAGE_KEYS } from "@/config/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { MergedPdfMeta } from "@/types";

export default function PreviewPage() {
    const navigate = useNavigate();

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

    if (!mergedPdfBase64 || !meta) {
        return (
            <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-6">
                <Card className="w-full max-w-xl">
                    <CardHeader>
                        <CardTitle>No Preview Data</CardTitle>
                        <CardDescription>Please process files from upload page first.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate("/upload")}>Go To Upload</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const previewSrc = `data:application/pdf;base64,${mergedPdfBase64}`;

    return (
        <div className="min-h-[calc(100vh-10rem)] bg-gradient-to-br from-surface via-background to-accent/20 p-6">
            <Card className="mx-auto w-full max-w-5xl shadow-xl">
                <CardHeader>
                    <CardTitle>Merged PDF Preview</CardTitle>
                    <CardDescription>
                        Total: {meta.totalPages} pages | B/W: {meta.bwPageCount} ({meta.bwRanges || "none"}) |
                        Color: {meta.colorPageCount} ({meta.colorRanges || "none"})
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="h-[65vh] overflow-hidden rounded-lg border border-border bg-muted/20">
                        <iframe title="Merged PDF Preview" src={previewSrc} className="h-full w-full" />
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" onClick={() => navigate("/upload")}>Back To Upload</Button>
                        <Button onClick={() => navigate("/payment")}>Continue To Payment</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
