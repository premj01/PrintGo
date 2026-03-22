import express from "express";
import cors from "cors";
import corsOptions from "../config/cors.js";
import { registerRoutes } from "../routes/index.js";

export function createApp() {
    const app = express();

    app.use(express.json());
    app.use(cors(corsOptions));

    registerRoutes(app);


    return app;
}
