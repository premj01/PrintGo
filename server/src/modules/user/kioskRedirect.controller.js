import { kioskSockets, userSessionIdWithKioskId } from "../../state/runtimeStore.js";
import { sendToKioskViaSocket } from "../../ws/handlers/kiosk.handler.js";
import { generateToken } from "../../util/jwt.util.js";

const kisokRedirect = async (req, res) => {

    try {
        const userSessionNumber = req.body.userSessionNumber || req.body.userSessionUUID;

        if (!userSessionNumber) {
            return res.status(400).json({ msg: "userSessionNumber is required" });
        }

        const kioskIdd = userSessionIdWithKioskId[userSessionNumber];
        if (!kioskIdd) {
            return res.status(404).json({ msg: "Please scan a fresh kiosk QR code" });
        }

        const mykiosksocket = kioskSockets[kioskIdd]?.kiosk;
        if (!mykiosksocket) {
            return res.status(503).json({ msg: "Kiosk is currently offline" });
        }

        // sendToKioskViaSocket(mykiosksocket, kioskIdd, "status-user-connected-to-kiosk", {
        //     msg: "Connected successfully"
        // });

        // First DB save — create NoAuthUser record for this session
        // try {
        //     await prisma.noAuthUser.create({
        //         data: {
        //             userSessionNumber,
        //             kioskId: kioskIdd || "unknown",
        //         },
        //     });
        //     console.log(`✅ NoAuthUser saved for session: ${userSessionNumber}`);
        // } catch (err) {
        //     console.error("❌ Failed to save NoAuthUser:", err.message);
        // }

        const token = generateToken({ userSessionNumber: userSessionNumber, kioskId: kioskIdd });
        console.log("user connected with JWT send :" + token);

        return res.status(200).json({ msg: "Connected successfully", token: token, kioskId: kioskIdd });
    } catch (error) {
        console.error("kiosk redirect error:", error.message);
        return res.status(500).json({ msg: "Failed to connect kiosk session" });
    }
}

export default kisokRedirect;
