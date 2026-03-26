import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure PDF.js worker using local bundled file
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

interface PdfFullViewerProps {
    blob: Blob;
}

/**
 * Mobile-friendly PDF viewer that renders all pages as canvas elements
 * in a vertically scrollable list.
 */
export default function PdfFullViewer({ blob }: PdfFullViewerProps) {
    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadPdf = async () => {
            setLoading(true);
            setError(null);

            try {
                const arrayBuffer = await blob.arrayBuffer();
                const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

                if (cancelled) {
                    doc.destroy();
                    return;
                }

                setPdfDoc(doc);
            } catch (err) {
                console.error("PdfFullViewer load error:", err);
                if (!cancelled) setError("Could not load PDF document.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadPdf();

        return () => {
            cancelled = true;
            if (pdfDoc) pdfDoc.destroy();
        };
    }, [blob]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 gap-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-success border-t-transparent" />
                <p className="text-sm text-muted-foreground animate-pulse font-medium">
                    Rendering preview for mobile compatibility...
                </p>
            </div>
        );
    }

    if (error || !pdfDoc) {
        return (
            <div className="rounded-xl bg-destructive/10 p-6 text-center text-destructive border border-destructive/20 mx-4">
                <p className="font-semibold">{error ?? "Unable to display PDF preview."}</p>
                <p className="mt-1 text-xs opacity-70 italic font-medium">Try processing the files again.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 items-center bg-muted/30">
            {Array.from({ length: pdfDoc.numPages }, (_, i) => (
                <div key={i} className="w-full max-w-2xl flex flex-col items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground self-start uppercase tracking-widest px-1">
                        Page {i + 1}
                    </span>
                    <div className="w-full bg-white rounded-xl shadow-2xl overflow-hidden border border-border/50 ring-1 ring-black/5 hover:ring-success/30 transition-all duration-300">
                        <FullPageCanvas pdfDoc={pdfDoc} pageIndex={i} />
                    </div>
                </div>
            ))}
        </div>
    );
}

interface FullPageCanvasProps {
    pdfDoc: PDFDocumentProxy;
    pageIndex: number;
}

function FullPageCanvas({ pdfDoc, pageIndex }: FullPageCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [rendered, setRendered] = useState(false);

    const renderPage = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            const page = await pdfDoc.getPage(pageIndex + 1);
            
            // Higher scale for better readability on mobile
            const viewport = page.getViewport({ scale: 1.2 }); 

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // pass both canvas and canvasContext for compatibility
            await page.render({ canvasContext: ctx, canvas, viewport }).promise;
            setRendered(true);
        } catch (err) {
            console.error(`Page ${pageIndex + 1} render failed:`, err);
        }
    }, [pdfDoc, pageIndex]);

    useEffect(() => {
        renderPage();
    }, [renderPage]);

    return (
        <div className="relative w-full flex items-center justify-center min-h-[300px]">
             <canvas
                ref={canvasRef}
                className={`w-full h-auto transition-all duration-700 transform ${
                    rendered ? "opacity-100 scale-100" : "opacity-0 scale-95"
                }`}
            />
            {!rendered && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[2px]">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-success/40 border-t-transparent" />
                </div>
            )}
        </div>
    );
}
