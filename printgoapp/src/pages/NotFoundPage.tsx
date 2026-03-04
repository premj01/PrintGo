import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Home } from "lucide-react";

export default function NotFoundPage() {
    return (
        <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center bg-background px-4">
            <Card className="w-full max-w-md animate-fade-in text-center">
                <CardContent className="flex flex-col items-center gap-6 pt-10 pb-10">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                        <AlertTriangle className="h-10 w-10 text-destructive" />
                    </div>
                    <div>
                        <h1 className="text-5xl font-extrabold text-foreground">404</h1>
                        <p className="mt-2 text-lg text-muted-foreground">
                            Page not found
                        </p>
                    </div>
                    <Button asChild variant="default" className="bg-success text-white hover:bg-success/90">
                        <Link to="/">
                            <Home className="mr-2 h-4 w-4" />
                            Back to Home
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
