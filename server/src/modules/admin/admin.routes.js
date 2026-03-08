import express from "express";
import { sendToAgent } from "../../ws/handlers/agent.handler.js";
import { kioskSockets, userSessionIdWithKioskId } from "../../state/runtimeStore.js";

const router = express.Router();

router.get("/kiosks", (req, res) => {
    const kiosks = Object.keys(kioskSockets).map(id => ({
        kioskId: id,
        connected: !!kioskSockets[id].kiosk,
        agentConnected: !!kioskSockets[id].agent
    }));
    res.json({ success: true, kioskSockets, userSessionIdWithKioskId });
});

router.post("/kiosks/:kioskId/:command", (req, res) => {
    const { kioskId, command } = req.params;
    const { type, data } = req.body;

    console.log(`Sending command "${type}" to kiosk ${kioskId}`);
    if (!type || type.trim() === "" || type !== command) {
        return res.status(400).json({ success: false, message: "Command type is required" });
    }

    if (sendToAgent(kioskId, type, data)) {
        return res.status(200).json({ success: true, message: `Command "${type}" sent to ${kioskId}` });
    }

    return res.status(404).json({ success: false, message: "Kiosk not connected" });
});

export default router;
