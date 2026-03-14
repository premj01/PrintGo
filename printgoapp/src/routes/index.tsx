import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "@/components/layout";

// Pages
import HomePage from "@/pages/HomePage";
import { LoginPage, OAuthCallbackPage } from "@/pages/auth";
import UploadPage from "@/pages/UploadPage";
import ContactPage from "@/pages/ContactPage";
import KioskRedirectPage from "@/pages/KioskRedirectPage";
import NotFoundPage from "@/pages/NotFoundPage";

// Admin Contexts & Pages
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { AdminSocketProvider } from "@/contexts/AdminSocketContext";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import AdminSignupPage from "@/pages/admin/AdminSignupPage";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminRegionPage from "@/pages/admin/AdminRegionPage";
import AdminKioskDetailPage from "@/pages/admin/AdminKioskDetailPage";
import AdminAccountsPage from "@/pages/admin/AdminAccountsPage";

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

    // Admin Routes
    { path: "/admin/login", element: <AdminAuthProvider><AdminLoginPage /></AdminAuthProvider> },
    { path: "/admin/signup", element: <AdminSignupPage /> },
    {
        path: "/admin",
        element: (
            <AdminAuthProvider>
                <AdminSocketProvider>
                    <AdminLayout />
                </AdminSocketProvider>
            </AdminAuthProvider>
        ),
        children: [
            { index: true, element: <AdminDashboardPage /> },
            { path: "regions", element: <AdminDashboardPage /> }, // Region index is part of dashboard for now
            { path: "regions/:regionName", element: <AdminRegionPage /> },
            { path: "kiosk/:kioskId", element: <AdminKioskDetailPage /> },
            { path: "accounts", element: <AdminAccountsPage /> }
        ]
    }
]);
