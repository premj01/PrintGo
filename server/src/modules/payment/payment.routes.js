/**
 * Payment Routes (Razorpay)
 * ─────────────────────────
 * POST /create-order   → Create a Razorpay order for the print job
 * POST /verify-payment → Verify payment signature & mark as paid
 * POST /refund         → Manually trigger a refund (admin or system use)
 */

import { buildSections } from "../../services/printSections.js";
import express from "express";
import { requireUserAuth } from "../../middleware/userAuth.middleware.js";
import {
    createOrder,
    verifyPaymentSignature,
    initiateRefund,
} from "../../services/razorpay.service.js";
import {
    pendingS3PrintJobs, s3UploadRecords,
} from "../../state/runtimeStore.js";
import prisma from "../../config/prisma.js";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// POST /create-order — Create a Razorpay order for the current session
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/create-order", requireUserAuth, async (req, res) => {
    try {
        const sessionId = req.userSessionNumber;
        const { amount } = req.body; // amount in Rs (e.g. 5)

        console.log(`\n💳 [payment/create-order] Request received`);
        console.log(`   ├─ sessionId : ${sessionId}`);
        console.log(`   └─ amount    : Rs ${amount}`);

        if (!sessionId) {
            return res.status(401).json({ success: false, message: "Invalid session" });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }

        const fileKey = req.body.fileKey || pendingS3PrintJobs[sessionId]?.fileKey;
        const file = fileKey && s3UploadRecords[fileKey];
        if (fileKey && (!file || file.sessionId !== sessionId)) return res.status(409).json({ success: false, message: "Upload does not match this session." });
        if (file?.metadata?.bwPageCount !== undefined) {
            const sections = buildSections(file.metadata);
            if (Math.round(amount * 100) !== sections.reduce((sum, part) => sum + part.amount, 0)) {
                return res.status(400).json({ success: false, message: "Payment amount does not match the merged PDF." });
            }
            if (pendingS3PrintJobs[sessionId]?.supportsSections === false) {
                return res.status(409).json({ success: false, message: "This kiosk needs the section printing update before taking payment." });
            }
        }
        const amountInPaise = Math.round(amount * 100);

        // Razorpay receipt max length is 56 chars — use truncated sessionId + short timestamp
        const shortReceipt = `rcpt_${sessionId.substring(0, 36)}_${Date.now().toString(36)}`;

        const upload = await prisma.noAuthUser.findFirst({
            where: { id: file?.recordId, userSessionNumber: sessionId, isPrintStarted: false, paymentStatus: { in: ["pending", "failed", "order_created"] } },
            orderBy: { createdAt: "desc" },
        });
        if (!upload) return res.status(409).json({ success: false, message: "No prepared upload for payment." });
        const order = await createOrder(amountInPaise, shortReceipt, {
            sessionId,
        });

        await prisma.noAuthUser.updateMany({
            where: { id: upload.id },
            data: {
                razorpayOrderId: order.id,
                paymentAmount: amount,
                paymentMethod: "Razorpay",
                paymentStatus: "order_created",
            },
        });

        return res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (err) {
        console.error("❌ [payment/create-order] Error:", err?.message || err?.description || JSON.stringify(err) || String(err));
        return res.status(500).json({ success: false, message: "Failed to create payment order" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /verify-payment — Verify Razorpay signature & update payment status
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/verify-payment", requireUserAuth, async (req, res) => {
    try {
        const sessionId = req.userSessionNumber;
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = req.body;

        console.log(`\n🔐 [payment/verify-payment] Request received`);
        console.log(`   ├─ sessionId         : ${sessionId}`);
        console.log(`   ├─ razorpay_order_id  : ${razorpay_order_id}`);
        console.log(`   └─ razorpay_payment_id: ${razorpay_payment_id}`);

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Missing payment verification fields" });
        }

        const isValid = verifyPaymentSignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isValid) {
            // Update DB with failed payment (non-blocking)
            prisma.noAuthUser.updateMany({
                where: { userSessionNumber: sessionId, razorpayOrderId: razorpay_order_id, paymentStatus: "order_created" },
                data: {
                    paymentStatus: "failed",
                    razorpayPaymentId: razorpay_payment_id,
                },
            }).catch((dbErr) => console.error(`   ❌ [Prisma] Payment fail update error: ${dbErr?.message || dbErr}`));

            return res.status(400).json({
                success: false,
                message: "Payment verification failed. Invalid signature.",
            });
        }

        // Persist the verified payment before the client can request printing.
        const verified = await prisma.noAuthUser.updateMany({
            where: { userSessionNumber: sessionId, razorpayOrderId: razorpay_order_id, paymentStatus: { in: ["order_created", "success"] } },
            data: {
                paymentStatus: "success",
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature,
                transactionId: razorpay_payment_id,
                paymentTimestamp: new Date(),
            },
        });
        if (!verified.count) return res.status(409).json({ success: false, message: "Payment order does not match this session." });

        return res.json({
            success: true,
            message: "Payment verified successfully",
            paymentId: razorpay_payment_id,
        });
    } catch (err) {
        console.error("❌ [payment/verify-payment] Error:", err?.message || err?.description || String(err));
        return res.status(500).json({ success: false, message: "Payment verification failed" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /refund — Initiate a refund (used by auto-refund on print failure)
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/refund", async (req, res) => {
    try {
        const { sessionId, paymentId, amount } = req.body;

        console.log(`\n💸 [payment/refund] Request received`);
        console.log(`   ├─ sessionId : ${sessionId}`);
        console.log(`   ├─ paymentId : ${paymentId}`);
        console.log(`   └─ amount    : ${amount || "full refund"}`);

        if (!paymentId) {
            return res.status(400).json({ success: false, message: "paymentId is required" });
        }

        const payment = await prisma.noAuthUser.findFirst({ where: { razorpayPaymentId: paymentId } });
        if (payment?.fileConfig?.sections) {
            return res.status(409).json({ success: false, message: "Section refunds are settled from the recorded printer outcomes." });
        }
        const amountInPaise = amount ? Math.round(amount * 100) : null;

        const refund = await initiateRefund(paymentId, amountInPaise, {
            sessionId: sessionId || "unknown",
            reason: "Print job failed — automatic refund",
        });

        // Update DB with refund status
        if (sessionId) {
            try {
                await prisma.noAuthUser.updateMany({
                    where: { userSessionNumber: sessionId },
                    data: {
                        paymentStatus: "refunded",
                        refundId: refund.id,
                        refundAmount: refund.amount / 100,
                        refundStatus: refund.status,
                        refundTimestamp: new Date(),
                    },
                });
                console.log(`   ✅ [Prisma] Refund recorded for session: ${sessionId}`);
            } catch (dbErr) {
                console.error(`   ❌ [Prisma] Refund DB update error: ${dbErr.message}`);
            }
        }

        return res.json({
            success: true,
            refundId: refund.id,
            amount: refund.amount,
            status: refund.status,
        });
    } catch (err) {
        console.error("❌ [payment/refund] Error:", err?.message || err?.description || String(err));
        return res.status(500).json({ success: false, message: `Refund failed: ${err?.message || err?.description || "Unknown error"}` });
    }
});

export default router;
