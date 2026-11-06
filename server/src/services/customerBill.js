import { buildSections } from "./printSections.js";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const money = paise => `Rs ${(paise / 100).toFixed(2)}`;

// Keep the charged quantities and rates in PostgreSQL before the bill can be
// requested, independently of kiosk downloads and the in-memory upload store.
export function createBillingSnapshot(meta) {
    const sections = buildSections(meta);
    return {
        currency: "INR",
        items: sections.map(section => ({
            description: section.mode === "bw" ? "Black and white printing" : "Color printing",
            quantity: section.mode === "bw" ? meta.bwPageCount : meta.colorPageCount,
            unitAmount: section.mode === "bw" ? 100 : 400,
            amount: section.amount,
        })),
    };
}

export function renderCustomerBill(record) {
    const total = Math.round(Number(record.paymentAmount) * 100);
    if (!Number.isSafeInteger(total) || total <= 0) throw new Error("Invalid recorded payment amount");
    let items = record.fileConfig?.billing?.items;
    if (!Array.isArray(items) || !items.length || !items.every(item =>
        Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
        Number.isSafeInteger(item.unitAmount) && item.unitAmount >= 0 &&
        Number.isSafeInteger(item.amount) && item.amount === item.quantity * item.unitAmount
    ) || items.reduce((sum, item) => sum + item.amount, 0) !== total) {
        // Historical records may have no page breakdown. Do not invent one.
        items = [{ description: "Document printing", quantity: 1, unitAmount: total, amount: total }];
    }
    const receipt = `PG-${record.id}`;
    const paidAt = record.paymentTimestamp ? new Date(record.paymentTimestamp).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
    }) + " IST" : "Not recorded";
    const paymentStatuses = { success: "Paid", refunded: "Refunded", partially_refunded: "Partially refunded" };
    const paymentStatus = paymentStatuses[record.paymentStatus] || record.paymentStatus;
    const details = [
        ["Receipt", receipt], ["Payment date", paidAt], ["Kiosk", record.kioskId],
        ["Session", record.userSessionNumber], ["Document", record.fileName || "Print job"],
        ["Payment method", record.paymentMethod || "Razorpay"],
        ["Payment reference", record.razorpayPaymentId || record.transactionId],
        ["Order reference", record.razorpayOrderId || record.merchantOrderId || "Not recorded"],
    ];
    const hasRefund = Number.isFinite(record.refundAmount) && record.refundAmount > 0;
    const refundText = hasRefund
        ? `Refund amount: ${money(Math.round(record.refundAmount * 100))}. Refund status: ${record.refundStatus || "pending"}.`
        : "";
    const text = [
        "PrintGo | Payment receipt", paymentStatus,
        ...details.map(([label, value]) => `${label}: ${value}`), "",
        ...items.map(item => `${item.description}: ${item.quantity} x ${money(item.unitAmount)} = ${money(item.amount)}`),
        `Total paid: ${money(total)} (INR)`, refundText, "",
        "This receipt confirms your payment. Printing and any subsequent refund are tracked separately in PrintGo.",
        "Thank you for printing with PrintGo.",
    ].filter(Boolean).join("\n");
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PrintGo payment receipt</title></head>
<body style="margin:0;background:#f4f6ef;font-family:Arial,Helvetica,sans-serif;color:#202c24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e0e7dc;border-radius:16px;overflow:hidden">
<tr><td style="background:#203d2b;padding:28px;color:#fff"><p style="margin:0 0 8px;font-size:28px;font-weight:bold">PrintGo</p><p style="margin:0;color:#ddeb9d">Your printing bill, in one place.</p></td></tr>
<tr><td style="padding:28px"><p style="margin:0 0 8px;color:#396326;font-size:13px;font-weight:bold;text-transform:uppercase">${escapeHtml(paymentStatus)}</p>
<h1 style="margin:0 0 24px;font-size:24px">Payment receipt</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;table-layout:fixed">
${details.map(([label, value]) => `<tr><td style="width:32%;padding:7px 8px 7px 0;vertical-align:top;color:#647067">${escapeHtml(label)}</td><td style="padding:7px 0;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(value)}</td></tr>`).join("\n")}
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse;font-size:13px">
<thead><tr style="background:#f0f5e8"><th scope="col" align="left" style="padding:12px 8px">Printing</th><th scope="col" align="right" style="padding:12px 8px">Qty</th><th scope="col" align="right" style="padding:12px 8px">Rate</th><th scope="col" align="right" style="padding:12px 8px">Amount</th></tr></thead>
<tbody>${items.map(item => `<tr><td style="padding:14px 8px;border-bottom:1px solid #e6ebe2">${escapeHtml(item.description)}</td><td align="right" style="padding:14px 8px;border-bottom:1px solid #e6ebe2">${item.quantity}</td><td align="right" style="padding:14px 8px;border-bottom:1px solid #e6ebe2;white-space:nowrap">${money(item.unitAmount)}</td><td align="right" style="padding:14px 8px;border-bottom:1px solid #e6ebe2;white-space:nowrap">${money(item.amount)}</td></tr>`).join("")}</tbody>
</table><p style="margin:24px 0 8px;text-align:right;color:#647067">Total paid (INR)</p><p style="margin:0;text-align:right;font-size:30px;font-weight:bold;color:#203d2b">${money(total)}</p>
${refundText ? `<p style="padding:14px;background:#fff5df;border-radius:8px;font-size:13px">${escapeHtml(refundText)}</p>` : ""}
<p style="margin:28px 0 0;color:#647067;font-size:12px;line-height:1.6">This receipt confirms your payment. Printing and any subsequent refund are tracked separately in PrintGo.</p></td></tr>
<tr><td style="padding:20px 28px;background:#f0f5e8;color:#52634c;font-size:12px">Thank you for printing with PrintGo.</td></tr>
</table></td></tr></table></body></html>`;
    return { subject: `Your PrintGo bill | ${receipt}`, html, text };
}
