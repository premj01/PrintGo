import express from "express";
import { registerAdmin, loginAdmin, logoutAdmin, getMe, getAllAdmins, updateAdminStatus } from "./admin.auth.controller.js";
import jwt from "jsonwebtoken";
import Kiosk from "../../models/kiosk.model.js";
import Admin from "../../models/admin.model.js";
import { kioskSockets, userSessionIdWithKioskId } from "../../state/runtimeStore.js";

const router = express.Router();

// ── Auth Middleware ────────────────────────────────────────────────────────────
const protectAdmin = (req, res, next) => {
    let token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Not authorized" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: "Token failed" });
    }
};

const superAdminOnly = (req, res, next) => {
    if (req.user && req.user.role === "superadmin") {
        next();
    } else {
        return res.status(403).json({ success: false, message: "Superadmin access required" });
    }
};

// ── Auth Routes ──────────────────────────────────────────────────────────────
router.post("/auth/register", registerAdmin);
router.post("/auth/login", loginAdmin);
router.post("/auth/logout", logoutAdmin);
router.get("/auth/me", protectAdmin, getMe);

// ── Admin Management Routes ──────────────────────────────────────────────────
router.get("/accounts", protectAdmin, superAdminOnly, getAllAdmins);
router.patch("/accounts/:id", protectAdmin, superAdminOnly, updateAdminStatus);



router.get("/kiosks", protectAdmin, async (req, res) => {
    try {
        const dbKiosks = await Kiosk.find({}).lean();

        const mergedKiosks = dbKiosks.map(dbKiosk => {
            const kioskId = dbKiosk.kioskId;
            const socketStatus = (kioskId && kioskSockets[kioskId]) || { kiosk: null, agent: null };

            return {
                ...dbKiosk,
                liveConnected: !!socketStatus.kiosk,
                agentConnected: !!socketStatus.agent
            };
        });

        res.json({ success: true, kiosks: mergedKiosks });
    } catch (err) {
        console.error("ERROR in GET /kiosks:", err);
        res.status(500).json({ success: false, message: "Internal server error while fetching kiosks" });
    }
});

router.get("/kiosks/:kioskId", protectAdmin, async (req, res) => {
    try {
        const kioskId = req.params.kioskId;
        const dbKiosk = await Kiosk.findOne({ kioskId }).lean();

        if (!dbKiosk) return res.status(404).json({ success: false, message: "Kiosk not found" });

        const socketStatus = (kioskId && kioskSockets[kioskId]) || { kiosk: null, agent: null };
        const mergedKiosk = {
            ...dbKiosk,
            liveConnected: !!socketStatus.kiosk,
            agentConnected: !!socketStatus.agent
        };

        res.json({ success: true, kiosk: mergedKiosk });
    } catch (err) {
        console.error(`ERROR in GET /kiosks/${req.params.kioskId}:`, err);
        res.status(500).json({ success: false, message: "Internal server error while fetching kiosk details" });
    }
});

router.patch("/kiosks/:kioskId", protectAdmin, async (req, res) => {
    try {
        const kioskId = req.params.kioskId;
        const updateData = req.body;

        console.log(`[PATCH] /kiosks/${kioskId} - Received data:`, JSON.stringify(updateData));

        if (!updateData || Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: "No update data provided" });
        }

        // Ensure we don't accidentally update the immutable kioskId
        delete updateData.kioskId;

        // Build the $set object properly for nested fields
        const setObject = {};
        for (const [key, value] of Object.entries(updateData)) {
            // Handle dot notation for nested fields (e.g., "printers.bw")
            if (typeof value === 'object' && value !== null && !key.includes('.')) {
                // For non-dot notation objects like { location: { region: ... } }
                // Flatten them to dot notation
                if (key === 'location' || key === 'printers' || key === 'machineDetails' || key === 'metrics' || key === 'config') {
                    for (const [subKey, subValue] of Object.entries(value)) {
                        setObject[`${key}.${subKey}`] = subValue;
                    }
                } else {
                    setObject[key] = value;
                }
            } else {
                // Already dot notation or primitive value
                setObject[key] = value;
            }
        }

        console.log(`[PATCH] /kiosks/${kioskId} - Set object:`, JSON.stringify(setObject));

        const updatedKiosk = await Kiosk.findOneAndUpdate(
            { kioskId },
            { $set: setObject },
            { new: true, runValidators: true }
        ).lean();

        if (!updatedKiosk) {
            console.log(`[PATCH] Kiosk not found: ${kioskId}`);
            return res.status(404).json({ success: false, message: "Kiosk not found" });
        }

        console.log(`[PATCH] Kiosk updated successfully: ${kioskId}`);
        res.json({ success: true, kiosk: updatedKiosk });
    } catch (err) {
        console.error(`ERROR in PATCH /kiosks/${req.params.kioskId}:`, err.message, err.stack);
        res.status(500).json({ success: false, message: err.message || "Internal server error while updating kiosk" });
    }
});

router.post("/kiosks/:kioskId/:command", (req, res) => {
    const { kioskId, command } = req.params;
    const { type, data } = req.body;

    console.log(`Sending command "${type}" to kiosk ${kioskId}`);
    if (!type || type.trim() === "" || type !== command) {
        return res.status(400).json({ success: false, message: "Command type is required" });
    }

    // if (sendToAgent(kioskId, type, data)) {
    //     return res.status(200).json({ success: true, message: `Command "${type}" sent to ${kioskId}` });
    // }

    return res.status(404).json({ success: false, message: "Kiosk not connected" });
});



export default router;
