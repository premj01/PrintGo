import express from "express";
const router = express.Router();
import kisokRedirect from "../controllers/kisokRedirectHandle.js";

router.post("/kisokRedirect", kisokRedirect);
router.get("/kisokRedirect", kisokRedirect);

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

router.get("/call-printer",async ()=>{

})

export default router;
