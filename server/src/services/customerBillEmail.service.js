import { createHash } from "node:crypto";
import { Resend } from "resend";
import { renderCustomerBill } from "./customerBill.js";

export async function sendCustomerBillEmail(record, email) {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
        const error = new Error("Bill email service is not configured.");
        error.statusCode = 503;
        throw error;
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    const payload = {
        from: process.env.RESEND_FROM_EMAIL,
        to: [email],
        ...renderCustomerBill(record),
    };
    // Identical retries return the first result instead of sending duplicate
    // receipts. Changed recipients or refund details get their own key.
    const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const { data, error } = await resend.emails.send(payload, { idempotencyKey: `customer-bill/${digest}` });
    if (error || !data?.id) {
        console.error("[bill-e-customer] Email provider rejected request:", error?.name || "missing_message_id");
        const failure = new Error("Could not send your bill. Please try again shortly.");
        failure.statusCode = 502;
        throw failure;
    }
    return data.id;
}
