import express from "express";
import { uploadMiddleware } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.post("/upload", uploadMiddleware({ type: "single", fieldName: "file" }),
  (req, res) => {
    try {
      if (!req.file) throw new Error("No file uploaded");
      console.log("Uploaded file:", req.file);
      res.json({ message: "File uploaded successfully", file: req.file });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

export default router;
