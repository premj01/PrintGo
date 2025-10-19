export function handleAgentConnection(ws, kioskId, kioskSockets) {
  console.log(`🧠 Agent connected for kiosk: ${kioskId}`);

  ws.send(JSON.stringify({
    type: "start-kiosk-now",
    data: { msg: `AgentHandler Default :Agent connected for kiosk ${kioskId}` }
  }));

  ws.on("close", () => {
    console.log(`🚪 Agent disconnected for kiosk: ${kioskId}`);
    // Remove the entire kiosk object
    delete kioskSockets[kioskId];
  });

  ws.on("error", (err) => {
    console.error(`⚠️ Agent socket error for kiosk ${kioskId}:`, err.message);
  });
}

// Helper function to send commands/events to agent manually
import { kioskSockets } from "../server.js";
export function sendToAgent(kioskId, type, data = { msg: "No data provided" }) {
  const agentSocket = kioskSockets[kioskId]?.agent;
  if (agentSocket && agentSocket.readyState === agentSocket.OPEN) {
    agentSocket.send(JSON.stringify({ type, data }));
    console.log(`📤 Sent ${type} to agent for kiosk ${kioskId}`);
    return true;
  } else {
    return false;
  }
}

// Example usage from server/admin code:
// sendToAgent(kioskSockets, "KIOSK001", "start-kiosk-now", { msg: "Admin triggered start" });
