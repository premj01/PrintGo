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
    THEME: "printgo_theme",
} as const;
