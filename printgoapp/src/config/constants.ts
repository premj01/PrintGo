import type { NavLink } from "@/types";

// Navigation links configuration
export const NAV_LINKS: NavLink[] = [
    { label: "Home", href: "/", requiresAuth: false },
    { label: "Upload", href: "/upload", requiresAuth: false },
    { label: "Contact", href: "/contact", requiresAuth: false },
];

// Storage keys
export const STORAGE_KEYS = {
    TOKEN: "printgo_token",
    USER: "printgo_user",
    KIOSK_SESSION: "userSessionNumber",
    KIOSK_AUTH_SESSION: "printgo_kiosk_auth_session",
    THEME: "printgo_theme",
    MERGED_PDF_BASE64: "printgo_merged_pdf_base64",
    MERGED_PDF_META: "printgo_merged_pdf_meta",
    UPLOADED_FILE_NAME: "printgo_uploaded_file_name",
} as const;
