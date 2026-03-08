import path from "path";
import { fileURLToPath } from "url";
import { kioskSockets } from "../state/runtimeStore.js";
import send_file_to_kiosk from "./handlers/send_to_kiosk.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.resolve(__dirname, "../../uploads/cdpr.pdf");

function test_file_sending_to_kiosk() {


    send_file_to_kiosk({
        kioskId: "KIOSK001",
        kiosk: kioskSockets["KIOSK001"].kiosk,
        fileDetails: {
            userName: "prem",
            fileName: "cdpr.pdf",
            mail: "premjadhav00002@gmail.com",
            filePath,
        },
        sessionId: kioskSockets["KIOSK001"].userSessionUUID,
    });
}

export default test_file_sending_to_kiosk;