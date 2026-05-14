# PrintGo — System Architecture & Documentation

> Generated: May 2026  
> Stack: React + TypeScript (frontend) · Node.js / Express + WebSocket (backend) · MongoDB Atlas · PostgreSQL (Prisma) · AWS S3

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Data Flow Diagram (DFD)](#3-data-flow-diagram-dfd)
4. [ER Diagram](#4-er-diagram)
5. [UML Class Diagram](#5-uml-class-diagram)
6. [All REST API Endpoints](#6-all-rest-api-endpoints)
7. [All WebSocket Events](#7-all-websocket-events)

---

## 1. System Overview

PrintGo is a **self-service kiosk printing platform**. Users scan a QR code displayed on a physical kiosk, upload a PDF from their phone/browser, configure print options, pay, and the kiosk prints the document automatically.

### Key Actors

| Actor | Description |
|---|---|
| **User** | Scans QR code, uploads PDF, pays, collects printout |
| **Kiosk App** | Electron/web app running on the physical kiosk machine |
| **Agent** | Node.js daemon on the kiosk machine managing OS/printer/PM2 |
| **Admin** | Dashboard user managing kiosks, printers, and accounts |
| **Server** | Central Express + WebSocket server orchestrating everything |

### Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui, React Router v6 |
| Backend | Node.js, Express.js, `ws` (WebSocket), node-cron |
| Primary DB | MongoDB Atlas (Mongoose) — Kiosk & Admin records |
| Transaction DB | PostgreSQL via Prisma — anonymous print sessions |
| File Storage | AWS S3 (signed URLs for upload/download) |
| Auth (User) | JWT (short-lived, 10 min) issued after QR scan |
| Auth (Admin) | JWT (30 min) + Google OAuth for regular users |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          USER'S PHONE / BROWSER                             │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    React SPA  (printgoapp)                           │  │
│  │                                                                      │  │
│  │  Pages: Home → KioskRedirect → Upload → Preview → Payment →         │  │
│  │         PrintingStatus                                               │  │
│  │                                                                      │  │
│  │  Admin: /admin/login → /admin (Dashboard, Regions, KioskDetail,     │  │
│  │         Accounts)                                                    │  │
│  │                                                                      │  │
│  │  Services: authService · kioskPrintService · uploadService          │  │
│  │  Contexts: AuthContext · AdminAuthContext · AdminSocketContext       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│          │  REST (axios)                │  WebSocket (admin only)           │
└──────────┼──────────────────────────────┼───────────────────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    EXPRESS + WS SERVER  (server.js : 3000)                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  REST Routes (Express)                                              │    │
│  │  POST /auth/google          POST /kioskRedirect                     │    │
│  │  POST /admin/auth/login     GET  /admin/kiosks                      │    │
│  │  POST /userdocs/upload-url  POST /userdocs/upload-complete          │    │
│  │  POST /userdocs/start-print GET  /userdocs/print-status             │    │
│  │  GET  /userdocs/download-status                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  WebSocket Server  (ws://server:3000/?role=...)                     │    │
│  │                                                                      │    │
│  │  connectionRouter.js                                                │    │
│  │    ├── role=kiosk  → kiosk.handler.js                               │    │
│  │    ├── role=agent  → agent.handler.js                               │    │
│  │    └── role=admin  → admin.handler.js                               │    │
│  │                                                                      │    │
│  │  Services: printer.service · osmgt.service · agent.service          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Runtime In-Memory Store (runtimeStore.js)                          │    │
│  │  kioskSockets · userSessionIdWithKioskId · adminSockets             │    │
│  │  printJobStatusBySession · pendingS3PrintJobs · s3UploadRecords     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Background: S3 lifecycle cleanup cron (every 5 min)                        │
└──────────────────────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
  ┌─────────────┐    ┌──────────────────┐   ┌──────────────────┐
  │ MongoDB Atlas│    │  PostgreSQL       │   │    AWS S3        │
  │ (Mongoose)  │    │  (Prisma)         │   │                  │
  │             │    │                  │   │  uploads/{sid}/  │
  │  Admin      │    │  NoAuthUser      │   │  {uuid}.pdf      │
  │  Kiosk      │    │  (print sessions)│   │                  │
  └─────────────┘    └──────────────────┘   └──────────────────┘
           ▲
           │  WebSocket (ws://server:3000/?role=kiosk&kioskid=...)
           │  WebSocket (ws://server:3000/?role=agent&kioskid=...)
  ┌─────────────────────────────────────────────────────────────┐
  │                  PHYSICAL KIOSK MACHINE                     │
  │                                                             │
  │  ┌──────────────────┐    ┌──────────────────────────────┐  │
  │  │  Kiosk App       │    │  Agent Daemon (Node.js)      │  │
  │  │  (Electron/Web)  │    │                              │  │
  │  │                  │    │  - PM2 process management    │  │
  │  │  Displays QR     │    │  - OS commands               │  │
  │  │  Receives files  │    │  - PTY terminal              │  │
  │  │  Prints docs     │    │  - System info / heartbeat   │  │
  │  └──────────────────┘    └──────────────────────────────┘  │
  │                                                             │
  │  Physical Printers (B&W + Color)                           │
  └─────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow Diagram (DFD)

### Level 0 — Context Diagram

```
                        ┌─────────────────────────────┐
                        │                             │
  User ──────────────►  │                             │ ──────────────► Printer
  (scan QR, upload,     │      PrintGo System         │   (print job)
   pay, get printout)   │                             │
                        │                             │
  Admin ─────────────►  │                             │ ──────────────► AWS S3
  (manage kiosks,       │                             │   (store PDFs)
   view stats)          │                             │
                        │                             │
  Kiosk/Agent ────────► │                             │ ──────────────► MongoDB
  (connect, report      │                             │   (kiosk/admin data)
   status, print)       │                             │
                        │                             │ ──────────────► PostgreSQL
                        │                             │   (print sessions)
                        └─────────────────────────────┘
```

### Level 1 — Main Processes

```
USER FLOW (Happy Path)
─────────────────────

  [1] User scans QR code on kiosk
       │
       ▼
  [2] Browser opens /kioskRedirect?userSessionNumber=<uuid>
       │  POST /kioskRedirect  { userSessionNumber }
       ▼
  [3] Server validates session → maps UUID to kioskId
       │  Returns: { token (JWT 10min), kioskId }
       ▼
  [4] User uploads PDF
       │  POST /userdocs/upload-url  { fileName, contentType, size, metadata }
       │  Server creates S3 signed PUT URL + Prisma NoAuthUser record
       │  Returns: { uploadUrl, fileKey }
       │
       │  PUT <uploadUrl>  (direct to S3, bypasses server)
       │
       │  POST /userdocs/upload-complete  { fileKey, metadata }
       │  Server marks upload done, requests kiosk to pre-download from S3
       ▼
  [5] Kiosk downloads file from S3
       │  WS → kiosk: "download-file-from-s3-request" { fileKey, downloadUrl }
       │  Kiosk → WS: "download-file-from-s3-ack" { success, sessionId }
       │  Server updates Prisma: kioskDownloadStatus = "downloaded"
       ▼
  [6] User configures print options & pays
       │  POST /userdocs/start-print  { fileKey, copies, colorMode, ... }
       │  Server marks paymentConfirmed = true
       │  If file already downloaded → immediately sends print command to kiosk
       │  WS → kiosk: "print-file-request-from-user-via-server"
       ▼
  [7] Kiosk prints document
       │  WS ← kiosk: "printing-started"
       │  WS ← kiosk: "print-file-response-to-server" { success }
       │  WS ← kiosk: "printed-status" { status: "success", price }
       │  Server updates Prisma: isPrinted=true, printStatus="success"
       │  Server updates MongoDB Kiosk: metrics.totalPrintJobs++, revenue++
       ▼
  [8] User polls status
       │  GET /userdocs/print-status?token=<jwt>
       │  GET /userdocs/download-status
       ▼
  [9] User collects printout ✓


ADMIN FLOW
──────────

  [1] Admin logs in
       │  POST /admin/auth/login  { email, password }
       │  Returns: { token (JWT 30min), role }
       ▼
  [2] Admin connects WebSocket
       │  WS: ws://server/?role=admin&token=<jwt>
       │  Server verifies JWT, creates adminSockets entry
       │  Server sends: "admin-connected" { kiosks: [...] }
       ▼
  [3] Admin views/manages kiosks
       │  WS send: "get-kiosk-list"
       │  WS send: "view-kiosk" { kioskId }  → exclusive lock
       │  WS send: "get-printers-request" { kioskId }
       │  WS send: "restart-kiosk-request" { kioskId }
       │  WS send: "open-terminal-request" { kioskId }
       ▼
  [4] Admin leaves kiosk
       │  WS send: "leave-kiosk"  → releases lock
```

---

## 4. ER Diagram

### MongoDB Collections

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Collection: admins                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  _id          ObjectId  PK                                                   │
│  username     String    UNIQUE, REQUIRED                                     │
│  email        String    UNIQUE, REQUIRED                                     │
│  password     String    REQUIRED (bcrypt hashed)                             │
│  role         String    ENUM["superadmin", "service_person"]                 │
│  isActive     Boolean   DEFAULT false                                        │
│  createdAt    Date      auto                                                 │
│  updatedAt    Date      auto                                                 │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  Collection: kiosks                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  _id              ObjectId  PK                                               │
│  kioskId          String    UNIQUE, REQUIRED, INDEX  (e.g. "KIOSK001")      │
│  kioskName        String                                                     │
│  isActive         Boolean   DEFAULT false                                    │
│  newConnection    Boolean   DEFAULT true                                     │
│  currentOwner     String    DEFAULT "printgocorp"                            │
│                                                                              │
│  location: {                                                                 │
│    region         String                                                     │
│    city           String    INDEX                                            │
│    address        String                                                     │
│    landmark       String                                                     │
│    pincode        String                                                     │
│    coordinates: { lat: Number, lng: Number }                                │
│  }                                                                           │
│                                                                              │
│  printers: {                                                                 │
│    availableList  [{ name, isDefault, accepting, status,                    │
│                      supportsColor, printMode }]                             │
│    bw: { name, model, status, paperAvailable, inkLevel,                     │
│           supportedFormats, pricePerPage }                                  │
│    color: { name, model, status, paperAvailable, inkLevel(Map),             │
│              supportedFormats, pricePerPage }                               │
│  }                                                                           │
│                                                                              │
│  machineDetails: {                                                           │
│    hostname, platform, arch, ipAddress, capabilities[],                     │
│    status  ENUM["online","offline","maintenance"]  INDEX,                   │
│    lastSeenAt  Date                                                          │
│  }                                                                           │
│                                                                              │
│  metrics: {                                                                  │
│    totalPrintJobs  Number  DEFAULT 0                                         │
│    revenue: { total, monthly, daily }  Number                               │
│  }                                                                           │
│                                                                              │
│  config: {                                                                   │
│    operatingHours: { start, end }                                           │
│    maxFileSizeMB   Number  DEFAULT 50                                        │
│    supportedFileTypes  [String]                                              │
│    notes  String                                                             │
│  }                                                                           │
│                                                                              │
│  createdAt    Date  auto                                                     │
│  updatedAt    Date  auto                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### PostgreSQL Table (Prisma)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Table: NoAuthUser                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│  id                  UUID      PK  DEFAULT uuid()                            │
│  createdAt           DateTime  DEFAULT now()                                 │
│  updatedAt           DateTime  @updatedAt                                    │
│                                                                              │
│  userSessionNumber   String    INDEX  (maps to kiosk session UUID)           │
│  kioskId             String    INDEX  (e.g. "KIOSK001")                      │
│  fileName            String?                                                 │
│                                                                              │
│  s3UploadStatus      String?   DEFAULT "pending"                             │
│                                ENUM: pending | uploaded | failed             │
│  kioskDownloadStatus String?   DEFAULT "pending"                             │
│                                ENUM: pending | requested | downloading |     │
│                                      downloaded | failed                     │
│                                                                              │
│  fileConfig          Json?     DEFAULT "{}"                                  │
│                                { copies, printer, orientation, paperSize,   │
│                                  sides, pageRanges, fitToPage, colorMode }  │
│                                                                              │
│  paymentStatus       String?   DEFAULT "pending"                             │
│                                ENUM: pending | success | failed | refunded  │
│  transactionId       String?   UNIQUE                                        │
│  paymentAmount       Float?                                                  │
│  paymentMethod       String?   DEFAULT "UPI"                                 │
│  paymentTimestamp    DateTime?                                               │
│  merchantOrderId     String?                                                 │
│  payerVpa            String?                                                 │
│                                                                              │
│  printStatus         String?   DEFAULT "pending"                             │
│                                ENUM: pending | printing | success | failed  │
│  isPrintStarted      Boolean   DEFAULT false                                 │
│  isPrinted           Boolean   DEFAULT false                                 │
│  printedAt           DateTime?                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Entity Relationships

```
admins ──────────────────────────────────────────────────────────────────────
  (manages)                                                                   │
                                                                              ▼
kiosks ◄──── (identified by kioskId) ──── NoAuthUser (print sessions)
  │                                            │
  │  1 kiosk : N print sessions               │  1 session : 1 file upload
  │                                            │
  └── (runtime) kioskSockets[kioskId]          └── S3 bucket: uploads/{sid}/{uuid}.pdf
         ├── kiosk WebSocket
         ├── agent WebSocket
         └── userSessionUUID ──► userSessionIdWithKioskId[uuid] = kioskId
```

---

## 5. UML Class Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVER-SIDE CLASSES                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐       ┌──────────────────────────────────────────┐
│  AdminModel          │       │  KioskModel                              │
│  (Mongoose)          │       │  (Mongoose)                              │
├──────────────────────┤       ├──────────────────────────────────────────┤
│ - username: String   │       │ - kioskId: String                        │
│ - email: String      │       │ - kioskName: String                      │
│ - password: String   │       │ - isActive: Boolean                      │
│ - role: String       │       │ - location: LocationObject               │
│ - isActive: Boolean  │       │ - printers: PrintersObject               │
├──────────────────────┤       │ - machineDetails: MachineDetailsObject   │
│ + matchPassword()    │       │ - metrics: MetricsObject                 │
│ + pre("save") hook   │       │ - config: ConfigObject                   │
└──────────────────────┘       └──────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  RuntimeStore (singleton in-memory)                                      │
├──────────────────────────────────────────────────────────────────────────┤
│ + kioskSockets: Map<kioskId, KioskSocketEntry>                           │
│ + userSessionIdWithKioskId: Map<sessionUUID, kioskId>                   │
│ + adminSockets: Map<adminSessionId, AdminSocketEntry>                    │
│ + printJobStatusBySession: Map<sessionId, PrintJobStatus>               │
│ + pendingS3PrintJobs: Map<sessionId, PendingPrintJob>                   │
│ + s3UploadRecords: Map<fileKey, S3UploadRecord>                         │
│ + terminalSessions: Map<sessionId, TerminalSession>                     │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  WebSocketConnectionRouter                                               │
├──────────────────────────────────────────────────────────────────────────┤
│ + handleWebSocketConnection(ws, req): Promise<void>                      │
│   - Reads ?role= query param                                             │
│   - Routes to KioskHandler | AgentHandler | AdminHandler                │
└──────────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐
│  KioskHandler   │  │  AgentHandler   │  │  AdminHandler               │
├─────────────────┤  ├─────────────────┤  ├─────────────────────────────┤
│ handleKiosk     │  │ handleAgent     │  │ handleAdmin                 │
│ Connection()    │  │ Connection()    │  │ Connection()                │
│ sendToKiosk()   │  │ sendToAgent()   │  │                             │
│ sendToKiosk     │  │                 │  │ Uses:                       │
│ ViaSocket()     │  │                 │  │  PrinterService             │
└─────────────────┘  └─────────────────┘  │  OsmgtService              │
                                           │  AgentService              │
                                           └─────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  PrinterService      │  │  OsmgtService        │  │  AgentService        │
├──────────────────────┤  ├──────────────────────┤  ├──────────────────────┤
│ + printFile()        │  │ + notifyUser         │  │ + startKiosk()       │
│ + requestKiosk       │  │   Connected()        │  │ + stopKiosk()        │
│   S3Download()       │  │ + sendStatus         │  │ + restartKiosk()     │
│ + getPrinterStatus() │  │   Message()          │  │ + getKioskStatus()   │
│ + getPrinterList()   │  │ + sendDisconnection  │  │ + getLogs()          │
│ + cancelPrinting()   │  │   Warning()          │  │ + restartSystem()    │
│ + resetPrinter       │  │ + disconnectUser()   │  │ + updateSystem()     │
│   Settings()         │  │ + setSessionRef      │  │ + updateKiosk()      │
│ + getJobQueue()      │  │   erenceId()         │  │ + getSystemInfo()    │
│ + setDefault         │  │ + sendFileAck        │  │ + listProcesses()    │
│   Printer()          │  │   nowledgement()     │  │ + killProcess()      │
│ + testPrint()        │  │ + sendFileMetadata() │  │ + executeCommand()   │
│ + getInkLevels()     │  └──────────────────────┘  │ + openTerminal()     │
│ + pausePrinter()     │                             │ + terminalInput()    │
│ + resumePrinter()    │                             │ + terminalResize()   │
│ + getPrintHistory()  │                             │ + closeTerminal()    │
└──────────────────────┘                             └──────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  S3StorageService                                                        │
├──────────────────────────────────────────────────────────────────────────┤
│ + createSignedUploadUrl({ key, contentType, expiresIn }): Promise<URL>  │
│ + createSignedDownloadUrl({ key, expiresIn }): Promise<URL>             │
│ + deleteObjectByKey(key): Promise<void>                                 │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  S3LifecycleCleanupService (cron)                                        │
├──────────────────────────────────────────────────────────────────────────┤
│ + startS3LifecycleCleanupJob(): void                                     │
│   Runs every 5 min, deletes S3 files older than 20 min                  │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND-SIDE CLASSES                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  AuthContext         │  │  AdminAuthContext     │  │  AdminSocketContext  │
├──────────────────────┤  ├──────────────────────┤  ├──────────────────────┤
│ - user: User|null    │  │ - user: AdminUser     │  │ - socket: WebSocket  │
│ - token: string|null │  │ - token: string|null  │  │ - lastMessage: any   │
│ - isAuthenticated    │  │ - loading: boolean    │  ├──────────────────────┤
├──────────────────────┤  ├──────────────────────┤  │ + sendCommand(       │
│ + login(code)        │  │ + login(token, user)  │  │   kioskId, cmd, data)│
│ + logout()           │  │ + logout()            │  └──────────────────────┘
│ + setUser(user)      │  └──────────────────────┘
└──────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  authService         │  │  kioskPrintService   │  │  uploadService       │
├──────────────────────┤  ├──────────────────────┤  ├──────────────────────┤
│ + googleLogin(code)  │  │ + authenticate       │  │ + uploadFile(file)   │
│ + probe()            │  │   KioskSession()     │  └──────────────────────┘
└──────────────────────┘  │ + requestUploadUrl() │
                           │ + uploadFileToS3()   │
                           │ + confirmUpload      │
                           │   Complete()         │
                           │ + uploadMergedPdf()  │
                           │ + startPrint()       │
                           │ + checkDownload      │
                           │   Status()           │
                           │ + createPrintStatus  │
                           │   Stream()           │
                           └──────────────────────┘
```

---

## 6. All REST API Endpoints

Base URL: `http://localhost:3000`

---

### Auth Routes — `/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/google` | None | Exchange Google OAuth authorization code for app JWT + user profile |
| `GET` | `/auth/pr` | None | Health-check probe for auth routes |

**POST /auth/google**
```json
// Request body
{ "code": "<google_oauth_code>" }

// Response 200
{
  "token": "<jwt>",
  "user": { "email": "...", "name": "...", "picture": "..." }
}
```

---

### Admin Auth Routes — `/admin/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/admin/auth/register` | None | Register a new admin account |
| `POST` | `/admin/auth/login` | None | Login and receive JWT |
| `POST` | `/admin/auth/logout` | None | Logout (client-side token removal) |
| `GET` | `/admin/auth/me` | Bearer JWT | Get current admin profile |

**POST /admin/auth/register**
```json
// Request body
{ "username": "alice", "email": "alice@example.com", "password": "secret", "role": "service_person" }

// Response 201
{ "success": true, "message": "Admin registered successfully. Waiting for activation by superadmin." }
// Note: First admin ever registered becomes superadmin and is auto-activated.
```

**POST /admin/auth/login**
```json
// Request body
{ "email": "alice@example.com", "password": "secret" }

// Response 200
{
  "success": true,
  "_id": "...",
  "username": "alice",
  "email": "alice@example.com",
  "role": "superadmin",
  "token": "<jwt_30min>"
}
```

---

### Admin Management Routes — `/admin`

All require `Authorization: Bearer <admin_jwt>`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/admin/accounts` | Bearer + superadmin | List all admin accounts |
| `PATCH` | `/admin/accounts/:id` | Bearer + superadmin | Update admin `isActive` or `role` |
| `GET` | `/admin/kiosks` | Bearer | List all kiosks (merged DB + live socket status) |
| `GET` | `/admin/kiosks/:kioskId` | Bearer | Get single kiosk details |
| `PATCH` | `/admin/kiosks/:kioskId` | Bearer | Update kiosk fields in MongoDB |
| `POST` | `/admin/kiosks/:kioskId/:command` | Bearer | Send command to kiosk (stub — not fully implemented) |

**GET /admin/kiosks — Response**
```json
{
  "success": true,
  "kiosks": [
    {
      "_id": "...",
      "kioskId": "KIOSK001",
      "kioskName": "Main Hall Kiosk",
      "isActive": true,
      "location": { "city": "Mumbai", "region": "West" },
      "printers": { "bw": { "name": "HP LaserJet", "status": "online" }, "color": {...} },
      "machineDetails": { "status": "online", "lastSeenAt": "..." },
      "metrics": { "totalPrintJobs": 142, "revenue": { "total": 710 } },
      "liveConnected": true,
      "agentConnected": true
    }
  ]
}
```

---

### User / Kiosk Session Routes — `/`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/kioskRedirect` | None | Validate QR session UUID, return user JWT |
| `POST` | `/kisokRedirect` | None | Alias for `/kioskRedirect` (typo kept for compatibility) |
| `GET` | `/kiosks/:kioskId/status` | None | Get live kiosk connection status (stub) |

**POST /kioskRedirect**
```json
// Request body
{ "userSessionNumber": "<uuid-from-qr-code>" }

// Response 200
{
  "msg": "Connected successfully",
  "token": "<jwt_10min>",
  "kioskId": "KIOSK001"
}

// Response 404 — QR code expired or invalid
{ "msg": "Please scan a fresh kiosk QR code" }

// Response 503 — Kiosk offline
{ "msg": "Kiosk is currently offline" }
```

---

### Upload / Print Routes — `/userdocs`

All require `Authorization: Bearer <user_jwt>` (except `/print-status` which also accepts `?token=`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/userdocs/upload-url` | Bearer (user) | Generate S3 signed upload URL, create Prisma record |
| `POST` | `/userdocs/upload-complete` | Bearer (user) | Confirm S3 upload done, trigger kiosk pre-download |
| `POST` | `/userdocs/start-print` | Bearer (user) | Confirm payment, dispatch print command to kiosk |
| `GET` | `/userdocs/print-status` | Bearer or `?token=` | Poll current print job status (in-memory) |
| `GET` | `/userdocs/download-status` | Bearer (user) | Check kiosk download status from Prisma DB |

**POST /userdocs/upload-url**
```json
// Request body
{
  "fileName": "document.pdf",
  "contentType": "application/pdf",
  "size": 1048576,
  "metadata": { "bwPageCount": 3, "colorPageCount": 1, "totalPages": 4 }
}

// Response 200
{
  "success": true,
  "uploadUrl": "https://s3.amazonaws.com/...",
  "fileKey": "uploads/<sessionId>/<uuid>.pdf",
  "expiresIn": 600
}
```

**POST /userdocs/upload-complete**
```json
// Request body
{ "fileKey": "uploads/<sessionId>/<uuid>.pdf", "metadata": {} }

// Response 200
{
  "success": true,
  "message": "Upload recorded and kiosk pre-download requested",
  "prefetchRequested": true
}
```

**POST /userdocs/start-print**
```json
// Request body
{
  "fileKey": "uploads/<sessionId>/<uuid>.pdf",
  "copies": 2,
  "printer": null,
  "orientation": "portrait",
  "paperSize": "A4",
  "sides": "one-sided",
  "pageRanges": null,
  "fitToPage": true,
  "colorMode": "monochrome",
  "printMeta": { "bwPageCount": 3, "colorPageCount": 1 }
}

// Response 200 — file already downloaded by kiosk
{
  "success": true,
  "message": "Payment confirmed and print started",
  "kioskId": "KIOSK001",
  "sessionId": "<uuid>",
  "waitingForDownload": false
}

// Response 200 — waiting for kiosk to finish downloading
{
  "success": true,
  "message": "Payment confirmed. Waiting for kiosk to finish downloading PDF",
  "waitingForDownload": true
}
```

**GET /userdocs/print-status**
```json
// Response 200
{
  "sessionId": "<uuid>",
  "status": "print-completed",
  "kioskId": "KIOSK001",
  "fileKey": "uploads/...",
  "fileName": "document.pdf",
  "updatedAt": "2026-05-14T10:00:00.000Z"
}
```

**Status values for `print-status`:**
- `upload-url-issued` → `kiosk-download-requested` → `kiosk-download-success` → `print-requested` → `printing-started` → `print-completed` / `print-failed`
- `kiosk-file-ready-awaiting-payment` (file downloaded but payment not yet confirmed)
- `payment-confirmed-waiting-for-download`

**GET /userdocs/download-status**
```json
// Response 200
{
  "success": true,
  "s3UploadStatus": "uploaded",
  "kioskDownloadStatus": "downloaded",
  "fileName": "document.pdf",
  "isDownloaded": true,
  "isPrintStarted": true,
  "isPrinted": false,
  "paymentStatus": "success",
  "updatedAt": "..."
}
```

---

## 7. All WebSocket Events

WebSocket URL: `ws://localhost:3000/?role=<role>&kioskid=<id>&token=<jwt>`

### Connection Parameters

| Role | Required Params | Description |
|------|----------------|-------------|
| `kiosk` | `role=kiosk&kioskid=KIOSK001` | Physical kiosk app |
| `agent` | `role=agent&kioskid=KIOSK001` | Agent daemon on kiosk machine |
| `admin` | `role=admin&token=<admin_jwt>` | Admin dashboard |

---

### 7.1 Kiosk ↔ Server Events

#### Server → Kiosk (sent by server to kiosk app)

| Event Type | Payload | Description |
|-----------|---------|-------------|
| `setting-reference-id-for-user-identification` | `{ userSessionUUID, serverStatus }` | Sent on connect and on session reset. Kiosk uses UUID to generate QR code |
| `connected-to-user-successfully` | `{ userName }` | User has scanned QR and connected |
| `status-user-connected-to-kiosk` | `{ msg }` | General status message for kiosk UI |
| `user-disconnection-warning` | `{ msg, isActive, timeout_period }` | Warn kiosk that user will be disconnected |
| `user-disconnected` | `{ reason }` | User session ended, kiosk should reset UI |
| `metadata-before-file-sending` | `{ userName, fileName, fileSize, totalChunks, mail, sessionId }` | File metadata before binary chunks (legacy direct transfer) |
| `ack-after-file-sent` | `{ fileName, sessionId, kioskId }` | Server confirms file transfer complete |
| `download-file-from-s3-request` | `{ fileKey, fileName, downloadUrl, sessionId }` | Ask kiosk to download file from S3 |
| `print-file-request-from-user-via-server` | `{ fileName, sessionId, copies, printer, orientation, paperSize, sides, pageRanges, fitToPage, colorMode }` | Dispatch print job to kiosk |
| `printer-status-request-from-server` | `{}` | Request printer status report |
| `printer-get-list-request-from-server` | `{}` | Request list of available printers |
| `cancle-printing-request-from-server` | `{ printer }` | Cancel active print job |
| `reset-printer-settings-from-server` | `{ printer }` | Reset printer settings |
| `get-job-queue-request-from-server` | `{}` | Request print job queue |
| `set-default-printer-request-from-server` | `{ printerName }` | Set default printer |
| `test-print-request-from-server` | `{ printer }` | Send test print |
| `ink-levels-request-from-server` | `{ printer }` | Request ink/toner levels |
| `pause-printer-request-from-server` | `{ printer, reason }` | Pause printer |
| `resume-printer-request-from-server` | `{ printer }` | Resume printer |
| `print-history-request-from-server` | `{ limit }` | Request print history |
| `restart-kiosk-now` | `{ msg }` | Sent when kiosk disconnects while agent is connected |

#### Kiosk → Server (received by server from kiosk app)

| Event Type | Payload | Description |
|-----------|---------|-------------|
| `register-kiosk` | `{ kioskid }` | Kiosk registers itself on connect |
| `job-status` | `{ ... }` | General job status update |
| `unique-user-id-setuped` | `{ kioskStatus, kioskid, userUniqueReferenceId }` | Kiosk confirms session UUID is set |
| `reset-user-session-id-kiosk` | `{ oldId, msg }` | Kiosk requests a new session UUID (user left) |
| `ack-of-file-from-kiosk` | `{ sessionId }` | Kiosk confirms it received the file (legacy direct transfer) |
| `download-file-from-s3-ack` | `{ sessionId, success, fileKey, fileName, error }` | Kiosk reports S3 download result |
| `testing-file-request-from-kiosk` | `{ sessionId }` | Kiosk requests test file send |
| `printing-started` | `{ status, data }` | Kiosk started printing |
| `print-file-response-to-server` | `{ sessionId, success, ...details }` | Kiosk reports print result |
| `printer-status-response-to-server` | `{ data }` | Printer status report |
| `printed-status` | `{ status, data: { price } }` | Final print status (success/error/halt). On success, updates MongoDB metrics |
| `printer-list-result` | `{ data: { printers: [...] } }` | List of available printers |
| `printer-get-list-response-to-server` | `{ printers: [...] }` | Alias for printer-list-result |
| `kiosk-status-result` | `{ printers, ... }` | Full kiosk status including printers |

---

### 7.2 Agent ↔ Server Events

#### Server → Agent (sent by server to agent daemon)

| Event Type | Payload | Description |
|-----------|---------|-------------|
| `start-kiosk-now` | `{}` | Start kiosk app via PM2 |
| `stop-kiosk-now` | `{}` | Stop kiosk app via PM2 |
| `restart-kiosk-now` | `{}` | Restart kiosk app via PM2 |
| `kiosk-status-check` | `{}` | Get PM2 kiosk process status |
| `pm2-save` | `{}` | Persist PM2 process list |
| `get-logs` | `{ lines }` | Fetch PM2 logs |
| `restart-system-now` | `{}` | Reboot the kiosk machine |
| `update-system-now` | `{}` | Run apt-get update + upgrade |
| `update-kiosk-now` | `{}` | Run git pull + npm install + pm2 restart |
| `get-system-info` | `{}` | Get CPU, memory, disk, temp, IPs |
| `list-processes` | `{}` | List all PM2 processes |
| `kill-process` | `{ pid }` | Kill a process by PID |
| `execute-command` | `{ cmd, cwd, timeout, requestId }` | Execute arbitrary shell command |
| `open-terminal` | `{ sessionId, cols, rows }` | Open PTY terminal session |
| `terminal-input` | `{ sessionId, data }` | Send input to PTY session |
| `terminal-resize` | `{ sessionId, cols, rows }` | Resize PTY terminal |
| `close-terminal` | `{ sessionId }` | Close PTY terminal session |

#### Agent → Server (received by server from agent daemon)

| Event Type | Payload | Description |
|-----------|---------|-------------|
| `agent-ready` | `{ kioskName, hostname, platform, arch, capabilities, timestamp }` | Agent connected and ready. Updates MongoDB machineDetails |
| `agent-heartbeat` | `{ timestamp, freeMemory, uptime, loadAvg }` | Periodic heartbeat. Updates MongoDB lastSeenAt |
| `kiosk-command-result` | `{ command, success, ...data }` | Result of a kiosk management command |
| `kiosk-status-result` | `{ success, printers, ... }` | Kiosk status including printer info |
| `printer-list-result` | `{ printers: [...] }` | Available printers list. Updates MongoDB |
| `system-info-result` | `{ os, platform, arch, hostname, ... }` | System information. Updates MongoDB |
| `process-list-result` | `{ processes: [...] }` | PM2 process list |
| `logs-result` | `{ logs: [...] }` | PM2 log output |
| `execute-command-result` | `{ success, stdout, stderr, requestId }` | Shell command execution result |
| `terminal-opened` | `{ sessionId }` | PTY session opened successfully |
| `terminal-output` | `{ sessionId, data }` | PTY output data (forwarded to admin) |
| `terminal-closed` | `{ sessionId }` | PTY session closed |
| `terminal-error` | `{ sessionId, error }` | PTY error |

---

### 7.3 Admin ↔ Server Events

Connection: `ws://server/?role=admin&token=<admin_jwt>`

#### Server → Admin (sent by server to admin dashboard)

| Event Type | Payload | Description |
|-----------|---------|-------------|
| `admin-connected` | `{ kiosks: [...], message }` | Sent on connect with current kiosk list |
| `kiosk-list` | `{ kiosks: [...] }` | Response to `get-kiosk-list` |
| `kiosk-lock-update` | `{ kiosks: [...] }` | Broadcast when a kiosk lock changes |
| `view-kiosk-result` | `{ success, kioskId, message, lockedBy? }` | Result of view-kiosk request |
| `leave-kiosk-result` | `{ success, kioskId }` | Result of leave-kiosk request |
| `update-kiosk-data-result` | `{ success, kiosk, kioskId }` | Result of kiosk DB update |
| `get-kiosk-data-result` | `{ success, kiosk, kioskId }` | Kiosk data from DB |
| `agent-ready` | `{ kioskId, kioskName, hostname, ... }` | Forwarded from agent |
| `agent-heartbeat` | `{ kioskId, timestamp, freeMemory, uptime }` | Forwarded from agent |
| `agent-disconnected` | `{ kioskId }` | Agent disconnected |
| `kiosk-command-result` | `{ kioskId, command, success }` | Forwarded from agent |
| `kiosk-status-result` | `{ kioskId, ... }` | Forwarded from agent/kiosk |
| `printer-list-result` | `{ kioskId, printers, colorPrinters, bwPrinters }` | Forwarded from kiosk/agent |
| `system-info-result` | `{ kioskId, ... }` | Forwarded from agent |
| `process-list-result` | `{ kioskId, processes }` | Forwarded from agent |
| `logs-result` | `{ kioskId, logs }` | Forwarded from agent |
| `execute-command-result` | `{ kioskId, success, stdout, stderr }` | Forwarded from agent |
| `terminal-opening` | `{ sessionId, kioskId }` | Terminal session being opened |
| `terminal-opened` | `{ sessionId, kioskId }` | Terminal session ready |
| `terminal-output` | `{ sessionId, data }` | PTY output (forwarded from agent) |
| `terminal-closed` | `{ sessionId, kioskId }` | Terminal session closed |
| `terminal-error` | `{ sessionId, error }` | Terminal error |
| `printed-status` | `{ kioskId, status, data }` | Forwarded from kiosk |
| `download-file-from-s3-ack` | `{ kioskId, data }` | Forwarded from kiosk |
| `print-file-result` | `{ dispatched, kioskId }` | Ack that print command was dispatched |
| `start-kiosk-result` | `{ dispatched, kioskId }` | Ack for start-kiosk command |
| `stop-kiosk-result` | `{ dispatched, kioskId }` | Ack for stop-kiosk command |
| `restart-kiosk-result` | `{ dispatched, kioskId }` | Ack for restart-kiosk command |
| `error` | `{ message }` | Error response |

#### Admin → Server (sent by admin dashboard to server)

| Event Type | Payload | Description |
|-----------|---------|-------------|
| `get-kiosk-list` | `{}` | Get all connected kiosks with live status |
| `view-kiosk` | `{ kioskId }` | Acquire exclusive lock on a kiosk |
| `leave-kiosk` | `{}` | Release kiosk lock |
| `get-kiosk-data` | `{ kioskId }` | Fetch kiosk data from MongoDB |
| `update-kiosk-data` | `{ kioskId, data: {...} }` | Update kiosk fields in MongoDB |
| **Printer Commands** | | |
| `print-file` | `{ kioskId, fileName, sessionId, copies, printer, orientation, paperSize, sides, pageRanges, fitToPage, colorMode }` | Dispatch print job |
| `get-printer-status` | `{ kioskId }` | Request printer status |
| `get-printer-list` | `{ kioskId }` | Request printer list |
| `get-printers-request` | `{ kioskId }` | Alias for get-printer-list |
| `cancel-printing` | `{ kioskId, printer }` | Cancel print job |
| `reset-printer-settings` | `{ kioskId, printer }` | Reset printer settings |
| `get-job-queue` | `{ kioskId }` | Get print job queue |
| `set-default-printer` | `{ kioskId, printerName }` | Set default printer |
| `test-print` | `{ kioskId, printer }` | Send test print |
| `test-print-request` | `{ kioskId, printer }` | Alias for test-print |
| `get-ink-levels` | `{ kioskId, printer }` | Get ink/toner levels |
| `pause-printer` | `{ kioskId, printer, reason }` | Pause printer |
| `resume-printer` | `{ kioskId, printer }` | Resume printer |
| `get-print-history` | `{ kioskId, limit }` | Get print history |
| **OS/Session Commands** | | |
| `notify-user-connected` | `{ kioskId, userName }` | Notify kiosk of user connection |
| `send-status-message` | `{ kioskId, message }` | Push status message to kiosk UI |
| `send-disconnection-warning` | `{ kioskId, message, isActive, timeoutPeriod }` | Warn kiosk of user disconnection |
| `disconnect-user` | `{ kioskId, reason }` | Disconnect user from kiosk |
| `set-session-reference-id` | `{ kioskId, userSessionUUID, serverStatus }` | Push new session UUID to kiosk |
| `send-file-acknowledgement` | `{ kioskId, fileName, sessionId }` | Acknowledge file receipt |
| `send-file-metadata` | `{ kioskId, userName, fileName, fileSize, totalChunks, sessionId, mail }` | Send file metadata to kiosk |
| **Agent / Kiosk Management** | | |
| `start-kiosk` / `start-kiosk-request` | `{ kioskId }` | Start kiosk app via PM2 |
| `stop-kiosk` / `stop-kiosk-request` | `{ kioskId }` | Stop kiosk app via PM2 |
| `restart-kiosk` / `restart-kiosk-request` | `{ kioskId }` | Restart kiosk app via PM2 |
| `get-kiosk-status` / `get-kiosk-status-request` | `{ kioskId }` | Get kiosk PM2 status |
| `pm2-save` | `{ kioskId }` | Save PM2 process list |
| `get-logs` / `get-logs-request` | `{ kioskId, lines }` | Fetch PM2 logs |
| `restart-system` | `{ kioskId }` | Reboot kiosk machine |
| `update-system` | `{ kioskId }` | Run system update |
| `update-kiosk` | `{ kioskId }` | Update kiosk app |
| `get-system-info` / `get-system-info-request` | `{ kioskId }` | Get system info |
| `list-processes` | `{ kioskId }` | List PM2 processes |
| `kill-process` | `{ kioskId, pid }` | Kill a process |
| `execute-command` | `{ kioskId, cmd, cwd, timeout, requestId }` | Execute shell command |
| **Terminal (PTY)** | | |
| `open-terminal` / `open-terminal-request` | `{ kioskId, sessionId, cols, rows }` | Open PTY terminal |
| `terminal-input` | `{ sessionId, data }` | Send input to terminal |
| `terminal-resize` | `{ sessionId, cols, rows }` | Resize terminal |
| `close-terminal` / `close-terminal-request` | `{ sessionId }` | Close terminal |

---

## 8. Frontend Route Map

| Path | Component | Auth Required | Description |
|------|-----------|---------------|-------------|
| `/` | `HomePage` | No | Landing page |
| `/auth` | `LoginPage` | No | Google OAuth login |
| `/oauth-callback` | `OAuthCallbackPage` | No | OAuth code exchange handler |
| `/kioskRedirect` | `KioskRedirectPage` | No | QR scan landing — validates session, stores JWT |
| `/kisokRedirect` | `KioskRedirectPage` | No | Typo alias for above |
| `/upload` | `UploadPage` | No (uses kiosk JWT) | PDF upload + print config |
| `/preview` | `PreviewPage` | No | PDF preview before printing |
| `/payment` | `PaymentPage` | No | Payment confirmation |
| `/printing` | `PrintingStatusPage` | No | Real-time print status polling |
| `/contact` | `ContactPage` | No | Contact page |
| `/error` | `NotFoundPage` | No | Error / 404 page |
| `/admin/login` | `AdminLoginPage` | No | Admin login |
| `/admin/signup` | `AdminSignupPage` | No | Admin registration |
| `/admin` | `AdminDashboardPage` | Admin JWT | Dashboard with kiosk overview |
| `/admin/regions/:regionName` | `AdminRegionPage` | Admin JWT | Kiosks filtered by region |
| `/admin/kiosk/:kioskId` | `AdminKioskDetailPage` | Admin JWT | Kiosk detail + live management |
| `/admin/accounts` | `AdminAccountsPage` | Admin JWT + superadmin | Admin account management |

---

## 9. Key Design Decisions & Notes

### Session Flow
1. Kiosk generates a UUID (`userSessionUUID`) on connect and displays it as a QR code
2. User scans QR → browser opens `/kioskRedirect?userSessionNumber=<uuid>`
3. Server maps UUID → kioskId via `userSessionIdWithKioskId` in-memory store
4. Server issues a short-lived JWT (10 min) containing `{ userSessionNumber, kioskId }`
5. All subsequent user API calls use this JWT for authentication

### S3 Upload Flow (Direct Upload)
- Server generates a **pre-signed PUT URL** — the browser uploads directly to S3, bypassing the server
- After upload, server is notified via `/upload-complete` and immediately requests the kiosk to pre-download the file
- This decouples file transfer from the server, reducing bandwidth load

### Print Orchestration
- The server maintains `pendingS3PrintJobs` in memory
- If kiosk downloads file **before** payment: job waits in `pendingS3PrintJobs` with `paymentConfirmed=false`
- If payment arrives **before** download completes: job waits with `paymentConfirmed=true`, print dispatched on `download-file-from-s3-ack`
- Both paths converge to sending `print-file-request-from-user-via-server` to the kiosk

### Admin Kiosk Locking
- Only one admin can actively manage a kiosk at a time (exclusive lock via `lockedByAdmin`)
- Lock is released when admin sends `leave-kiosk` or disconnects
- Other admins see the lock status in `kiosk-lock-update` broadcasts

### Dual Database Strategy
- **MongoDB** stores persistent kiosk configuration, printer info, location, metrics, and admin accounts
- **PostgreSQL (Prisma)** stores per-session print transaction records for auditability and payment tracking
- **In-memory store** (`runtimeStore.js`) holds live WebSocket connections and transient job state

### S3 Lifecycle Cleanup
- A cron job runs every 5 minutes and deletes S3 files older than 20 minutes
- This prevents storage accumulation from abandoned sessions
