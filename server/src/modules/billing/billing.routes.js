import express from "express";
import prisma from "../../config/prisma.js";
import { requireUserAuth } from "../../middleware/userAuth.middleware.js";
import { sendCustomerBillEmail } from "../../services/customerBillEmail.service.js";

const router = express.Router();
const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;

router.post("/bill-e-customer", requireUserAuth, async (req, res) => {
    const { sessionId, email, paymentId } = req.body || {};
    if (typeof sessionId !== "string" || !sessionId || sessionId.length > 200 ||
        typeof email !== "string" || email.length > 254 ||
        !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i.test(email.trim()) ||
        (paymentId !== undefined && (typeof paymentId !== "string" || !paymentId || paymentId.length > 200))) {
        return res.status(400).json({ success: false, message: "A valid email address and sessionId are required." });
    }
    if (sessionId !== req.userSessionNumber) {
        return res.status(403).json({ success: false, message: "This session does not belong to you." });
    }

    const now = Date.now();
    for (const [key, value] of attempts) if (value.expiresAt <= now) attempts.delete(key);
    const limit = attempts.get(sessionId) || { count: 0, expiresAt: now + WINDOW_MS };
    if (limit.count >= 5 || (!attempts.has(sessionId) && attempts.size >= 10000)) {
        res.set("Retry-After", String(Math.max(1, Math.ceil((limit.expiresAt - now) / 1000))));
        return res.status(429).json({ success: false, message: "Too many bill requests. Please try again in a few minutes." });
    }
    limit.count++;
    attempts.set(sessionId, limit);

    try {
        const record = await prisma.noAuthUser.findFirst({
            where: {
                userSessionNumber: sessionId,
                paymentStatus: { in: ["success", "refunded", "partially_refunded"] },
                ...(paymentId ? { razorpayPaymentId: paymentId } : {}),
            },
            orderBy: [{ paymentTimestamp: "desc" }, { createdAt: "desc" }],
        });
        if (!record || !(record.razorpayPaymentId || record.transactionId)) {
            return res.status(404).json({ success: false, message: "No verified payment was found for this session." });
        }
        const messageId = await sendCustomerBillEmail(record, email.trim());
        return res.json({ success: true, message: "Your bill has been sent.", messageId });
    } catch (error) {
        console.error("[bill-e-customer] Request failed:", error?.statusCode || 500);
        return res.status(error?.statusCode || 500).json({
            success: false,
            message: error?.statusCode ? error.message : "Could not send your bill. Please try again shortly.",
        });
    }
});

export default router;
