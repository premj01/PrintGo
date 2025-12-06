import { kioskSockets, userSessionIdWithKioskId } from "../server.js";

const kisokRedirect = (req, res) => {

  if (!req.query.userSessionNumber) {
    return res.status(400).send("kioskId is required");
  }
  const { userSessionNumber } = req.query;

  const kioskIdd = userSessionIdWithKioskId[userSessionNumber];
  mykiosksocket = kioskSockets[kioskIdd]?.kiosk;
  if (agentSocket && agentSocket.readyState === agentSocket.OPEN) {

  }


}

export default kisokRedirect; 