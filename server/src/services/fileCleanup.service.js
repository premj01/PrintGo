import fs from "fs";
import path from "path";
import { userWithFiles, allFiles } from "../state/runtimeStore.js";

export function cleanGarbageFiles() {
    const usedFiles = new Set();

    for (const uuid in userWithFiles) {
        userWithFiles[uuid].files.forEach((file) => usedFiles.add(file));
    }

    const garbageFiles = allFiles.filter((file) => !usedFiles.has(file));

    garbageFiles.forEach((file) => {
        const filePath = path.join("uploads", file);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("🗑 Deleted garbage file:", file);
        }
    });

    for (const file of garbageFiles) {
        const index = allFiles.indexOf(file);
        if (index !== -1) allFiles.splice(index, 1);
    }
}
