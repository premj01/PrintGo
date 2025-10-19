const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { print } = require("pdf-to-printer");
// const { text } = require("stream/consumers");
const kioskNativeResources = require('../resources.json')
const WebSocket = require("ws");
const { log } = require("console");


let win;
let TEMPKIOSKID;
let socket;

// new BrowserWindow({
//   title: "PrintGo : Easy Printing Solution..",
//   width: 800,
//   height: 600,
//   // kiosk: true,       // fullscreen kiosk mode
//   // frame: false,      // no window frame
//   alwaysOnTop: true,
//   // autoHideMenuBar: true,
//   webPreferences: {
//     nodeIntegration: true,
//     contextIsolation: false
//   }
// });


// reconnect settings

const RECONNECT_DELAY = 2000;

function connectSocket() {
  const SERVER_URL = `${kioskNativeResources.SERVER_URL}?role=kiosk&kioskid=${kioskNativeResources.kioksid}`;
  safeSend('status', { text: "Initializing connection with server..." });
  socket = new WebSocket(SERVER_URL);

  socket.on("open", () => {
    console.log(" Connected to server");
    safeSend('status', { text: "Connected to server" });
  });

  socket.on("message", (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      const { type, data } = parsed;
      switch (type) {

        case "new-job":
          // console.log("New job received:", parsed.data);
          // win.webContents.send('status', { text: "Initiating Your print" });
          // let printJobpath = "./files/data.pdf";
          // const status = printPDF(printJobpath);

          // sendEvent("after-printing-status", {
          //   status: true,
          //   msg: status || "printing successful"
          // });
          break;

        case "register-kiosk-request":
          TEMPKIOSKID = data.tempkisokid;
          // console.log("registration started");
          win.webContents.send('status', {
            serverStatus: data.serverStatus,
            text: "Connecting to server..."
          });
          win.webContents.send('setMachineId', {
            kioskid: data.kioskid
          });
          sendEvent("register-kiosk", {
            kioskid: data.kioskid,
            kioskStatus: "Active"
          });
          win.webContents.send('status', {
            serverStatus: data.serverStatus,
            text: "we are ready to go"
          });
          break;

        default:
          console.log("Unknown message:", type, "  :", data);
      }
    } catch (e) {
      console.error("Failed to parse message:", msg.toString());
    }
  });

  socket.on("close", () => {
    console.log("❌ Disconnected from server");
    setTimeout(connectSocket, RECONNECT_DELAY);
  }
  );

  socket.on("error", (err) => {
    console.error("⚠️ Connection error:", err.message);
  });
}

function sendEvent(type, data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, data }));
  }
}

function createWindow() {
  win = new BrowserWindow({
    title: "PrintGo : Easy Printing Solution..",
    width: 800,
    height: 600,
    // kiosk: true,       // fullscreen kiosk mode
    // frame: false,      // no window frame
    // alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile("index.html");
  // win.loadFile("app/dist/index.html");
  win.once('ready-to-show', () => win.show());

  // Disable devtools for privacy
  // win.webContents.on("devtools-opened", () => win.webContents.closeDevTools());
}

app.whenReady().then(() => {
  createWindow();
  connectSocket();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function safeSend(channel, data) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}

// Send back job status updates
function printPDF(filePath) {
  safeSend('status', { text: "Printing Started.." });

  return print(filePath)
    .then(() => {
      console.log("Printed successfully!");
      safeSend('status', { text: "Printed Successfully 🎉" });
    })
    .catch((err) => {
      console.error("Error printing PDF:", err);
      safeSend('status', { text: `Something Wrong Happened<br>${err}` });
      return err;
    });
}

// module.exports = { safeSend }