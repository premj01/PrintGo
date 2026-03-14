// ===== Environment Configuration =====
// Centralized config for all environment-dependent values

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// Derive WebSocket URL from API URL (http→ws, https→wss)
const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

export const ENV = {
    // API base URL (e.g. http://localhost:3000)
    API_BASE_URL,

    // WebSocket base URL (e.g. ws://localhost:3000)
    WS_BASE_URL,

    // Google OAuth
    GOOGLE_CLIENT_ID:
        import.meta.env.VITE_GOOGLE_CLIENT_ID ||
        "160922067134-h5hkb7bt91u2spe1nl4t0h3lo6h3a2vv.apps.googleusercontent.com",
    OAUTH_REDIRECT_URI:
        import.meta.env.VITE_OAUTH_REDIRECT_URI ||
        "http://localhost:5173/oauth-callback",

    // App metadata
    APP_NAME: "PrintGo",
    APP_DESCRIPTION:
        "Automated printing kiosk platform — scan, upload, pay, and print.",
} as const;

// Google OAuth URL builder
export function buildGoogleOAuthUrl(): string {
    const params = new URLSearchParams({
        client_id: ENV.GOOGLE_CLIENT_ID,
        redirect_uri: ENV.OAUTH_REDIRECT_URI,
        response_type: "code",
        scope: "openid email profile",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}