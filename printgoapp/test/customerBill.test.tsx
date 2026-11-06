import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { STORAGE_KEYS } from "@/config/constants";
import PaymentPage from "@/pages/PaymentPage";
import CustomerBill from "@/components/CustomerBill";
import { useAutomaticPrint } from "@/hooks/useAutomaticPrint";
import type { MergedPdfMeta, RazorpayCheckoutOptions } from "@/types";

const service = vi.hoisted(() => ({
    checkDownloadStatus: vi.fn(), startPrint: vi.fn(), sendCustomerBill: vi.fn(),
    createPaymentOrder: vi.fn(), verifyPayment: vi.fn(), uploadMergedPdf: vi.fn(),
}));
vi.mock("@/services", () => ({ kioskPrintService: service }));
vi.mock("idb-keyval", () => ({ get: async () => new Blob(["test PDF"], { type: "application/pdf" }) }));
const meta: MergedPdfMeta = { bwPageCount: 3, colorPageCount: 2, totalPages: 5, bwRanges: "1-3", colorRanges: "4-5", sourceFiles: [] };
let checkout: RazorpayCheckoutOptions;

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.KIOSK_SESSION, "session-test");
    localStorage.setItem(STORAGE_KEYS.MERGED_PDF_META, JSON.stringify(meta));
    localStorage.setItem(STORAGE_KEYS.UPLOADED_FILE_NAME, "uploaded.pdf");
    service.checkDownloadStatus.mockResolvedValue({ success: true, s3UploadStatus: "uploaded", kioskDownloadStatus: "downloading", isDownloaded: false, isPrintStarted: false, paymentStatus: "pending" });
    service.startPrint.mockResolvedValue({ success: true, message: "Queued" });
    service.sendCustomerBill.mockResolvedValue({ success: true, message: "Bill sent" });
    service.createPaymentOrder.mockResolvedValue({ success: true, orderId: "order-test", amount: 1100, currency: "INR" });
    service.verifyPayment.mockResolvedValue({ success: true, paymentId: "pay-test" });
    window.Razorpay = class {
        constructor(options: RazorpayCheckoutOptions) { checkout = options; }
        open() {} close() {} on() {}
    };
});
afterEach(cleanup);

async function pay() {
    render(<StrictMode><MemoryRouter><PaymentPage /></MemoryRouter></StrictMode>);
    const button = await screen.findByRole("button", { name: "Pay Rs 11" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(service.createPaymentOrder).toHaveBeenCalledOnce());
    await act(async () => { await checkout.handler({ razorpay_order_id: "order-test", razorpay_payment_id: "pay-test", razorpay_signature: "test-signature" }); });
}

describe("payment, printing, and bill popup", () => {
    it("starts printing without waiting for download; closing/reopening and sending a bill do not restart or block printing", async () => {
        let finishPrint!: (value: { success: boolean }) => void;
        service.startPrint.mockImplementation(() => new Promise(resolve => { finishPrint = resolve; }));
        await pay();
        expect(await screen.findByRole("dialog")).toBeTruthy();
        expect(service.startPrint).toHaveBeenCalledOnce();
        expect(service.startPrint).toHaveBeenCalledWith(expect.objectContaining({ fileKey: "uploaded.pdf", printMeta: meta }));
        fireEvent.click(screen.getByRole("button", { name: "Close bill popup" }));
        expect(screen.queryByRole("dialog")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Send me bill" }));
        fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "customer@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: "Send bill" }));
        await screen.findByText(/Bill sent to customer@example.com/);
        expect(service.sendCustomerBill).toHaveBeenCalledWith({ email: "customer@example.com", sessionId: "session-test", paymentId: "pay-test" });
        expect(service.startPrint).toHaveBeenCalledOnce();
        expect(localStorage.getItem(STORAGE_KEYS.BILL_EMAIL)).toBe("customer@example.com");
        await act(async () => finishPrint({ success: true }));
    });

    it("does not print or open the bill popup for failed payment verification", async () => {
        service.verifyPayment.mockResolvedValue({ success: false });
        await pay();
        expect(service.startPrint).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(screen.getByText(/Payment verification failed/)).toBeTruthy();
    });

    it("restores a previously paid job without charging or starting it a second time", async () => {
        service.checkDownloadStatus.mockResolvedValue({ success: true, s3UploadStatus: "uploaded", isDownloaded: true, isPrintStarted: true, paymentStatus: "success", paymentId: "pay-test" });
        render(<StrictMode><MemoryRouter><PaymentPage /></MemoryRouter></StrictMode>);
        await screen.findByRole("button", { name: "Send me bill" });
        expect(service.startPrint).not.toHaveBeenCalled();
        expect(screen.queryByRole("button", { name: "Pay Rs 11" })).toBeNull();
    });
});

describe("saved email and error recovery", () => {
    it("prefills a returning customer's address and saves an edited address even if the popup is closed", async () => {
        localStorage.setItem(STORAGE_KEYS.BILL_EMAIL, "old@example.com");
        const view = render(<CustomerBill initialOpen />);
        expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe("old@example.com");
        fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "new@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: "Close bill popup" }));
        view.unmount();
        render(<CustomerBill initialOpen />);
        expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe("new@example.com");
        expect(service.sendCustomerBill).not.toHaveBeenCalled();
    });

    it("prefills an existing signed-in customer's email and allows clearing it", () => {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ email: "profile@example.com" }));
        render(<CustomerBill initialOpen />);
        const input = screen.getByLabelText("Email address") as HTMLInputElement;
        expect(input.value).toBe("profile@example.com");
        expect(input.type).toBe("email");
        fireEvent.change(input, { target: { value: "" } });
        expect(input.value).toBe("");
    });

    it("keeps the email after a provider failure and allows retrying", async () => {
        service.sendCustomerBill.mockRejectedValueOnce(new Error("Provider unavailable"));
        render(<CustomerBill initialOpen />);
        fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "customer@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: "Send bill" }));
        expect(await screen.findByRole("alert")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Send bill" }));
        await screen.findByText(/Bill sent to customer@example.com/);
        expect(service.sendCustomerBill).toHaveBeenCalledTimes(2);
    });
});

it("reconciles a lost print response instead of printing twice", async () => {
    service.startPrint.mockRejectedValue(new Error("Network error"));
    service.checkDownloadStatus.mockResolvedValue({ isPrintStarted: true });
    function Harness() {
        const state = useAutomaticPrint(true, "uploaded.pdf", meta, false);
        return <span>{state.requested ? "Queued safely" : state.error || "Starting"}</span>;
    }
    render(<StrictMode><Harness /></StrictMode>);
    await screen.findByText("Queued safely");
    expect(service.startPrint).toHaveBeenCalledOnce();
});
