import express from "express";
const router = express.Router();

// Example user route: get kiosk status
router.get("/kiosks/:kioskId/status", (req, res) => {
  const { kioskId } = req.params;
  const kiosk = req.kioskSockets[kioskId];

  if (!kiosk) return res.status(404).json({ success: false, message: "Kiosk not found" });

  res.json({
    success: true,
    kioskId,
    connected: !!kiosk.kiosk,
    agentConnected: !!kiosk.agent
  });
});

export default router;
