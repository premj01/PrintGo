import { useRef, useState, type FormEvent } from "react";
import { Dialog } from "radix-ui";
import { isAxiosError } from "axios";
import { CheckCircle2, Loader2, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STORAGE_KEYS } from "@/config/constants";
import { kioskPrintService } from "@/services";

function savedEmail(): string {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.BILL_EMAIL);
        if (saved !== null) return saved;
        const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || "null");
        return typeof user?.email === "string" ? user.email : "";
    } catch {
        return "";
    }
}

export default function CustomerBill({ initialOpen = false, paymentId }: { initialOpen?: boolean; paymentId?: string | null }) {
    const [open, setOpen] = useState(initialOpen);
    const [email, setEmail] = useState(savedEmail);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [sentTo, setSentTo] = useState("");
    const inFlight = useRef(false);

    function changeEmail(value: string) {
        setEmail(value);
        setError("");
        setSentTo("");
        try { localStorage.setItem(STORAGE_KEYS.BILL_EMAIL, value); } catch { /* Email can still be sent if browser storage is unavailable. */ }
    }

    async function sendBill(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (inFlight.current) return;
        const recipient = email.trim();
        const sessionId = localStorage.getItem(STORAGE_KEYS.KIOSK_SESSION);
        if (!sessionId) {
            setError("Your print session is missing. Please reopen the session from your kiosk QR code.");
            return;
        }
        inFlight.current = true;
        setSending(true);
        setError("");
        setSentTo("");
        try {
            const result = await kioskPrintService.sendCustomerBill({ email: recipient, sessionId, ...(paymentId && { paymentId }) });
            if (!result.success) throw new Error(result.message);
            setSentTo(recipient);
        } catch (err) {
            setError(isAxiosError(err) ? err.response?.data?.message || "Could not send your bill. Please try again." : "Could not send your bill. Please try again.");
        } finally {
            inFlight.current = false;
            setSending(false);
        }
    }

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <Button className="gap-2"><Mail className="h-4 w-4" />Send me bill</Button>
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-success/15 text-foreground"><Mail className="h-6 w-6" /></div>
                    <Dialog.Title className="pr-8 text-xl font-semibold">Send me bill</Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                        Enter your email for your PrintGo receipt. Printing continues while you fill this in.
                    </Dialog.Description>
                    <form onSubmit={sendBill} className="mt-5 space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="bill-email" className="text-sm font-medium">Email address</label>
                            <input id="bill-email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254}
                                placeholder="you@example.com" value={email} onChange={event => changeEmail(event.target.value)} disabled={sending}
                                className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" />
                            <p className="text-xs text-muted-foreground">Saved on this device for next time. You can change it whenever you like.</p>
                        </div>
                        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                        {sentTo && <p role="status" className="flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm"><CheckCircle2 className="h-5 w-5 shrink-0" />Bill sent to {sentTo}. Check your inbox or spam folder.</p>}
                        <Button type="submit" className="w-full gap-2" disabled={sending || !email.trim() || sentTo === email.trim()}>
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                            {sending ? "Sending bill..." : sentTo === email.trim() ? "Bill sent" : "Send bill"}
                        </Button>
                    </form>
                    <Dialog.Close asChild><button type="button" aria-label="Close bill popup" className="absolute right-4 top-4 rounded-md p-2 text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"><X className="h-5 w-5" /></button></Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
