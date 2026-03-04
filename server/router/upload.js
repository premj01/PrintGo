// import express from "express";
// import multer from "multer";
// import { uploadMiddleware } from "../middleware/uploadMiddleware.js";

// const router = express.Router();

// router.post(
//   "/upload",
//   uploadMiddleware({ type: "array", fieldName: "file" }),
//   (req, res) => {
//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({ error: "No files uploaded" });
//     }

//     console.log("Uploaded files:", req.files);

//     res.json({
//       message: "Files uploaded successfully",
//       files: req.files,
//     });
//   }
// );

// // Multer error handler (optional but recommended)
// router.use((err, req, res, next) => {
//   if (err instanceof multer.MulterError) {
//     return res.status(400).json({ error: err.message });
//   }
//   return res.status(500).json({ error: err.message });
// });

// export default router;


import express from "express";
import { uploadMiddleware } from "../middleware/uploadMiddleware.js";
import { userWithFiles, allFiles } from "../server.js";

const router = express.Router();

router.post(
  "/upload",
  uploadMiddleware({ type: "array", fieldName: "file" }),
  (req, res) => {
    const { uuid, userId } = req.body; // must come from client

    if (!uuid || !userId) {
      return res.status(400).json({ error: "uuid and userId required" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Create user bucket if not exists
    if (!userWithFiles[uuid]) {
      userWithFiles[uuid] = { userId, files: [] };
    }

    // Add uploaded files to user's file list & global file list
    req.files.forEach(f => {
      userWithFiles[uuid].files.push(f.filename);
      allFiles.push(f.filename);
    });

    console.log("🔹 Updated userWithFiles:", userWithFiles);
    console.log("🔹 Updated allFiles:", allFiles);

    res.json({
      message: "Files uploaded",
      uploaded: req.files.map(f => f.filename),
    });
  }
);

export default router;
