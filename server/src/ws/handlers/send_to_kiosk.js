import fs from "fs";
import { sendToKioskViaSocket } from "./kiosk.handler.js";

const send_file_to_kiosk = ({ kioskId, kiosk, fileDetails, sessionId }) => {

    const { userName, fileName, mail, filePath } = fileDetails;

    const stat = fs.statSync(filePath);

    const CHUNK_SIZE = 256 * 1024;

    const totalChunks = Math.ceil(stat.size / CHUNK_SIZE);

    // SEND METADATA FIRST
    sendToKioskViaSocket(kiosk, kioskId, "metadata-before-file-sending", {
        userName,
        fileName,
        fileSize: stat.size,
        totalChunks,
        mail,
        sessionId
    });

    const stream = fs.createReadStream(filePath, {
        highWaterMark: CHUNK_SIZE
    });

    // SEND FILE CHUNKS
    stream.on("data", (chunk) => {
        kiosk.send(chunk, { binary: true });
    });

    // FILE END
    stream.on("end", () => {

        sendToKioskViaSocket(kiosk, kioskId, "ack-after-file-sent", {
            fileName,
            sessionId,
            kioskId
        });

        console.log("File sent to client");
    });
};

export default send_file_to_kiosk;