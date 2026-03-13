import { v4 as uuidv4 } from "uuid";
import { handleKioskConnection } from "./handlers/kiosk.handler.js";
import { handleAgentConnection } from "./handlers/agent.handler.js";
import { handleAdminConnection } from "./handlers/admin.handler.js";
import { validateKioskId } from "./validators/validateKioskId.js";
import { kioskSockets, userSessionIdWithKioskId, adminState, adminSockets } from "../state/runtimeStore.js";
import jwt from "jsonwebtoken";
import Admin from "../models/admin.model.js";

export async function handleWebSocketConnection(ws, req) {
    const urlParams = new URLSearchParams(req.url.replace("/", ""));
    const role = urlParams.get("role")?.trim();

    if (!role) {
        console.log("Missing role. Closing connection.");
        ws.send(JSON.stringify({ event: "error", data: "Missing role" }));
        ws.close();
        return;
    }

    // ── Admin role (no kioskid required, single admin at a time) ──────────
    if (role === "admin") {
        const token = urlParams.get("token")?.trim();
        if (!token) {
            console.log("❌ Admin connection rejected: Missing token");
            ws.send(JSON.stringify({ event: "error", data: "Authentication token required" }));
            ws.close();
            return;
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const admin = await Admin.findById(decoded.id);

            if (!admin || !admin.isActive) {
                console.log("❌ Admin connection rejected: Admin not found or inactive");
                ws.send(JSON.stringify({ event: "error", data: "Unauthorized or inactive account" }));
                ws.close();
                return;
            }

            // We no longer kick out old admins! Multiple are now supported.
            const adminSessionId = uuidv4();

            adminSockets[adminSessionId] = {
                ws,
                connectedAt: new Date().toISOString(),
                adminInfo: { id: admin._id, username: admin.username, role: admin.role },
                viewingKioskId: null
            };

            // Temporarily assign adminState as a fallback reference
            adminState.ws = ws;
            adminState.connectedAt = new Date().toISOString();
            adminState.adminInfo = { id: admin._id, username: admin.username, role: admin.role };

            handleAdminConnection(ws, adminSessionId);

            ws.on("close", () => {
                console.log(`⚠️ Admin disconnected: ${admin.username} (${adminSessionId})`);

                // Release the kiosk lock if they had one
                const viewingKioskId = adminSockets[adminSessionId]?.viewingKioskId;
                if (viewingKioskId && kioskSockets[viewingKioskId] && kioskSockets[viewingKioskId].lockedByAdmin === adminSessionId) {
                    kioskSockets[viewingKioskId].lockedByAdmin = null;
                }

                delete adminSockets[adminSessionId];

                if (adminState.ws === ws) {
                    adminState.ws = null;
                    adminState.connectedAt = null;
                    adminState.adminInfo = null;
                }
            });
        } catch (err) {
            console.log("❌ Admin connection rejected: Invalid token -", err.message);
            ws.send(JSON.stringify({ event: "error", data: "Invalid authentication token" }));
            ws.close();
        }
        return;
    }

    // ── Kiosk & Agent roles (kioskid required) ────────────────────────────
    const kioskid = urlParams.get("kioskid")?.trim();

    if (!kioskid) {
        console.log("Missing kioskid. Closing connection.");
        ws.send(JSON.stringify({ event: "error", data: "Missing kioskid" }));
        ws.close();
        return;
    }

    if (!(await validateKioskId(kioskid))) {
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
