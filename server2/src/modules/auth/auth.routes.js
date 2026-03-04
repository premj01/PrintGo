import express from "express";
import { googleLogin, authProbe } from "./auth.controller.js";

const router = express.Router();

router.post("/google", googleLogin);
router.get("/pr", authProbe);

export default router;
