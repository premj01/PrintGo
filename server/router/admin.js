import express from "express";
const router = express.Router();
import { sendToAgent } from "../Handlers/agentHandler.js";
import { kioskSockets, userSessionIdWithKioskId } from "../server.js";

// Get all kiosks
router.get("/kiosks", (req, res) => {
  const kiosks = Object.keys(kioskSockets).map(id => ({
    kioskId: id,
    connected: !!kioskSockets[id].kiosk,
    agentConnected: !!kioskSockets[id].agent
  }));
  res.json({ success: true, kioskSockets, userSessionIdWithKioskId });
});

// Send command to a kiosk
router.post("/kiosks/:kioskId/:command", (req, res) => {
  const { kioskId, command } = req.params;
  const { type, data } = req.body;

  console.log(`Sending command "${type}" to kiosk ${kioskId}`);
  if (!type || type.trim() === "" || type !== command) {
    return res.status(400).json({ success: false, message: "Command type is required" });
  }
  // const agentSocket = req.kioskSockets[kioskId]?.agent;
  // if (agentSocket && agentSocket.readyState === agentSocket.OPEN) {
  //   agentSocket.send(JSON.stringify({ type, data: { msg: `manual drive data :${kioskId}` } }));
  //   return res.json({ success: true, message: `Command "${type}" sent to ${kioskId}` });
  // }
  if (sendToAgent(kioskId, type, data)) {
    return res.status(200).json({ success: true, message: `Command "${type}" sent to ${kioskId}` });
  }
  return res.status(404).json({ success: false, message: "Kiosk not connected" });
});



export default router;
