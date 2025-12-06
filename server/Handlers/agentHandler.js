//when agent connects with role agent this handler invoke with ws,kioskid(unique id for each kisok),kiosksocket (agent socket object ) and all the objects also stored globally 

export function handleAgentConnection(ws, kioskId, kioskSockets) {
  console.log(`🧠 Agent connected for kiosk: ${kioskId}`);

  // when agent connected automatically send message to agent to start kisok (agents -> start -> kisok)
  // kiosk is not automated ... only agent automated (ensures agent is live)
  

  ws.on("should-start-kiosk",(msg)=>{
    try{
      const data = JSON.parse(msg.toString());  
      ws.send(JSON.stringify({
      type: "start-kiosk-now",  
      data: { msg: `AgentHandler Default :Agent connected for kiosk ${kioskId}` }
  }));
    }catch(err)
    {
      console.log("type : should-start-kiosk "+ err);
    }
  })

  ws.on("close", () => {
    console.log(`🚪 Agent disconnfected for kiosk: ${kioskId}`);
    // Remove the entire kiosk object
    delete kioskSockets[kioskId];
  });

  ws.on("error", (err) => {
    console.error(`⚠️ Agent socket error for kiosk ${kioskId}:`, err.message);
  });
}

// Helper function to send commands/events to agent manually (all for one function... call by event name nothing else required like start-kiosk-now , restart-kiosk-now , stop-kiosk-now , kiosk-status-check , restart-system-now , update-system-now , update-kiosk-now )
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
