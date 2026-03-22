import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PDFDocument } from "pdf-lib";
import { STORAGE_KEYS } from "@/config/constants";
import type { FilePrintConfig, MergedPdfMeta } from "@/types";

const PAPER_SIZES = {
    A4: { width: 595.28, height: 841.89 },
    Letter: { width: 612, height: 792 },
    Legal: { width: 612, height: 1008 },
} as const;

const defaultConfig = (file: File): FilePrintConfig => ({
    fileId: `${file.name}-${file.size}-${file.lastModified}`,
    fileName: file.name,
    copies: 1,
    orientation: "portrait",
    paperSize: "A4",
    pageRanges: "",
    fitToPage: true,
    colorMode: "monochrome",
});

function parsePageRanges(rangeText: string, totalPages: number): number[] {
    if (!rangeText.trim()) {
        return Array.from({ length: totalPages }, (_, i) => i);
    }

    const selected = new Set<number>();
    const parts = rangeText.split(",").map((part) => part.trim()).filter(Boolean);

    for (const part of parts) {
        if (part.includes("-")) {
            const [startRaw, endRaw] = part.split("-");
            const start = Number(startRaw);
            const end = Number(endRaw);
            if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
            const from = Math.max(1, Math.min(start, end));
            const to = Math.min(totalPages, Math.max(start, end));

            for (let page = from; page <= to; page += 1) {
                selected.add(page - 1);
            }
            continue;
        }

        const page = Number(part);
        if (Number.isInteger(page) && page >= 1 && page <= totalPages) {
            selected.add(page - 1);
        }
    }

    return [...selected].sort((a, b) => a - b);
}

function numberRanges(pages: number[]): string {
    if (pages.length === 0) return "";

    const sorted = [...pages].sort((a, b) => a - b);
    const chunks: string[] = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i += 1) {
        const curr = sorted[i];
        if (curr === prev + 1) {
            prev = curr;
            continue;
        }
        chunks.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = curr;
        prev = curr;
    }

    chunks.push(start === prev ? `${start}` : `${start}-${prev}`);
    return chunks.join(",");
}

function uint8ToBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

async function mergeConfiguredPdfs(files: File[], configs: FilePrintConfig[]) {
    const merged = await PDFDocument.create();

    const bwQueue: Array<{
        source: PDFDocument;
        sourcePageIndex: number;
        config: FilePrintConfig;
        fileName: string;
    }> = [];
    const colorQueue: Array<{
        source: PDFDocument;
        sourcePageIndex: number;
        config: FilePrintConfig;
        fileName: string;
    }> = [];
    const sourceFilesMeta: MergedPdfMeta["sourceFiles"] = [];

    for (const file of files) {
        const config = configs.find((item) => item.fileName === file.name);
        if (!config) continue;

        const bytes = await file.arrayBuffer();
        const sourcePdf = await PDFDocument.load(bytes);
        const totalPages = sourcePdf.getPageCount();
        const selected = parsePageRanges(config.pageRanges, totalPages);

        sourceFilesMeta.push({
            fileName: file.name,
            selectedPages: selected.length,
            colorMode: config.colorMode,
            copies: config.copies,
        });

        for (let copy = 0; copy < config.copies; copy += 1) {
            for (const sourcePageIndex of selected) {
                const target = config.colorMode === "color" ? colorQueue : bwQueue;
                target.push({ source: sourcePdf, sourcePageIndex, config, fileName: file.name });
            }
        }
    }

    const bwFinalPages: number[] = [];
    const colorFinalPages: number[] = [];
    const pagePlan = [...bwQueue, ...colorQueue];

    for (let i = 0; i < pagePlan.length; i += 1) {
        const plan = pagePlan[i];
        const pageNumber = i + 1;

        const sourcePage = plan.source.getPage(plan.sourcePageIndex);
        const { width: sourceWidth, height: sourceHeight } = sourcePage.getSize();
        const paper = PAPER_SIZES[plan.config.paperSize] || PAPER_SIZES.A4;

        const baseWidth = plan.config.orientation === "landscape" ? paper.height : paper.width;
        const baseHeight = plan.config.orientation === "landscape" ? paper.width : paper.height;

        const [embeddedPage] = await merged.embedPages([sourcePage]);

        const targetPage = merged.addPage([baseWidth, baseHeight]);
        const fitScale = Math.min(baseWidth / sourceWidth, baseHeight / sourceHeight);
        const drawScale = plan.config.fitToPage ? fitScale : Math.min(1, fitScale);

        const drawWidth = sourceWidth * drawScale;
        const drawHeight = sourceHeight * drawScale;
        const x = (baseWidth - drawWidth) / 2;
        const y = (baseHeight - drawHeight) / 2;

        targetPage.drawPage(embeddedPage, { x, y, width: drawWidth, height: drawHeight });

        if (plan.config.colorMode === "color") {
            colorFinalPages.push(pageNumber);
        } else {
            bwFinalPages.push(pageNumber);
        }
    }

    const mergedBytes = await merged.save();
    const meta: MergedPdfMeta = {
        bwPageCount: bwFinalPages.length,
        colorPageCount: colorFinalPages.length,
        totalPages: bwFinalPages.length + colorFinalPages.length,
        bwRanges: numberRanges(bwFinalPages),
        colorRanges: numberRanges(colorFinalPages),
        sourceFiles: sourceFilesMeta,
    };

    return { mergedBytes, meta };
}

export default function UploadPage() {
    const navigate = useNavigate();
    const [files, setFiles] = useState<File[]>([]);
    const [configs, setConfigs] = useState<FilePrintConfig[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState("");

    const totalSelectedFiles = useMemo(() => files.length, [files.length]);

    const syncNewFiles = (incoming: File[]) => {
        const onlyPdfs = incoming.filter((file) => file.type === "application/pdf");
        setFiles(onlyPdfs);
        setConfigs(onlyPdfs.map(defaultConfig));
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        syncNewFiles(Array.from(e.dataTransfer.files || []));
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        syncNewFiles(Array.from(e.target.files || []));
    };

    const updateConfig = (fileName: string, patch: Partial<FilePrintConfig>) => {
        setConfigs((prev) => prev.map((cfg) => (cfg.fileName === fileName ? { ...cfg, ...patch } : cfg)));
    };

    const handleProcess = async () => {
        if (!files.length) {
            setMessage("Please select at least one PDF file.");
            return;
        }

        try {
            setProcessing(true);
            setMessage("");

            const { mergedBytes, meta } = await mergeConfiguredPdfs(files, configs);

            if (meta.totalPages === 0) {
                setMessage("No printable pages selected. Please update page ranges.");
                return;
            }

            localStorage.setItem(STORAGE_KEYS.MERGED_PDF_BASE64, uint8ToBase64(mergedBytes));
            localStorage.setItem(STORAGE_KEYS.MERGED_PDF_META, JSON.stringify(meta));

            navigate("/preview");
        } catch (error) {
            console.error(error);
            setMessage("Failed to merge PDFs. Please verify files and page ranges.");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-10rem)] bg-gradient-to-br from-surface via-background to-accent/20 p-6">
            <Card className="mx-auto w-full max-w-4xl animate-fade-in shadow-2xl transition-all hover:shadow-xl">
                <CardHeader className="text-center">
                    <CardTitle className="bg-gradient-to-r from-success to-accent bg-clip-text text-3xl font-bold text-transparent">
                        Build Your Print Job
                    </CardTitle>
                    <CardDescription>
                        Upload multiple PDFs, configure print options per file, then process.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div
                        className={cn(
                            "group relative cursor-pointer rounded-2xl border-2 border-dashed p-8 transition-all duration-300",
                            dragOver
                                ? "border-success bg-success/5 shadow-inner"
                                : "border-muted-foreground/30 hover:border-success/60 hover:bg-accent/5"
                        )}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => {
                            const input = document.getElementById("pdf-multi-input");
                            input?.click();
                        }}
                    >
                        <div className="flex flex-col items-center gap-4">
                            <UploadCloud
                                className={cn(
                                    "h-16 w-16 transition-colors duration-300",
                                    dragOver
                                        ? "text-success"
                                        : "text-muted-foreground group-hover:text-success",
                                    !files.length && "animate-bounce"
                                )}
                            />

                            {files.length ? (
                                <p className="text-base font-medium text-foreground">
                                    {totalSelectedFiles} PDF file{totalSelectedFiles > 1 ? "s" : ""} selected
                                </p>
                            ) : (
                                <div className="text-center">
                                    <p className="text-base font-medium text-foreground">
                                        Drop your file here, or{" "}
                                        <span className="text-success">browse</span>
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Support for any file type
                                    </p>
                                </div>
                            )}
                        </div>

                        <input
                            id="pdf-multi-input"
                            type="file"
                            multiple
                            accept="application/pdf"
                            onChange={handleFileInput}
                            className="hidden"
                        />
                    </div>

                    {configs.map((cfg, index) => (
                        <details
                            key={cfg.fileId}
                            className="rounded-xl border border-border bg-card p-4"
                            open={index === 0}
                        >
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground">
                                <span className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-success" />
                                    {cfg.fileName}
                                </span>
                                <span className="text-xs text-muted-foreground">File #{index + 1}</span>
                            </summary>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <label className="text-sm">
                                    <span className="mb-1 block text-muted-foreground">Copies</span>
                                    <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={cfg.copies}
                                        onChange={(e) =>
                                            updateConfig(cfg.fileName, {
                                                copies: Math.max(1, Number(e.target.value) || 1),
                                            })
                                        }
                                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                                    />
                                </label>

                                <label className="text-sm">
                                    <span className="mb-1 block text-muted-foreground">Orientation</span>
                                    <select
                                        value={cfg.orientation}
                                        onChange={(e) =>
                                            updateConfig(cfg.fileName, {
                                                orientation: e.target.value as FilePrintConfig["orientation"],
                                            })
                                        }
                                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                                    >
                                        <option value="portrait">portrait</option>
                                        <option value="landscape">landscape</option>
                                    </select>
                                </label>

                                <label className="text-sm">
                                    <span className="mb-1 block text-muted-foreground">Paper Size</span>
                                    <select
                                        value={cfg.paperSize}
                                        onChange={(e) =>
                                            updateConfig(cfg.fileName, {
                                                paperSize: e.target.value as FilePrintConfig["paperSize"],
                                            })
                                        }
                                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                                    >
                                        <option value="A4">A4</option>
                                        <option value="Letter">Letter</option>
                                        <option value="Legal">Legal</option>
                                    </select>
                                </label>

                                <label className="text-sm">
                                    <span className="mb-1 block text-muted-foreground">Color Mode</span>
                                    <select
                                        value={cfg.colorMode}
                                        onChange={(e) =>
                                            updateConfig(cfg.fileName, {
                                                colorMode: e.target.value as FilePrintConfig["colorMode"],
                                            })
                                        }
                                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                                    >
                                        <option value="monochrome">monochrome</option>
                                        <option value="color">color</option>
                                    </select>
                                </label>

                                <label className="md:col-span-2 text-sm">
                                    <span className="mb-1 block text-muted-foreground">Page Ranges (e.g. 1-3,5)</span>
                                    <input
                                        value={cfg.pageRanges}
                                        onChange={(e) => updateConfig(cfg.fileName, { pageRanges: e.target.value })}
                                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                                        placeholder="Leave empty for all pages"
                                    />
                                </label>

                                <label className="flex items-center gap-2 text-sm md:col-span-2">
                                    <input
                                        type="checkbox"
                                        checked={cfg.fitToPage}
                                        onChange={(e) => updateConfig(cfg.fileName, { fitToPage: e.target.checked })}
                                    />
                                    Fit pages to selected paper size
                                </label>
                            </div>
                        </details>
                    ))}

                    <Button
                        onClick={handleProcess}
                        disabled={processing || !files.length}
                        size="lg"
                        className={cn(
                            "w-full py-6 text-base font-semibold shadow-lg transition-all duration-300",
                            processing || !files.length
                                ? "cursor-not-allowed opacity-50"
                                : "bg-gradient-to-r from-success to-accent text-foreground hover:from-accent hover:to-success hover:shadow-xl hover:-translate-y-0.5"
                        )}
                    >
                        {processing ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Processing PDFs...
                            </span>
                        ) : (
                            "Process And Preview"
                        )}
                    </Button>

                    {message && (
                        <div className="rounded-lg bg-destructive/10 p-4 text-sm font-medium text-destructive animate-fade-in">
                            {message}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}