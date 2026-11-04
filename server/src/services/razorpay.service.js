/**
 * Razorpay Service
 * ────────────────
 * Handles Razorpay order creation, payment signature verification, and refund processing.
 * All amounts are in PAISE (INR × 100). e.g. Rs 5 = 500 paise.
 */

import Razorpay from "razorpay";
import crypto from "crypto";

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("⚠️ [Razorpay] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not found in environment variables!");
}

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

console.log(`✅ [Razorpay] SDK initialized with key: ${process.env.RAZORPAY_KEY_ID?.substring(0, 12)}...`);

/**
 * Create a Razorpay order.
 *
 * @param {number} amountInPaise - amount in paise (e.g. 500 for Rs 5)
 * @param {string} receipt       - unique receipt id (e.g. sessionId)
 * @param {object} [notes]       - optional metadata
 * @returns {Promise<object>}    - Razorpay order object
 */
export async function createOrder(amountInPaise, receipt, notes = {}) {
    const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt,
        notes,
    });

    console.log(`\n💳 [Razorpay] Order created`);
    console.log(`   ├─ orderId : ${order.id}`);
    console.log(`   ├─ amount  : ${order.amount} paise (Rs ${order.amount / 100})`);
    console.log(`   └─ receipt : ${order.receipt}`);

    return order;
}

/**
 * Verify a Razorpay payment signature using HMAC SHA256.
 *
 * @param {string} orderId    - razorpay_order_id
 * @param {string} paymentId  - razorpay_payment_id
 * @param {string} signature  - razorpay_signature from checkout
 * @returns {boolean}         - true if signature is valid
 */
export function verifyPaymentSignature(orderId, paymentId, signature) {
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest("hex");

    const isValid = expectedSignature === signature;

    console.log(`\n🔐 [Razorpay] Signature verification: ${isValid ? "✅ VALID" : "❌ INVALID"}`);
    console.log(`   ├─ orderId   : ${orderId}`);
    console.log(`   └─ paymentId : ${paymentId}`);

    return isValid;
}

/**
 * Initiate a full or partial refund for a payment.
 *
 * @param {string} paymentId      - razorpay_payment_id
 * @param {number} [amountInPaise] - optional partial refund amount (paise). Omit for full refund.
 * @param {object} [notes]        - optional metadata
 * @returns {Promise<object>}     - Razorpay refund object
 */
export async function initiateRefund(paymentId, amountInPaise = null, notes = {}) {
    const refundPayload = {
        notes: {
            reason: "Print job failed — automatic refund",
            ...notes,
        },
    };

    if (amountInPaise) {
        refundPayload.amount = amountInPaise;
    }

    const refund = await razorpay.payments.refund(paymentId, refundPayload);

    console.log(`\n💸 [Razorpay] Refund initiated`);
    console.log(`   ├─ refundId  : ${refund.id}`);
    console.log(`   ├─ paymentId : ${paymentId}`);
    console.log(`   ├─ amount    : ${refund.amount} paise (Rs ${refund.amount / 100})`);
    console.log(`   └─ status    : ${refund.status}`);

    return refund;
}

/**
 * Fetch payment details from Razorpay.
 *
 * @param {string} paymentId - razorpay_payment_id
 * @returns {Promise<object>}
 */
export async function fetchPayment(paymentId) {
    return razorpay.payments.fetch(paymentId);
}

export default razorpay;
