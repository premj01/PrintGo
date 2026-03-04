import { WebSocketServer } from "ws";
import { handleWebSocketConnection } from "./connectionRouter.js";

export function createWebSocketServer(server) {
    const wss = new WebSocketServer({ server });
    console.log("WebSocket server ready");

    wss.on("connection", (ws, req) => {
        handleWebSocketConnection(ws, req);
    });

    return wss;
}
