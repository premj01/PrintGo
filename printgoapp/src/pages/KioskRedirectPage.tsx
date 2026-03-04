import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useKioskSession } from "@/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Printer } from "lucide-react";

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

    useEffect(() => {
        const sessionNumber = searchParams.get("userSessionNumber");
        if (sessionNumber) {
            setSessionNumber(sessionNumber);
        }

        const timer = setTimeout(() => {
            navigate("/upload", { replace: true });
        }, 2000);

        return () => clearTimeout(timer);
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
                            Connecting to your kiosk...
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
