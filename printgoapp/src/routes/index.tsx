import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "@/components/layout";

// Pages
import HomePage from "@/pages/HomePage";
import { LoginPage, OAuthCallbackPage } from "@/pages/auth";
import UploadPage from "@/pages/UploadPage";
import ContactPage from "@/pages/ContactPage";
import KioskRedirectPage from "@/pages/KioskRedirectPage";
import NotFoundPage from "@/pages/NotFoundPage";

/**
 * Application Route Configuration
 *
 * Public routes (no auth required):
 * - /              → Home page
 * - /upload        → File upload (kiosk flow — no auth needed)
 * - /contact       → Contact page
 * - /kioskRedirect → QR scan redirect (no auth needed)
 *
 * Auth routes:
 * - /auth          → Google OAuth login page
 * - /oauth-callback → OAuth callback handler
 */
export const router = createBrowserRouter([
    {
        path: "/",
        element: <RootLayout />,
        children: [
            { index: true, element: <HomePage /> },
            { path: "auth", element: <LoginPage /> },
            { path: "upload", element: <UploadPage /> },
            { path: "contact", element: <ContactPage /> },
            { path: "*", element: <NotFoundPage /> },
        ],
    },
    // Routes outside the main layout (no Navbar/Footer)
    { path: "/kioskRedirect", element: <KioskRedirectPage /> },
    { path: "/oauth-callback", element: <OAuthCallbackPage /> },
]);
