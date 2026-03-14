import express from "express";
import { kioskSockets } from "../../state/runtimeStore.js";

const router = express.Router();

// router.get("/data", (req, res) => {
//     return res.status(200).json({
//         success: true,
//         kiosks: Object.keys(kioskSockets),
//         message: "Server is running",
//     });
// });

// router.get("/health", (req, res) => {
//     return res.json({ success: true, message: "Server running" });
// });

export default router;
