// import multer from "multer";
// import path from "path";
// import fs from "fs";
// import { allowedFileTypes, allowedMimeTypes } from "../configurations/fileTypes.js";

// const UPLOAD_DIR = "uploads";
// if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// // Storage config
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, UPLOAD_DIR),
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(null, uniqueSuffix + path.extname(file.originalname));
//   },
// });

// // File filter
// const fileFilter = (types = { extensions: [], mimeTypes: [] }) => (req, file, cb) => {
//   if (!types.extensions.length) return cb(null, true);

//   const extName = types.extensions.includes(path.extname(file.originalname).toLowerCase());
//   const mimeType = types.mimeTypes.includes(file.mimetype);

//   if (extName && mimeType) cb(null, true);
//   else cb(new Error("File type not allowed"));
// };

// // Middleware factory
// export const uploadMiddleware = ({ type = "single", fieldName = "file", maxSizeMB = 100 }) => {
//   const upload = multer({
//     storage,
//     limits: { fileSize: maxSizeMB * 1024 * 1024 },
//     fileFilter: fileFilter({ extensions: allowedFileTypes, mimeTypes: allowedMimeTypes }),
//   });

//   if (type === "single") return upload.single(fieldName);
//   if (type === "array") return upload.array(fieldName, 10);
//   if (type === "fields") return upload.fields([{ name: fieldName, maxCount: 5 }]);
// };

import multer from "multer";
import path from "path";
import fs from "fs";
import { allowedFileTypes, allowedMimeTypes } from "../configurations/fileTypes.js";

const UPLOAD_DIR = "uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter
const fileFilter = ({ extensions = [], mimeTypes = [] } = {}) => (req, file, cb) => {
  if (!extensions.length) return cb(null, true); // allow all if empty

  const ext = path.extname(file.originalname).toLowerCase();
  const isExtValid = extensions.includes(ext);
  const isMimeValid = mimeTypes.includes(file.mimetype);

  if (isExtValid && isMimeValid) return cb(null, true);
  return cb(new Error("File type not allowed"));
};

// Middleware factory
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

  // Single file
  if (type === "single") return upload.single(fieldName);

  // Multiple files with SAME field name
  if (type === "array") return upload.array(fieldName, 10);

  // Multiple fields with DIFFERENT field names
  // fieldName MUST be an array:
  // [{ name: "image", maxCount: 1 }, { name: "docs", maxCount: 5 }]
  if (type === "fields") {
    if (!Array.isArray(fieldName)) {
      throw new Error("For 'fields' type, 'fieldName' must be an array");
    }
    return upload.fields(fieldName);
  }

  throw new Error("Invalid upload type");
};
