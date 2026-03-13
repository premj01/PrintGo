import { WebSocketServer } from "ws";
import { handleWebSocketConnection } from "./connectionRouter.js";

export function createWebSocketServer(server) {
    const wss = new WebSocketServer({ server });
    console.log("WebSocket server ready");

    wss.on("connection", (ws, req) => {
        handleWebSocketConnection(ws, req).catch((err) => {
            console.error("❌ Error in WebSocket connection handler:", err);
            ws.close();
        });
    });

    return wss;
}
