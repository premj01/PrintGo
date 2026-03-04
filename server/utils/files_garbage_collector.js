import fs from "fs";
import path from "path";
import { userWithFiles, allFiles } from "./server.js";

export function cleanGarbageFiles() {
  const usedFiles = new Set();

  // Collect all files still referenced by users
  for (const uuid in userWithFiles) {
    userWithFiles[uuid].files.forEach(file => usedFiles.add(file));
  }

  // Find files that are NOT referenced
  const garbageFiles = allFiles.filter(file => !usedFiles.has(file));

  // Delete from disk + allFiles
  garbageFiles.forEach(file => {
    const filePath = path.join("uploads", file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("🗑 Deleted garbage file:", file);
    }
  });

  // Clean allFiles list
  for (const file of garbageFiles) {
    const index = allFiles.indexOf(file);
    if (index !== -1) allFiles.splice(index, 1);
  }
}



// import { cleanGarbageFiles } from "./utils/cleaner.js";

// setInterval(() => {
//   console.log("🔄 Running garbage cleanup...");
//   cleanGarbageFiles();
// }, 1000 * 60 * 5); // every 5 minutes
