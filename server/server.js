import "dotenv/config";
import http from "http";
import { createApp } from "./src/app/createApp.js";
import { createWebSocketServer } from "./src/ws/createWebSocketServer.js";
import connectMongoDB from "./src/config/mongoose.js";
import { startS3LifecycleCleanupJob } from "./src/services/s3FileLifecycle.service.js";
(async () => {
    // 1. Connect to MongoDB Atlas (for Kiosk records)
    await connectMongoDB();

    // 2. Start WebSocket & Express server
    const app = createApp();
    const server = http.createServer(app);

    createWebSocketServer(server);
    startS3LifecycleCleanupJob();

    server.listen(3000, () => {
        console.log("✅ WebSocket + Express server running on port 3000");
    });
})();
