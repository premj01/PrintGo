import fs from "fs";

const send_file_to_kiosk = ({ kioskId, kiosk, fileDetails, sessionId }) => {
    const { userName, fileName, mail, filePath } = fileDetails;

    const stat = fs.statSync(filePath);

    sendToKioskViaSocket(kiosk, kioskId, "metadata-before-file-sending", {
        userName,
        fileName,
        fileSize: stat.size,
        mail,
        sessionId
    });

    const stream = fs.createReadStream(filePath, {
        highWaterMark: 256 * 1024   // 256 KB chunks (faster)
    });

    stream.on("data", (chunk) => {
        kiosk.send(chunk); // send binary directly
    });

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