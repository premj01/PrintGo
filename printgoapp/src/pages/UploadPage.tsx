import { useFileUpload } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UploadCloud, FileText, CheckCircle, AlertCircle, AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function UploadPage() {
    const {
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
    } = useFileUpload();

    return (
        <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center bg-gradient-to-br from-surface via-background to-accent/20 p-6">
            <Card className="w-full max-w-xl animate-fade-in shadow-2xl transition-all hover:shadow-xl">
                <CardHeader className="text-center">
                    <CardTitle className="bg-gradient-to-r from-success to-accent bg-clip-text text-3xl font-bold text-transparent">
                        Upload Your File
                    </CardTitle>
                    <CardDescription>
                        Drag and drop your files here or click to browse
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Drag & Drop Zone */}
                    <div
                        className={cn(
                            "group relative cursor-pointer rounded-2xl border-2 border-dashed p-8 transition-all duration-300",
                            dragOver
                                ? "border-success bg-success/5 shadow-inner"
                                : "border-muted-foreground/30 hover:border-success/60 hover:bg-accent/5"
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={handleZoneClick}
                    >
                        <div className="flex flex-col items-center gap-4">
                            <UploadCloud
                                className={cn(
                                    "h-16 w-16 transition-colors duration-300",
                                    dragOver
                                        ? "text-success"
                                        : "text-muted-foreground group-hover:text-success",
                                    !file && "animate-bounce"
                                )}
                            />

                            {file ? (
                                <div className="flex items-center gap-3">
                                    <FileText className="h-5 w-5 text-success" />
                                    <span className="text-base font-medium text-foreground">
                                        {file.name}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            resetFile();
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
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
                            type="file"
                            ref={inputRef}
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>

                    {/* Upload Button */}
                    <Button
                        onClick={handleUpload}
                        disabled={uploading || !file}
                        size="lg"
                        className={cn(
                            "w-full py-6 text-base font-semibold shadow-lg transition-all duration-300",
                            uploading || !file
                                ? "cursor-not-allowed opacity-50"
                                : "bg-gradient-to-r from-success to-accent text-foreground hover:from-accent hover:to-success hover:shadow-xl hover:-translate-y-0.5"
                        )}
                    >
                        {uploading ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Uploading...
                            </span>
                        ) : (
                            "Upload File"
                        )}
                    </Button>

                    {/* Status Message */}
                    {message && (
                        <div
                            className={cn(
                                "flex items-center gap-3 rounded-lg p-4 animate-fade-in",
                                messageType === "success" && "bg-success/15 text-success",
                                messageType === "error" && "bg-destructive/10 text-destructive",
                                messageType === "warning" && "bg-accent/20 text-foreground"
                            )}
                        >
                            {messageType === "success" && (
                                <CheckCircle className="h-5 w-5 shrink-0" />
                            )}
                            {messageType === "error" && (
                                <AlertCircle className="h-5 w-5 shrink-0" />
                            )}
                            {messageType === "warning" && (
                                <AlertTriangle className="h-5 w-5 shrink-0" />
                            )}
                            <span className="text-sm font-medium">{message}</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
