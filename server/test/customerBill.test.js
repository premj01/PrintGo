import { beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createBillingSnapshot, renderCustomerBill } from "../src/services/customerBill.js";

let row, queries, sends, providerError;
mock.module("../src/config/prisma.js", { defaultExport: { noAuthUser: {
    async findFirst(query) { queries.push(query); return structuredClone(row); },
} } });
mock.module("../src/util/jwt.util.js", { namedExports: {
    verifyToken(token) { if (token === "invalid") throw new Error("Invalid token"); return { userSessionNumber: token }; },
} });
mock.module("resend", { namedExports: { Resend: class {
    emails = { send: async (payload, options) => {
        sends.push({ payload, options });
        return providerError ? { error: { name: "validation_error" } } : { data: { id: "email-test" } };
    } };
} } });
const { default: billingRoutes } = await import("../src/modules/billing/billing.routes.js");
const { sendCustomerBillEmail } = await import("../src/services/customerBillEmail.service.js");
beforeEach(() => {
    process.env.RESEND_API_KEY = "test-key-never-sent";
    process.env.RESEND_FROM_EMAIL = "PrintGo <bills@example.com>";
    queries = []; sends = []; providerError = false;
    row = {
        id: "receipt-123", userSessionNumber: "session-test", kioskId: "KIOSK002",
        fileName: '<script>alert("bad")</script>.pdf', paymentAmount: 11,
        paymentStatus: "success", razorpayPaymentId: "pay-test", razorpayOrderId: "order-test",
        paymentTimestamp: new Date("2026-11-06T08:00:00Z"), paymentMethod: "Razorpay",
        fileConfig: { billing: createBillingSnapshot({ bwPageCount: 3, colorPageCount: 2, totalPages: 5 }) },
    };
});

async function post(body, token = body.sessionId) {
    // Exercise the actual Express router and auth middleware in-process.
    // No network listener, database, or external email service is needed.
    return new Promise((resolve, reject) => {
        const req = {
            method: "POST", url: "/bill-e-customer", body,
            headers: token ? { authorization: `Bearer ${token}` } : {},
        };
        const res = {
            statusCode: 200, headers: {},
            status(code) { this.statusCode = code; return this; },
            set(key, value) { this.headers[key] = value; return this; },
            json(data) { resolve({ status: this.statusCode, body: data, retryAfter: this.headers["Retry-After"] }); },
        };
        billingRoutes.handle(req, res, error => reject(error || new Error("Route not handled")));
    });
}

test("HTML bill uses saved quantities, INR totals, payment details, and escapes document names", () => {
    const bill = renderCustomerBill(row);
    assert.match(bill.html, /Black and white printing/);
    assert.match(bill.html, /Color printing/);
    assert.match(bill.html, /Rs 3\.00/);
    assert.match(bill.html, /Rs 8\.00/);
    assert.match(bill.html, /Rs 11\.00/);
    assert.match(bill.html, /&lt;script&gt;/);
    assert.doesNotMatch(bill.html, /<script>/);
    assert.match(bill.text, /Payment reference: pay-test/);
    assert.match(bill.text, /3 x Rs 1.00 = Rs 3.00/);
});

test("historical or inconsistent breakdowns use the paid total without inventing line items", () => {
    delete row.fileConfig.billing;
    assert.match(renderCustomerBill(row).text, /Document printing: 1 x Rs 11.00/);
    row.fileConfig.billing = createBillingSnapshot({ bwPageCount: 1, colorPageCount: 0, totalPages: 1 });
    assert.match(renderCustomerBill(row).text, /Document printing: 1 x Rs 11.00/);
    row.paymentAmount = null;
    assert.throws(() => renderCustomerBill(row), /Invalid recorded payment amount/);
});

test("partial refunds are described without pretending the initial payment was smaller", () => {
    Object.assign(row, { paymentStatus: "partially_refunded", refundAmount: 8, refundStatus: "processed" });
    const { text } = renderCustomerBill(row);
    assert.match(text, /Partially refunded/);
    assert.match(text, /Total paid: Rs 11.00/);
    assert.match(text, /Refund amount: Rs 8.00/);
});

test("requires authentication and rejects a different session before database access", async () => {
    assert.equal((await post({ sessionId: "auth", email: "a@example.com" }, null)).status, 401);
    assert.equal((await post({ sessionId: "auth", email: "a@example.com" }, "invalid")).status, 401);
    assert.equal((await post({ sessionId: "other", email: "a@example.com" }, "own")).status, 403);
    assert.equal(queries.length, 0);
    assert.equal(sends.length, 0);
});

test("rejects invalid input and multiple recipients", async () => {
    for (const email of ["broken", "a@example.com,b@example.com", "a@example.com\r\nBcc:b@example.com", ["a@example.com"]]) {
        assert.equal((await post({ sessionId: "input", email })).status, 400);
    }
    assert.equal((await post({ sessionId: "input", email: "a@example.com", paymentId: {} })).status, 400);
    assert.equal(sends.length, 0);
});

test("selects only verified payments for the authenticated session and optional payment reference", async () => {
    const result = await post({ sessionId: "lookup", email: " a@example.com ", paymentId: "pay-test", paymentAmount: 1 });
    assert.equal(result.status, 200);
    assert.equal(result.body.messageId, "email-test");
    assert.deepEqual(queries[0].where, {
        userSessionNumber: "lookup", paymentStatus: { in: ["success", "refunded", "partially_refunded"] }, razorpayPaymentId: "pay-test",
    });
    assert.deepEqual(sends[0].payload.to, ["a@example.com"]);
    assert.match(sends[0].payload.html, /Rs 11\.00/);
});

test("does not send a bill for an unpaid/missing session", async () => {
    row = null;
    assert.equal((await post({ sessionId: "missing", email: "a@example.com" })).status, 404);
    assert.equal(sends.length, 0);
});

test("provider failure and missing configuration return actionable failures", async () => {
    providerError = true;
    assert.equal((await post({ sessionId: "provider", email: "a@example.com" })).status, 502);
    delete process.env.RESEND_API_KEY;
    assert.equal((await post({ sessionId: "config", email: "a@example.com" })).status, 503);
});

test("duplicate requests reuse the provider idempotency key, but a new recipient has its own key", async () => {
    await sendCustomerBillEmail(row, "a@example.com");
    row.printStatus = "printing";
    await sendCustomerBillEmail(row, "a@example.com");
    await sendCustomerBillEmail(row, "b@example.com");
    assert.equal(sends[0].options.idempotencyKey, sends[1].options.idempotencyKey);
    assert.notEqual(sends[0].options.idempotencyKey, sends[2].options.idempotencyKey);
});

test("limits email requests per session", async () => {
    for (let i = 0; i < 5; i++) assert.equal((await post({ sessionId: "limited", email: "a@example.com" })).status, 200);
    const result = await post({ sessionId: "limited", email: "a@example.com" });
    assert.equal(result.status, 429);
    assert.ok(Number(result.retryAfter) > 0);
    assert.equal(sends.length, 5);
});
