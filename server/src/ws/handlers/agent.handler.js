import { kioskSockets } from "../../state/runtimeStore.js";

export function handleAgentConnection(ws, kioskId, sockets) {
    console.log(`🧠 Agent connected for kiosk: ${kioskId}`);

    ws.on("should-start-kiosk", (msg) => {
        try {
            JSON.parse(msg.toString());
            ws.send(
                JSON.stringify({
                    type: "start-kiosk-now",
                    data: { msg: `AgentHandler Default :Agent connected for kiosk ${kioskId}` },
                })
            );
        } catch (err) {
            console.log("type : should-start-kiosk " + err);
        }
    });

    ws.on("close", () => {
        console.log(`🚪 Agent disconnfected for kiosk: ${kioskId}`);
        delete sockets[kioskId];
    });

    ws.on("error", (err) => {
        console.error(`⚠️ Agent socket error for kiosk ${kioskId}:`, err.message);
    });
}

export function sendToAgent(kioskId, type, data = { msg: "No data provided" }) {
    const agentSocket = kioskSockets[kioskId]?.agent;
    if (agentSocket && agentSocket.readyState === agentSocket.OPEN) {
        agentSocket.send(JSON.stringify({ type, data }));
        console.log(`📤 Sent ${type} to agent for kiosk ${kioskId}`);
        return true;
    }
    return false;
}
