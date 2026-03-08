import { v4 as uuidv4 } from "uuid";
import { handleKioskConnection } from "./handlers/kiosk.handler.js";
import { handleAgentConnection } from "./handlers/agent.handler.js";
import { validateKioskId } from "./validators/validateKioskId.js";
import { kioskSockets, userSessionIdWithKioskId } from "../state/runtimeStore.js";

export function handleWebSocketConnection(ws, req) {
    const urlParams = new URLSearchParams(req.url.replace("/", ""));
    const role = urlParams.get("role").trim();
    const kioskid = urlParams.get("kioskid").trim();

    if (!role || !kioskid) {
        console.log("Missing role or kioskid. Closing connection.");
        ws.send(JSON.stringify({ event: "error", data: "Missing role or kioskid" }));
        ws.close();
        return;
    }

    if (!validateKioskId(kioskid)) {
        console.log(`❌ Invalid kiosk ID: ${kioskid}`);
        ws.send(JSON.stringify({ event: "error", data: "Invalid kiosk ID" }));
        ws.close();
        return;
    }

    if (!kioskSockets[kioskid]) {
        kioskSockets[kioskid] = {
            kioskid,
            agent: null,
            kiosk: null,
            userSessionUUID: null,
            createdAt: new Date().toISOString(),
        };
    }

    if (role === "kiosk") {
        if (Object.values(userSessionIdWithKioskId).includes(kioskid)) {
            const previousKey = Object.keys(userSessionIdWithKioskId).find(
                (key) => userSessionIdWithKioskId[key] === kioskid
            );
            delete userSessionIdWithKioskId[previousKey];
        }

        const uid = `${uuidv4()}-${Date.now()}`;
        kioskSockets[kioskid].kiosk = ws;
        kioskSockets[kioskid].userSessionUUID = uid;
        userSessionIdWithKioskId[uid] = kioskid;

        handleKioskConnection(ws, kioskid, kioskSockets);

        ws.on("close", () => {
            console.log(`⚠️ Kiosk disconnected: ${kioskid}`);
            if (kioskSockets[kioskid]) {
                kioskSockets[kioskid].kiosk = null;
                delete userSessionIdWithKioskId[kioskSockets[kioskid].userSessionUUID];

                if (kioskSockets[kioskid].agent) {
                    kioskSockets[kioskid].agent.send(
                        JSON.stringify({
                            type: "restart-kiosk-now",
                            data: { msg: `Kiosk ${kioskid} disconnected. Please restart.` },
                        })
                    );
                }
            }
        });
        return;
    }

    if (role === "agent") {
        kioskSockets[kioskid].agent = ws;
        handleAgentConnection(ws, kioskid, kioskSockets);

        ws.on("close", () => {
            console.log(`⚠️ Agent disconnected for kiosk: ${kioskid}`);
            const previousKey = Object.keys(userSessionIdWithKioskId).find(
                (key) => userSessionIdWithKioskId[key] === kioskid
            );
            delete userSessionIdWithKioskId[previousKey];
            delete kioskSockets[kioskid];
        });
        return;
    }

    console.log("Unknown role. Closing connection.");
    ws.close();
}
