import { kioskSockets, userSessionIdWithKioskId } from "../../state/runtimeStore.js";
import { sendToKioskViaSocket } from "../../ws/handlers/kiosk.handler.js";

const kisokRedirect = (req, res) => {

    if (!req.query.userSessionNumber) {
        return res.status(400).send("kioskId is required");
    }
    const { userSessionNumber } = req.query;

    const kioskIdd = userSessionIdWithKioskId[userSessionNumber];
    const mykiosksocket = kioskSockets[kioskIdd]?.kiosk;

    sendToKioskViaSocket(mykiosksocket, kioskIdd, "status-user-connected-to-kiosk", {
        msg: "user has connected successfully"
    })


}

export default kisokRedirect;
