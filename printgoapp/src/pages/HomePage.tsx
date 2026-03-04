import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    QrCode,
    Upload,
    FileCheck,
    Palette,
    CreditCard,
    Printer,
    ArrowRight,
    ArrowDown,
    Zap,
    Shield,
    Clock,
    Smartphone,
    ChevronDown,
} from "lucide-react";

// ===== The 6 Steps — simple and clear =====
const steps = [
    {
        icon: QrCode,
        title: "Scan QR",
        description: "Scan the code on the kiosk with your phone camera",
        emoji: "📱",
    },
    {
        icon: Upload,
        title: "Upload Files",
        description: "Upload PDF, images, or documents from your phone",
        emoji: "📄",
    },
    {
        icon: FileCheck,
        title: "Select Pages",
        description: "Choose which pages you want to print",
        emoji: "📋",
    },
    {
        icon: Palette,
        title: "Pick Options",
        description: "Color or B&W, single or double-sided, copies",
        emoji: "🎨",
    },
    {
        icon: CreditCard,
        title: "Pay",
        description: "Quick payment via UPI, card, or wallet",
        emoji: "💳",
    },
    {
        icon: Printer,
        title: "Collect Print",
        description: "Your prints come out automatically!",
        emoji: "✅",
    },
];

const whyUs = [
    { icon: Zap, title: "No Queues", desc: "Walk up, print, walk away" },
    { icon: Clock, title: "Under 2 Min", desc: "Entire process is super fast" },
    { icon: Smartphone, title: "No App Needed", desc: "Just your phone camera" },
    { icon: Shield, title: "100% Private", desc: "Files auto-delete after printing" },
];

export default function HomePage() {
    return (
        <div className="min-h-screen">
            {/* ======== HERO ======== */}
            <section className="relative overflow-hidden bg-background px-4 pb-10 pt-14 md:pb-16 md:pt-20">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-success/8 blur-3xl" />
                    <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
                </div>

                <div className="relative mx-auto max-w-3xl text-center">
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-1.5 text-sm font-medium text-success">
                        <Printer className="h-4 w-4" />
                        Self-Service Printing Kiosk
                    </div>

                    <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl">
                        Scan.{" "}
                        <span className="bg-gradient-to-r from-success to-accent bg-clip-text text-transparent">
                            Upload.
                        </span>{" "}
                        Print.
                    </h1>

                    <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
                        No apps, no sign-ups, no waiting. Just scan a QR code at the kiosk
                        and get your prints in under 2 minutes.
                    </p>

                    <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Button
                            asChild
                            size="lg"
                            className="bg-success px-8 text-white shadow-lg shadow-success/25 hover:bg-success/90"
                        >
                            <Link to="/upload">
                                Try It Now
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="lg">
                            <Link to="/contact">Deploy a Kiosk</Link>
                        </Button>
                    </div>

                    {/* Scroll hint */}
                    <div className="mt-12 flex flex-col items-center text-muted-foreground">
                        <span className="text-sm">See how it works</span>
                        <ChevronDown className="mt-1 h-5 w-5 animate-bounce" />
                    </div>
                </div>
            </section>

            {/* ======== HOW IT WORKS — SIMPLE VISUAL FLOW ======== */}
            <section className="bg-surface px-4 py-16 md:py-24" id="how-it-works">
                <div className="mx-auto max-w-4xl">
                    <div className="mb-14 text-center">
                        <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                            How It Works
                        </h2>
                        <p className="mt-3 text-muted-foreground">
                            6 simple steps — that's all it takes
                        </p>
                    </div>

                    {/* ===== STEP FLOW ===== */}
                    <div className="flex flex-col items-center">
                        {steps.map((step, i) => (
                            <div key={step.title} className="flex w-full flex-col items-center">
                                {/* Step Card */}
                                <div className="w-full max-w-lg">
                                    <Card className="group relative overflow-hidden border-none bg-card shadow-md transition-all duration-300 hover:shadow-xl">
                                        <CardContent className="flex items-center gap-5 p-5 md:p-6">
                                            {/* Step Number + Icon */}
                                            <div className="relative flex-shrink-0">
                                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/12 transition-colors group-hover:bg-success/20">
                                                    <step.icon className="h-8 w-8 text-success" />
                                                </div>
                                                <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background shadow-sm">
                                                    {i + 1}
                                                </span>
                                            </div>

                                            {/* Text */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-bold text-foreground">
                                                    {step.title}
                                                </h3>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {step.description}
                                                </p>
                                            </div>

                                            {/* Emoji visual hint */}
                                            <span className="hidden text-3xl sm:block" role="img">
                                                {step.emoji}
                                            </span>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Arrow connector between steps */}
                                {i < steps.length - 1 && (
                                    <div className="flex flex-col items-center py-2">
                                        <div className="h-4 w-px bg-success/30" />
                                        <ArrowDown className="h-5 w-5 text-success/50" />
                                        <div className="h-4 w-px bg-success/30" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* ===== DONE CELEBRATION ===== */}
                    <div className="mt-10 flex flex-col items-center text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20 text-3xl">
                            🎉
                        </div>
                        <p className="mt-3 text-lg font-semibold text-foreground">
                            That's it — you're done!
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            The whole process takes less than 2 minutes
                        </p>
                    </div>
                </div>
            </section>

            {/* ======== COMPACT FLOW STRIP (visual summary) ======== */}
            <section className="bg-background px-4 py-10">
                <div className="mx-auto max-w-4xl">
                    {/* Desktop: horizontal row */}
                    <div className="hidden md:flex md:items-center md:justify-center md:gap-2">
                        {steps.map((step, i) => (
                            <div key={step.title} className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm shadow-sm">
                                    <step.icon className="h-3.5 w-3.5 text-success" />
                                    <span className="font-medium text-foreground whitespace-nowrap">
                                        {step.title}
                                    </span>
                                </div>
                                {i < steps.length - 1 && (
                                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                            </div>
                        ))}
                    </div>
                    {/* Mobile: 2-column grid */}
                    <div className="grid grid-cols-2 gap-2 md:hidden">
                        {steps.map((step, i) => (
                            <div
                                key={step.title}
                                className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-sm shadow-sm"
                            >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-[10px] font-bold text-success">
                                    {i + 1}
                                </span>
                                <span className="font-medium text-foreground truncate">
                                    {step.title}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ======== WHY PRINTGO ======== */}
            <section className="bg-surface px-4 py-16 md:py-20">
                <div className="mx-auto max-w-4xl">
                    <h2 className="mb-10 text-center text-3xl font-bold text-foreground">
                        Why PrintGo?
                    </h2>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                        {whyUs.map((item) => (
                            <Card
                                key={item.title}
                                className="border-none bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
                            >
                                <CardContent className="flex flex-col items-center p-5 text-center">
                                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-success/12">
                                        <item.icon className="h-5 w-5 text-success" />
                                    </div>
                                    <h3 className="text-sm font-bold text-foreground">
                                        {item.title}
                                    </h3>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {item.desc}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* ======== CTA ======== */}
            <section className="relative overflow-hidden bg-success px-4 py-16 text-center md:py-20">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-20 -left-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute -bottom-20 -right-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
                </div>
                <div className="relative mx-auto max-w-xl">
                    <h2 className="mb-3 text-3xl font-bold text-white">
                        Ready to Print?
                    </h2>
                    <p className="mb-8 text-white/80">
                        Find a kiosk near you or deploy one at your location.
                    </p>
                    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Button
                            asChild
                            size="lg"
                            className="bg-white px-8 text-success shadow-lg hover:bg-white/90"
                        >
                            <Link to="/upload">Start Printing</Link>
                        </Button>
                        <Button
                            asChild
                            size="lg"
                            variant="outline"
                            className="border-white/30 px-8 text-white hover:bg-white/10"
                        >
                            <Link to="/contact">Contact Us</Link>
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
}
