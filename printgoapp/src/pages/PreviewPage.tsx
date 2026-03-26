import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { STORAGE_KEYS } from "@/config/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { get as idbGet } from "idb-keyval";
import type { MergedPdfMeta } from "@/types";

import PdfFullViewer from "@/components/PdfFullViewer";

export default function PreviewPage() {
    const navigate = useNavigate();

    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        idbGet<Blob>(STORAGE_KEYS.MERGED_PDF_BASE64)
            .then(blob => {
                if (blob) {
                    setPdfBlob(blob);
                }
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

    if (!isLoaded) {
        return (
            <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center p-12 gap-6 bg-surface/50">
                 <div className="h-14 w-14 animate-spin rounded-full border-4 border-success border-t-transparent shadow-xl shadow-success/20" />
                <p className="text-lg font-semibold text-foreground/80 animate-pulse tracking-tight text-center">
                    Generating High-Quality <br/> Preview...
                </p>
            </div>
        );
    }

    if (!pdfBlob || !meta) {
        return (
            <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-6">
                <Card className="w-full max-w-xl border-dashed border-muted-foreground/30 bg-muted/10 shadow-none">
                    <CardHeader className="text-center">
                         <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-2">
                             <svg className="h-8 w-8 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                 <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
                             </svg>
                         </div>
                        <CardTitle className="text-foreground/90 font-bold">No Preview Data</CardTitle>
                        <CardDescription className="text-muted-foreground font-medium">Please process files from upload page first.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Button onClick={() => navigate("/upload")} className="bg-success text-success-foreground hover:bg-success/90 shadow-md">Go To Upload</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-10rem)] bg-gradient-to-br from-surface via-background to-accent/20 p-6 flex flex-col items-center">
            <Card className="w-full max-w-5xl shadow-2xl border-none ring-1 ring-black/5 bg-card/80 backdrop-blur-xl overflow-hidden transition-all duration-500 hover:shadow-success/10">
                <CardHeader className="border-b bg-card/50 px-8 py-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                             <CardTitle className="text-3xl font-extrabold bg-gradient-to-r from-success to-accent bg-clip-text text-transparent">
                                 Merged PDF Preview
                             </CardTitle>
                             <CardDescription className="font-semibold text-muted-foreground mt-1 text-sm tracking-wide">
                                 Generated successfully with {meta.totalPages} pages
                             </CardDescription>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 bg-success/10 rounded-full border border-success/20 self-start shadow-sm shadow-success/10">
                             <div className="flex flex-col items-center px-2">
                                 <span className="text-[10px] font-bold text-success/60 uppercase">B/W Docs</span>
                                 <span className="text-sm font-black text-success">{meta.bwPageCount}</span>
                             </div>
                             <div className="h-6 w-px bg-success/20" />
                             <div className="flex flex-col items-center px-2">
                                 <span className="text-[10px] font-bold text-accent/60 uppercase">Color Docs</span>
                                 <span className="text-sm font-black text-accent">{meta.colorPageCount}</span>
                             </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex flex-col">
                    <div className="h-[65vh] md:h-[70vh] overflow-y-auto custom-scrollbar bg-muted/40 inner-shadow">
                        <PdfFullViewer blob={pdfBlob} />
                    </div>

                    <div className="flex flex-wrap gap-4 p-6 bg-card border-t border-border/50 justify-between items-center">
                        <div className="text-xs text-muted-foreground font-medium italic opacity-70 flex items-center gap-1">
                             <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                 <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                             </svg>
                             Securely rendered on your device
                        </div>
                        <div className="flex gap-4">
                            <Button variant="outline" onClick={() => navigate("/upload")} className="font-bold border-muted-foreground/20 hover:bg-muted/10 px-6">
                                Back To Upload
                            </Button>
                            <Button onClick={() => navigate("/payment")} className="font-black bg-gradient-to-r from-success to-accent text-foreground hover:shadow-xl hover:shadow-success/20 hover:-translate-y-0.5 transition-all duration-300 px-8">
                                Continue To Payment
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
