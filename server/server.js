import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";


import { handleKioskConnection } from "./Handlers/kioskHandler.js";
import { handleAgentConnection } from "./Handlers/agentHandler.js";

import adminRoutes from "./router/admin.js";
import userRoutes from "./router/user.js";
import authRoutes from "./router/auth.js";
import uploadRoutes from "./router/upload.js";

import corsOptions from "./configurations/cors.js";


const app = express();
const server = http.createServer(app);
app.use(express.json());
app.use(cors(corsOptions));

app.use("/uploads", express.static("uploads"));
app.use("/userdocs", uploadRoutes);

const wss = new WebSocketServer({ server });

export const kioskSockets = {}; // { kioskId: { kioskid, agent, kiosk, uuid, createdAt } }
export const userSessionIdWithKioskId = {}; // { uuid : kioskId }
export const userWithFiles = {}; // { uuid : {userId , files[] , isFileOnKiosk} }
export const allFiles = []; // array of file 

console.log("WebSocket server ready");

// Dummy validation function for kiosk existence
function validateKioskId(kioskid) {
  const validKiosks = ["KIOSK001", "KIOSK002", "KIOSK003"]; // sample list
  return validKiosks.includes(kioskid);
}

wss.on("connection", (ws, req) => {
  const urlParams = new URLSearchParams(req.url.replace("/", ""));
  const role = urlParams.get("role").trim();
  const kioskid = urlParams.get("kioskid").trim();


  if (!role || !kioskid) {
    console.log("Missing role or kioskid. Closing connection.");
    ws.send(JSON.stringify({ event: "error", data: "Missing role or kioskid" }));
    ws.close();
    return;
  }

  // Step 1: Validate Kiosk ID
  if (!validateKioskId(kioskid)) {
    console.log(`❌ Invalid kiosk ID: ${kioskid}`);
    ws.send(JSON.stringify({ event: "error", data: "Invalid kiosk ID" }));
    ws.close();
    return;
  }

  // Step 2: Create or update kiosk entry
  if (!kioskSockets[kioskid]) {
    kioskSockets[kioskid] = {
      kioskid,
      agent: null,
      kiosk: null,
      referenceId: null,
      createdAt: new Date().toISOString(),
    };
  }


  // Step 3: Assign the socket and set up disconnection handling
  if (role === "kiosk") {


    if (Object.values(userSessionIdWithKioskId).includes(kioskid)) {
      delete userSessionIdWithKioskId[Object.keys(userSessionIdWithKioskId).find(key => userSessionIdWithKioskId[key] === kioskid)];
    }

    const uid = `${uuidv4()}-${Date.now()}`
    kioskSockets[kioskid].kiosk = ws;
    kioskSockets[kioskid].referenceId = uid;
    userSessionIdWithKioskId[uid] = kioskid;       //assign user session id with kiosk id

    // console.log(`✅ Kiosk connected: ${kioskid}`);
    handleKioskConnection(ws, kioskid, kioskSockets);

    ws.on("close", () => {
      console.log(`⚠️ Kiosk disconnected: ${kioskid}`);
      // Remove only the kiosk reference
      kioskSockets[kioskid].kiosk = null;
      delete userSessionIdWithKioskId[kioskSockets[kioskid].referenceId];


      // Notify agent to restart kiosk if agent is connected
      if (kioskSockets[kioskid].agent) {
        kioskSockets[kioskid].agent.send(JSON.stringify({
          type: "restart-kiosk-now",
          data: { msg: `Kiosk ${kioskid} disconnected. Please restart.` }
        }));
      }
    });

  } else if (role === "agent") {
    kioskSockets[kioskid].agent = ws;
    // console.log(`🧑‍💻 Agent connected for: ${kioskid}`);
    handleAgentConnection(ws, kioskid, kioskSockets);

    ws.on("close", () => {
      console.log(`⚠️ Agent disconnected for kiosk: ${kioskid}`);
      // Remove the entire kiosk object
      // if agent stopped then entire kiosk de-register 
      delete userSessionIdWithKioskId[Object.keys(userSessionIdWithKioskId).find(key => userSessionIdWithKioskId[key] === kioskid)];
      delete kioskSockets[kioskid];
    });

  } else {
    console.log("Unknown role. Closing connection.");
    ws.close();
  }
});


// app.use((req, res, next) => {
//   req.kioskSockets = kioskSockets;
//   next();
// });

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/", userRoutes);


// Example endpoint
app.get("/data", (req, res) => {
  return res.status(200).json({
    success: true,
    kiosks: Object.keys(kioskSockets),
    message: "Server is running",
  });
});

app.get("/health", (req, res) => res.json({ success: true, message: "Server running" }));

server.listen(3000, () =>
  console.log("✅ WebSocket + Express server running on port 3000")
);
