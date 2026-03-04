import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function OAuthCallbackPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const code = searchParams.get("code");
        if (!code) return;

        const handleCallback = async () => {
            try {
                await login(code);
                navigate("/", { replace: true });
            } catch (error) {
                console.error("OAuth callback failed:", error);
                navigate("/auth", { replace: true });
            }
        };

        handleCallback();
    }, [searchParams, login, navigate]);

    return (
        <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center bg-background px-4">
            <Card className="w-full max-w-sm animate-fade-in">
                <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-success" />
                    <div>
                        <h1 className="text-xl font-semibold">Authenticating...</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Please wait while we sign you in.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
