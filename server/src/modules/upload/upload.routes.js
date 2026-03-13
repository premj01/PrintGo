import express from "express";
import { uploadMiddleware } from "../../middleware/uploadMiddleware.js";
import { userWithFiles, allFiles } from "../../state/runtimeStore.js";

const router = express.Router();

router.post("/upload-metadata", (req, res) => {
    
})

router.post(
    "/upload",
    uploadMiddleware({ type: "array", fieldName: "file" }),
    (req, res) => {
        const { uuid, userId } = req.body;

        if (!uuid || !userId) {
            return res.status(400).json({ error: "uuid and userId required" });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }

        if (!userWithFiles[uuid]) {
            userWithFiles[uuid] = { userId, files: [] };
        }

        req.files.forEach((file) => {
            userWithFiles[uuid].files.push(file.filename);
            allFiles.push(file.filename);
        });

        console.log("🔹 Updated userWithFiles:", userWithFiles);
        console.log("🔹 Updated allFiles:", allFiles);

        return res.json({
            message: "Files uploaded",
            uploaded: req.files.map((file) => file.filename),
        });
    }
);

export default router;
