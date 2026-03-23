import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure PDF.js worker using local bundled file
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

interface PdfPagePreviewProps {
    file: File;
    selectedPages: Set<number>; // 0-indexed
    onTogglePage: (pageIndex: number) => void;
    onTotalPagesReady: (total: number) => void;
}

/**
 * Renders thumbnail previews of every page of a PDF file.
 * Each thumbnail gets a checkbox overlay (top-left) that reflects
 * whether the page is currently selected for printing.
 */
export default function PdfPagePreview({
    file,
    selectedPages,
    onTogglePage,
    onTotalPagesReady,
}: PdfPagePreviewProps) {
    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load the PDF document once the file changes
    useEffect(() => {
        let cancelled = false;

        const loadPdf = async () => {
            setLoading(true);
            setError(null);

            try {
                const arrayBuffer = await file.arrayBuffer();
                const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

                if (cancelled) {
                    doc.destroy();
                    return;
                }

                setPdfDoc(doc);
                onTotalPagesReady(doc.numPages);
            } catch {
                if (!cancelled) setError("Could not render PDF preview.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadPdf();

        return () => {
            cancelled = true;
        };
        // We intentionally only reload when the File reference changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-success border-t-transparent" />
                    <span className="text-xs text-muted-foreground">Loading preview…</span>
                </div>
            </div>
        );
    }

    if (error || !pdfDoc) {
        return (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                {error ?? "Unable to load PDF."}
            </div>
        );
    }

    return (
        <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
                Page Preview — click thumbnails to select/deselect pages
            </p>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {Array.from({ length: pdfDoc.numPages }, (_, i) => (
                    <PageThumb
                        key={i}
                        pdfDoc={pdfDoc}
                        pageIndex={i}
                        isSelected={selectedPages.has(i)}
                        onToggle={() => onTogglePage(i)}
                    />
                ))}
            </div>
        </div>
    );
}

/* ---------- individual page thumbnail ---------- */

interface PageThumbProps {
    pdfDoc: PDFDocumentProxy;
    pageIndex: number;
    isSelected: boolean;
    onToggle: () => void;
}

function PageThumb({ pdfDoc, pageIndex, isSelected, onToggle }: PageThumbProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [rendered, setRendered] = useState(false);

    const renderPage = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            const page = await pdfDoc.getPage(pageIndex + 1); // pdfjs is 1-indexed
            const viewport = page.getViewport({ scale: 0.5 }); // small thumbnails

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            await page.render({ canvasContext: ctx, canvas, viewport }).promise;
            setRendered(true);
        } catch {
            // silently fail for individual page renders
        }
    }, [pdfDoc, pageIndex]);

    useEffect(() => {
        renderPage();
    }, [renderPage]);

    return (
        <button
            type="button"
            onClick={onToggle}
            className={`
                group relative flex flex-col items-center overflow-hidden rounded-lg 
                border-2 transition-all duration-200 cursor-pointer
                ${isSelected
                    ? "border-success shadow-[0_0_0_1px_var(--c-success)] bg-success/5"
                    : "border-border hover:border-muted-foreground/50 bg-card opacity-50"
                }
            `}
            title={`Page ${pageIndex + 1} — Click to ${isSelected ? "deselect" : "select"}`}
        >
            {/* Checkbox overlay */}
            <div className="absolute top-1.5 left-1.5 z-10">
                <div
                    className={`
                        flex h-5 w-5 items-center justify-center rounded 
                        border-2 transition-all duration-200
                        ${isSelected
                            ? "border-success bg-success text-success-foreground"
                            : "border-muted-foreground/40 bg-card/80 backdrop-blur-sm"
                        }
                    `}
                >
                    {isSelected && (
                        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                            <path
                                d="M2 6l3 3 5-5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}
                </div>
            </div>

            {/* Canvas preview */}
            <div className="relative w-full aspect-[3/4] bg-white flex items-center justify-center">
                <canvas
                    ref={canvasRef}
                    className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${
                        rendered ? "opacity-100" : "opacity-0"
                    }`}
                />
                {!rendered && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-success/50 border-t-transparent" />
                    </div>
                )}
            </div>

            {/* Page number label */}
            <div
                className={`
                    w-full py-1 text-center text-[10px] font-semibold transition-colors duration-200
                    ${isSelected
                        ? "bg-success/10 text-success"
                        : "bg-muted/50 text-muted-foreground"
                    }
                `}
            >
                {pageIndex + 1}
            </div>
        </button>
    );
}
