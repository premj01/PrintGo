import fs from "fs"
import { sendToKiosk, sendToKioskViaSocket } from "./kioskHandler";

const send_file_to_kiosk = ({ kioskId, kiosk, fileDetails, sessionId }) => {

    // const filePath = "./sample.pdf";  // change your file
    const { userName, fileName, mail, filePath } = fileDetails;
    // Read file as binary
    const fileBuffer = fs.readFileSync(filePath);
    // chunks: [],
    // totalChunks: data.totalChunks,
    const CHUNK_SIZE = 64 * 1024; // 64KB
    const chunks = [];

    for (let i = 0; i < fileBuffer.length; i += CHUNK_SIZE) {
        chunks.push(fileBuffer.slice(i, i + CHUNK_SIZE));
    }


    sendToKioskViaSocketk(kiosk, kioskId, "metadata-before-file-sending", { userName: userName, fileName: fileName, fileSize: fileBuffer.length, totalChuncks: chunks.length, mail: mail, sessionId: sessionId })

    // sending some metadata before actual file
    // Send file to client

    // kiosk.send(fileBuffer);
    chunks.forEach((chunk, index) => {
        const header = Buffer.from(JSON.stringify({
            type: "file-chunk",
            chunkIndex: index,
            totalChunks: chunks.length
        }));

        const headerLength = Buffer.alloc(4);
        headerLength.writeUInt32BE(header.length);

        const payload = Buffer.concat([headerLength, header, chunk]);

        ws.send(payload);
    });


    sendToKioskViaSocket(kiosk, kioskId, "ack-after-file-sent", { fileName, sessionId, kioskId });

    console.log("File sent to client");
}
export default send_to_kiosk;