import multer from "multer";
import path from "path";
import fs from "fs";
import { allowedFileTypes, allowedMimeTypes } from "../config/fileTypes.js";

const UPLOAD_DIR = "uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const fileFilter = ({ extensions = [], mimeTypes = [] } = {}) => (req, file, cb) => {
    if (!extensions.length) return cb(null, true);

    const ext = path.extname(file.originalname).toLowerCase();
    const isExtValid = extensions.includes(ext);
    const isMimeValid = mimeTypes.includes(file.mimetype);

    if (isExtValid && isMimeValid) return cb(null, true);
    return cb(new Error("File type not allowed"));
};

export const uploadMiddleware = ({
    type = "single",
    fieldName = "file",
    maxSizeMB = 100,
}) => {
    const upload = multer({
        storage,
        limits: { fileSize: maxSizeMB * 1024 * 1024 },
        fileFilter: fileFilter({
            extensions: allowedFileTypes,
            mimeTypes: allowedMimeTypes,
        }),
    });

    if (type === "single") return upload.single(fieldName);
    if (type === "array") return upload.array(fieldName, 10);

    if (type === "fields") {
        if (!Array.isArray(fieldName)) {
            throw new Error("For 'fields' type, 'fieldName' must be an array");
        }
        return upload.fields(fieldName);
    }

    throw new Error("Invalid upload type");
};
