import { ENV } from "@/config/env";
import { Printer } from "lucide-react";

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="mt-auto border-t border-border/40 bg-footer text-text-primary">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                    {/* Brand */}
                    <div className="flex items-center gap-2">
                        <Printer className="h-5 w-5" />
                        <span className="font-semibold">{ENV.APP_NAME}</span>
                    </div>

                    {/* Copyright */}
                    <p className="text-sm text-text-primary/70">
                        &copy; {currentYear} {ENV.APP_NAME}. All rights reserved.
                    </p>

                    {/* Tagline */}
                    <p className="text-xs text-text-primary/50">
                        Designed for mobile browsers.
                    </p>
                </div>
            </div>
        </footer>
    );
}
