// ===== User Types =====
export interface User {
    email: string;
    name: string;
    picture: string;
}

// ===== Auth Types =====
export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

export interface AuthContextType extends AuthState {
    login: (code: string) => Promise<void>;
    logout: () => void;
    setUser: (user: User) => void;
}

// ===== API Response Types =====
export interface AuthResponse {
    token: string;
    user: User;
}

export interface ApiError {
    error: string;
    message?: string;
    statusCode?: number;
}

// ===== Upload Types =====
export interface UploadResponse {
    success: boolean;
    message: string;
    fileId?: string;
    fileName?: string;
    uploaded?: Array<{
        fileName: string;
        originalName: string;
        size: number;
        url: string;
    }>;
}

export interface S3UploadUrlResponse {
    success: boolean;
    uploadUrl: string;
    fileKey: string;
    expiresIn: number;
}

export interface KioskAuthResponse {
    msg: string;
    token: string;
    kioskId: string;
}

export interface FilePrintConfig {
    fileId: string;
    fileName: string;
    copies: number;
    orientation: "portrait" | "landscape";
    paperSize: "A4" | "Letter" | "Legal";
    pageRanges: string;
    fitToPage: boolean;
    colorMode: "monochrome" | "color";
}

export interface MergedPdfMeta {
    bwPageCount: number;
    colorPageCount: number;
    totalPages: number;
    bwRanges: string;
    colorRanges: string;
    sourceFiles: Array<{
        fileName: string;
        selectedPages: number;
        colorMode: "monochrome" | "color";
        copies: number;
    }>;
}

export interface PrintStatusPayload {
    sessionId: string;
    status: string;
    kioskId?: string | null;
    fileKey?: string;
    fileName?: string;
    details?: unknown;
    updatedAt: string;
}

export interface DownloadStatusResponse {
    success: boolean;
    s3UploadStatus: string;
    kioskDownloadStatus: string;
    fileName?: string;
    isDownloaded: boolean;
    isPrintStarted: boolean;
    isPrinted: boolean;
    paymentStatus?: string;
    updatedAt?: string;
}

// ===== Route Types =====
export interface NavLink {
    label: string;
    href: string;
    requiresAuth?: boolean;
}

// ===== Kiosk Types =====
export interface KioskSession {
    userSessionNumber: string;
}
