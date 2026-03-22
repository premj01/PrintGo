import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useKioskSession } from "@/hooks";
import { STORAGE_KEYS } from "@/config/constants";
import { kioskPrintService } from "@/services";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Printer } from "lucide-react";

const inflightKioskAuthSessions = new Set<string>();

/**
 * KioskRedirectPage
 *
 * This page is accessed when a user scans a QR code on the physical kiosk.
 * It captures the `userSessionNumber` from the URL parameters,
 * stores it in localStorage, then redirects to the upload page.
 *
 * NOTE: This page does NOT require authentication.
 */
export default function KioskRedirectPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setSessionNumber } = useKioskSession();
    const [statusText, setStatusText] = useState("Connecting to your kiosk...");

    useEffect(() => {
        let isCancelled = false;

        const authenticate = async () => {
            const sessionNumber =
                searchParams.get("userSessionNumber") ??
                searchParams.get("userSessionUUID");

            if (!sessionNumber) {
                setStatusText("Missing kiosk session. Redirecting...");
                navigate("/", { replace: true });
                return;
            }

            // const existingToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
            // const existingAuthedSession = localStorage.getItem(STORAGE_KEYS.KIOSK_AUTH_SESSION);

            // if (existingAuthedSession === sessionNumber) {
            //     setSessionNumber(sessionNumber);
            //     setStatusText("Session already verified. Opening upload page...");
            //     navigate("/upload", { replace: true });
            //     return;
            // }

            if (inflightKioskAuthSessions.has(sessionNumber)) {
                setStatusText("Verifying kiosk session...");
                return;
            }

            try {
                inflightKioskAuthSessions.add(sessionNumber);
                setStatusText("Verifying kiosk session...");
                setSessionNumber(sessionNumber);
                const response = await kioskPrintService.authenticateKioskSession(sessionNumber);

                if (isCancelled) {
                    return;
                }

                setStatusText("Connected. Opening upload page...");
                localStorage.setItem(STORAGE_KEYS.TOKEN, response.token);
                localStorage.setItem(STORAGE_KEYS.KIOSK_AUTH_SESSION, sessionNumber);

                window.setTimeout(() => {
                    if (!isCancelled) {
                        navigate("/upload", { replace: true });
                    }
                }, 600);
            } catch (error) {
                console.error("Kiosk authentication failed:", error);

                if (isCancelled) {
                    return;
                }

                setStatusText("Unable to connect. Redirecting...");
                window.setTimeout(() => {
                    if (!isCancelled) {
                        navigate("/", { replace: true });
                    }
                }, 1000);
            } finally {
                inflightKioskAuthSessions.delete(sessionNumber);
            }
        };

        const timerId = window.setTimeout(() => {
            authenticate();
        }, 250);

        return () => {
            isCancelled = true;
            window.clearTimeout(timerId);
        };
    }, [searchParams, navigate, setSessionNumber]);

    return (
        <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center bg-background px-4">
            <Card className="w-full max-w-sm animate-fade-in">
                <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
                    <div className="relative">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
                            <Printer className="h-8 w-8 text-success" />
                        </div>
                        <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 animate-spin text-accent" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">Welcome</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {statusText}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
