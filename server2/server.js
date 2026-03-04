import http from "http";
import { createApp } from "./src/app/createApp.js";
import { createWebSocketServer } from "./src/ws/createWebSocketServer.js";

const app = createApp();
const server = http.createServer(app);

createWebSocketServer(server);

server.listen(3000, () => {
    console.log("✅ WebSocket + Express server running on port 3000");
});
