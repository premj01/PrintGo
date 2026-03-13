import { kioskSockets, userSessionIdWithKioskId } from "../../state/runtimeStore.js";
import { sendToKioskViaSocket } from "../../ws/handlers/kiosk.handler.js";
import { generateToken } from "../../util/jwt.util.js";
import prisma from "../../config/prisma.js";

const kisokRedirect = async (req, res) => {

    if (!req.body.userSessionNumber) {
        return res.status(400).send("<h1>Click reset button on kiosk to start again</h1>");
    }
    const { userSessionNumber } = req.body;

    const kioskIdd = userSessionIdWithKioskId[userSessionNumber];
    const mykiosksocket = kioskSockets[kioskIdd]?.kiosk;

    console.log(kioskIdd);

    sendToKioskViaSocket(mykiosksocket, kioskIdd, "status-user-connected-to-kiosk", {
        msg: "Connected successfully🥳"
    });

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

    const token = generateToken({ userSessionNumber: userSessionNumber });

    return res.status(200).json({ msg: "Connected successfully", token: token });
}

export default kisokRedirect;
