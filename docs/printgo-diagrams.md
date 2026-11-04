# PrintGo — System Diagrams & Documentation

> Stack: React + TypeScript · Node.js / Express + WebSocket · MongoDB Atlas · PostgreSQL (Prisma) · AWS S3

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Data Flow Diagram — Level 0 (Context)](#3-data-flow-diagram--level-0-context)
4. [Data Flow Diagram — Level 1 (User Print Flow)](#4-data-flow-diagram--level-1-user-print-flow)
5. [Data Flow Diagram — Level 1 (Admin Flow)](#5-data-flow-diagram--level-1-admin-flow)
6. [Print Job State Machine](#6-print-job-state-machine)
7. [ER Diagram](#7-er-diagram)
8. [UML Class Diagram — Server](#8-uml-class-diagram--server)
9. [UML Class Diagram — Frontend](#9-uml-class-diagram--frontend)
10. [Sequence Diagram — User Print Flow](#10-sequence-diagram--user-print-flow)
11. [Sequence Diagram — Admin Kiosk Management](#11-sequence-diagram--admin-kiosk-management)
12. [REST API Endpoints](#12-rest-api-endpoints)
13. [WebSocket Events Reference](#13-websocket-events-reference)

---

## 1. System Overview

| Actor | Role |
|---|---|
| **User** | Scans QR code on kiosk, uploads PDF from phone, pays, collects printout |
| **Kiosk App** | Electron/web app on the physical machine — displays QR, receives files, prints |
| **Agent** | Node.js daemon on kiosk machine — manages OS, PM2, printers, PTY terminal |
| **Admin** | Dashboard user — manages kiosks, printers, accounts via WebSocket |
| **Server** | Central Express + WebSocket hub orchestrating all actors |

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui, React Router v6 |
| Backend | Node.js, Express.js, `ws` WebSocket, node-cron |
| Primary DB | MongoDB Atlas (Mongoose) — Kiosk & Admin records |
| Transaction DB | PostgreSQL via Prisma — anonymous print sessions |
| File Storage | AWS S3 — signed URLs for direct browser upload / kiosk download |
| Auth (User) | JWT 10 min — issued after QR scan |
| Auth (Admin) | JWT 30 min + Google OAuth for regular users |

---

## 2. Architecture Diagram

```mermaid
graph TB
    subgraph Browser["📱 User Browser / Phone"]
        SPA["React SPA\n(printgoapp)\n\nPages: Home → KioskRedirect\n→ Upload → Preview\n→ Payment → PrintingStatus"]
    end

    subgraph AdminBrowser["🖥️ Admin Browser"]
        AdminSPA["React SPA\n(Admin Panel)\n\nDashboard · Regions\nKioskDetail · Accounts"]
    end

    subgraph Server["⚙️ Express + WebSocket Server :3000"]
        REST["REST Routes\n/auth · /admin · /userdocs\n/kioskRedirect"]
        WSRouter["WebSocket Router\nconnectionRouter.js"]
        KioskHandler["kiosk.handler.js"]
        AgentHandler["agent.handler.js"]
        AdminHandler["admin.handler.js"]
        RuntimeStore["In-Memory Store\nruntimeStore.js\n\nkioskSockets\nuserSessionIdWithKioskId\nadminSockets\nprintJobStatusBySession\npendingS3PrintJobs\ns3UploadRecords"]
        Cron["S3 Cleanup Cron\nevery 5 min"]
    end

    subgraph KioskMachine["🖨️ Physical Kiosk Machine"]
        KioskApp["Kiosk App\n(Electron/Web)\n\nDisplays QR\nReceives files\nPrints docs"]
        AgentDaemon["Agent Daemon\n(Node.js)\n\nPM2 management\nOS commands\nPTY terminal\nHeartbeat"]
        Printer["Physical Printers\nB&W + Color"]
    end

    subgraph Storage["☁️ Cloud Storage & Databases"]
        MongoDB["MongoDB Atlas\n(Mongoose)\n\nAdmin\nKiosk"]
        Postgres["PostgreSQL\n(Prisma)\n\nNoAuthUser\nprint sessions"]
        S3["AWS S3\n\nuploads/{sid}/{uuid}.pdf"]
    end

    SPA -- "REST (axios)\nBearer JWT" --> REST
    AdminSPA -- "REST (axios)\nBearer JWT" --> REST
    AdminSPA -- "WebSocket\n?role=admin&token=jwt" --> WSRouter

    WSRouter --> KioskHandler
    WSRouter --> AgentHandler
    WSRouter --> AdminHandler

    KioskHandler <-- "WebSocket\n?role=kiosk&kioskid=..." --> KioskApp
    AgentHandler <-- "WebSocket\n?role=agent&kioskid=..." --> AgentDaemon

    KioskApp --> Printer
    AgentDaemon --> KioskApp

    REST --> MongoDB
    REST --> Postgres
    REST --> S3
    KioskHandler --> MongoDB
    KioskHandler --> Postgres
    AgentHandler --> MongoDB
    Cron --> S3

    KioskHandler --> RuntimeStore
    AgentHandler --> RuntimeStore
    AdminHandler --> RuntimeStore
    REST --> RuntimeStore

    SPA -- "PUT (direct upload)\nSigned URL" --> S3
    KioskApp -- "GET (download)\nSigned URL" --> S3
```

---

## 3. Data Flow Diagram — Level 0 (Context)

```mermaid
graph LR
    User(["👤 User\n(Phone/Browser)"])
    Admin(["🛡️ Admin\n(Dashboard)"])
    KioskAgent(["🖨️ Kiosk + Agent\n(Physical Machine)"])

    System(["⚙️ PrintGo System"])

    Printer(["🖨️ Physical Printer"])
    S3(["☁️ AWS S3"])
    MongoDB(["🍃 MongoDB Atlas"])
    Postgres(["🐘 PostgreSQL"])

    User -- "Scan QR, upload PDF\npay, poll status" --> System
    Admin -- "Manage kiosks\nview stats, send commands" --> System
    KioskAgent -- "Connect, report status\ndownload files, print" --> System

    System -- "Print job" --> Printer
    System -- "Store / retrieve PDFs" --> S3
    System -- "Kiosk & admin data" --> MongoDB
    System -- "Print session records" --> Postgres
```

---

## 4. Data Flow Diagram — Level 1 (User Print Flow)

```mermaid
flowchart TD
    A(["👤 User scans QR code\non kiosk display"])
    B["POST /kioskRedirect\n{userSessionNumber}"]
    C{"Session valid?\nKiosk online?"}
    D["Return JWT 10min\n+ kioskId"]
    E["POST /userdocs/upload-url\n{fileName, size, contentType}"]
    F["Server creates\nS3 signed PUT URL\n+ Prisma NoAuthUser record"]
    G["PUT directly to S3\n(bypasses server)"]
    H["POST /userdocs/upload-complete\n{fileKey}"]
    I["Server sends WS to Kiosk:\ndownload-file-from-s3-request\n{fileKey, downloadUrl}"]
    J["Kiosk downloads\nfrom S3"]
    K["Kiosk → Server WS:\ndownload-file-from-s3-ack\n{success, sessionId}"]
    L["Prisma update:\nkioskDownloadStatus = downloaded"]
    M["User configures print options\n+ confirms payment"]
    N["POST /userdocs/start-print\n{fileKey, copies, colorMode, ...}"]
    O{"File already\ndownloaded?"}
    P["Server → Kiosk WS:\nprint-file-request-from-user-via-server"]
    Q["Wait in pendingS3PrintJobs\npaymentConfirmed = true"]
    R["Kiosk prints document"]
    S["Kiosk → Server WS:\nprinting-started\nprint-file-response-to-server\nprinted-status"]
    T["Prisma update:\nisPrinted=true\nprintStatus=success"]
    U["MongoDB update:\nmetrics.totalPrintJobs++\nrevenue++"]
    V["GET /userdocs/print-status\nGET /userdocs/download-status"]
    W(["✅ User collects printout"])

    A --> B --> C
    C -- "404 / 503" --> A
    C -- "Valid" --> D --> E --> F --> G --> H --> I --> J --> K --> L
    L --> M --> N --> O
    O -- "Yes" --> P --> R
    O -- "No" --> Q
    Q -- "On download-ack" --> P
    R --> S --> T --> U
    T --> V --> W
```

---

## 5. Data Flow Diagram — Level 1 (Admin Flow)

```mermaid
flowchart TD
    A(["🛡️ Admin"])
    B["POST /admin/auth/login\n{email, password}"]
    C["Return JWT 30min + role"]
    D["WebSocket connect\nws://server/?role=admin&token=jwt"]
    E["Server verifies JWT\nLooks up Admin in MongoDB"]
    F["Server → Admin WS:\nadmin-connected\n{kiosks: [...]}"]
    G["Admin Dashboard\nshows live kiosk list"]

    H["Admin → Server WS:\nview-kiosk {kioskId}"]
    I{"Kiosk locked\nby another admin?"}
    J["Acquire exclusive lock\nlockedByAdmin = adminSessionId"]
    K["Broadcast kiosk-lock-update\nto all other admins"]

    L["Admin sends commands\nvia WebSocket"]
    M["Printer commands\nget-printer-list\ntest-print\ncancel-printing"]
    N["Agent commands\nrestart-kiosk\nget-system-info\nexecute-command"]
    O["Terminal commands\nopen-terminal\nterminal-input\nclose-terminal"]

    P["Server forwards to\nKiosk App or Agent Daemon"]
    Q["Results forwarded\nback to Admin WS"]

    R["Admin → Server WS:\nleave-kiosk"]
    S["Release lock\nlockedByAdmin = null"]
    T["Broadcast kiosk-lock-update"]

    A --> B --> C --> D --> E --> F --> G
    G --> H --> I
    I -- "Locked" --> G
    I -- "Free" --> J --> K --> L
    L --> M & N & O --> P --> Q --> L
    L --> R --> S --> T --> G
```

---

## 6. Print Job State Machine

```mermaid
stateDiagram-v2
    [*] --> upload_url_issued : POST /userdocs/upload-url

    upload_url_issued --> kiosk_download_requested : POST /userdocs/upload-complete\n(S3 upload confirmed)

    kiosk_download_requested --> kiosk_download_success : WS ← kiosk:\ndownload-file-from-s3-ack {success:true}
    kiosk_download_requested --> kiosk_download_failed : WS ← kiosk:\ndownload-file-from-s3-ack {success:false}

    kiosk_download_failed --> kiosk_download_requested : POST /userdocs/start-print\n(retry download)

    kiosk_download_success --> kiosk_file_ready_awaiting_payment : Payment not yet confirmed
    kiosk_download_success --> print_requested : POST /userdocs/start-print\n(payment confirmed + file ready)

    kiosk_file_ready_awaiting_payment --> print_requested : POST /userdocs/start-print\n(payment confirmed)

    payment_confirmed_waiting_for_download --> print_requested : WS ← kiosk:\ndownload-file-from-s3-ack {success:true}

    kiosk_download_requested --> payment_confirmed_waiting_for_download : POST /userdocs/start-print\n(payment before download)

    print_requested --> printing_started : WS ← kiosk:\nprinting-started

    printing_started --> print_completed : WS ← kiosk:\nprint-file-response-to-server {success:true}\nOR printed-status {status:success}

    printing_started --> print_failed : WS ← kiosk:\nprint-file-response-to-server {success:false}\nOR printed-status {status:error}

    print_completed --> [*]
    print_failed --> [*]
```

---

## 7. ER Diagram

```mermaid
erDiagram
    ADMIN {
        ObjectId _id PK
        string username UK
        string email UK
        string password
        string role "superadmin | service_person"
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    KIOSK {
        ObjectId _id PK
        string kioskId UK
        string kioskName
        boolean isActive
        boolean newConnection
        string currentOwner
        string location_region
        string location_city
        string location_address
        string location_pincode
        float location_lat
        float location_lng
        string bw_printer_name
        string bw_printer_status
        float bw_pricePerPage
        string color_printer_name
        string color_printer_status
        float color_pricePerPage
        string machineDetails_hostname
        string machineDetails_platform
        string machineDetails_status "online|offline|maintenance"
        datetime machineDetails_lastSeenAt
        int metrics_totalPrintJobs
        float metrics_revenue_total
        float metrics_revenue_monthly
        float metrics_revenue_daily
        int config_maxFileSizeMB
        datetime createdAt
        datetime updatedAt
    }

    NOAUTHUSER {
        uuid id PK
        string userSessionNumber
        string kioskId FK
        string fileName
        string s3UploadStatus "pending|uploaded|failed"
        string kioskDownloadStatus "pending|requested|downloaded|failed"
        json fileConfig
        string paymentStatus "pending|success|failed|refunded"
        string transactionId UK
        float paymentAmount
        string paymentMethod
        datetime paymentTimestamp
        string merchantOrderId
        string payerVpa
        string printStatus "pending|printing|success|failed"
        boolean isPrintStarted
        boolean isPrinted
        datetime printedAt
        datetime createdAt
        datetime updatedAt
    }

    S3_FILE {
        string fileKey PK "uploads/{sessionId}/{uuid}.pdf"
        string sessionId FK
        string kioskId FK
        string fileName
        string contentType
        int size
        string status "url-issued|uploaded|printing"
        datetime createdAt
        datetime uploadedAt
    }

    ADMIN ||--o{ KIOSK : "manages"
    KIOSK ||--o{ NOAUTHUSER : "hosts sessions"
    NOAUTHUSER ||--|| S3_FILE : "has one file"
```

---

## 8. UML Class Diagram — Server

```mermaid
classDiagram
    class AdminModel {
        +String username
        +String email
        +String password
        +String role
        +Boolean isActive
        +Date createdAt
        +Date updatedAt
        +matchPassword(password) Boolean
        +preSaveHook() void
    }

    class KioskModel {
        +String kioskId
        +String kioskName
        +Boolean isActive
        +Boolean newConnection
        +Object location
        +Object printers
        +Object machineDetails
        +Object metrics
        +Object config
        +Date createdAt
        +Date updatedAt
    }

    class RuntimeStore {
        +Map kioskSockets
        +Map userSessionIdWithKioskId
        +Map adminSockets
        +Map printJobStatusBySession
        +Map pendingS3PrintJobs
        +Map s3UploadRecords
        +Map terminalSessions
    }

    class WebSocketConnectionRouter {
        +handleWebSocketConnection(ws, req) Promise
    }

    class KioskHandler {
        +handleKioskConnection(ws, kioskId, kioskSockets) void
        +sendToKiosk(kioskSockets, kioskId, type, data) void
        +sendToKioskViaSocket(socket, kioskId, type, data) void
    }

    class AgentHandler {
        +handleAgentConnection(ws, kioskId, sockets) void
        +sendToAgent(kioskId, type, data) Boolean
    }

    class AdminHandler {
        +handleAdminConnection(ws, adminSessionId) void
    }

    class PrinterService {
        +printFile(kioskId, options) Boolean
        +requestKioskS3Download(kioskId, options) Boolean
        +getPrinterStatus(kioskId) Boolean
        +getPrinterList(kioskId) Boolean
        +cancelPrinting(kioskId, options) Boolean
        +resetPrinterSettings(kioskId, options) Boolean
        +getJobQueue(kioskId) Boolean
        +setDefaultPrinter(kioskId, printerName) Boolean
        +testPrint(kioskId, options) Boolean
        +getInkLevels(kioskId, options) Boolean
        +pausePrinter(kioskId, options) Boolean
        +resumePrinter(kioskId, options) Boolean
        +getPrintHistory(kioskId, options) Boolean
    }

    class OsmgtService {
        +notifyUserConnected(kioskId, options) Boolean
        +sendStatusMessage(kioskId, message) Boolean
        +sendDisconnectionWarning(kioskId, options) Boolean
        +disconnectUser(kioskId, options) Boolean
        +setSessionReferenceId(kioskId, uuid, status) Boolean
        +sendFileAcknowledgement(kioskId, options) Boolean
        +sendFileMetadata(kioskId, options) Boolean
    }

    class AgentService {
        +startKiosk(kioskId) Boolean
        +stopKiosk(kioskId) Boolean
        +restartKiosk(kioskId) Boolean
        +getKioskStatus(kioskId) Boolean
        +pm2Save(kioskId) Boolean
        +getLogs(kioskId, options) Boolean
        +restartSystem(kioskId) Boolean
        +updateSystem(kioskId) Boolean
        +updateKiosk(kioskId) Boolean
        +getSystemInfo(kioskId) Boolean
        +listProcesses(kioskId) Boolean
        +killProcess(kioskId, pid) Boolean
        +executeCommand(kioskId, options) Boolean
        +openTerminal(kioskId, options) Boolean
        +terminalInput(kioskId, sessionId, data) Boolean
        +terminalResize(kioskId, sessionId, cols, rows) Boolean
        +closeTerminal(kioskId, sessionId) Boolean
    }

    class S3StorageService {
        +createSignedUploadUrl(options) Promise~URL~
        +createSignedDownloadUrl(options) Promise~URL~
        +deleteObjectByKey(key) Promise~void~
    }

    class S3LifecycleService {
        +startS3LifecycleCleanupJob() void
    }

    class UserAuthMiddleware {
        +requireUserAuth(req, res, next) void
    }

    class JwtUtil {
        +generateToken(payload) String
        +verifyToken(token) Object
    }

    WebSocketConnectionRouter --> KioskHandler : routes role=kiosk
    WebSocketConnectionRouter --> AgentHandler : routes role=agent
    WebSocketConnectionRouter --> AdminHandler : routes role=admin

    AdminHandler --> PrinterService : uses
    AdminHandler --> OsmgtService : uses
    AdminHandler --> AgentService : uses

    KioskHandler --> RuntimeStore : reads/writes
    AgentHandler --> RuntimeStore : reads/writes
    AdminHandler --> RuntimeStore : reads/writes

    PrinterService --> KioskHandler : sendToKiosk
    OsmgtService --> KioskHandler : sendToKiosk
    AgentService --> RuntimeStore : reads agent socket

    KioskHandler --> KioskModel : findOneAndUpdate
    AgentHandler --> KioskModel : findOneAndUpdate

    S3LifecycleService --> S3StorageService : deleteObjectByKey
    UserAuthMiddleware --> JwtUtil : verifyToken
```

---

## 9. UML Class Diagram — Frontend

```mermaid
classDiagram
    class AuthContext {
        +User user
        +String token
        +Boolean isAuthenticated
        +Boolean isLoading
        +login(code) Promise~void~
        +logout() void
        +setUser(user) void
    }

    class AdminAuthContext {
        +AdminUser user
        +String token
        +Boolean loading
        +login(token, userData) void
        +logout() void
    }

    class AdminSocketContext {
        +WebSocket socket
        +Any lastMessage
        +sendCommand(kioskId, cmd, data) void
    }

    class authService {
        +googleLogin(code) Promise~AuthResponse~
        +probe() Promise~String~
    }

    class kioskPrintService {
        +authenticateKioskSession(sessionNumber) Promise~KioskAuthResponse~
        +requestUploadUrl(file, metadata) Promise~S3UploadUrlResponse~
        +uploadFileToS3(uploadUrl, file) Promise~void~
        +confirmUploadComplete(fileKey, metadata) Promise~void~
        +uploadMergedPdf(file, metadata) Promise~fileKey~
        +startPrint(payload) Promise~Result~
        +checkDownloadStatus() Promise~DownloadStatusResponse~
        +createPrintStatusStream(token, onMessage, onError) Subscription
    }

    class uploadService {
        +uploadFile(file) Promise~Result~
    }

    class useKioskSession {
        +getSessionNumber() String
        +setSessionNumber(sessionNumber) void
        +clearSession() void
    }

    class useAuth {
        +user User
        +token String
        +isAuthenticated Boolean
        +login(code) Promise
        +logout() void
    }

    class ApiClient {
        +baseURL String
        +interceptors RequestInterceptor
        +get(url) Promise
        +post(url, data) Promise
        +put(url, data) Promise
    }

    AuthContext --> authService : uses
    AdminAuthContext --> ApiClient : axios direct
    AdminSocketContext --> AdminAuthContext : reads token
    authService --> ApiClient : uses
    kioskPrintService --> ApiClient : uses
    uploadService --> ApiClient : uses
    useAuth --> AuthContext : consumes
```

---

## 10. Sequence Diagram — User Print Flow

```mermaid
sequenceDiagram
    actor User as 👤 User (Phone)
    participant SPA as React SPA
    participant Server as Express Server
    participant S3 as AWS S3
    participant Kiosk as Kiosk App
    participant Prisma as PostgreSQL (Prisma)
    participant Mongo as MongoDB

    Note over Kiosk,Server: Kiosk already connected via WebSocket (role=kiosk)

    Server->>Kiosk: WS: setting-reference-id-for-user-identification {userSessionUUID}
    Note over Kiosk: Displays QR code with userSessionUUID

    User->>SPA: Scans QR code → opens /kioskRedirect?userSessionNumber=uuid
    SPA->>Server: POST /kioskRedirect {userSessionNumber}
    Server->>Server: Lookup userSessionIdWithKioskId[uuid] → kioskId
    Server-->>SPA: {token: JWT(10min), kioskId}
    SPA->>SPA: Store token in localStorage

    User->>SPA: Selects PDF files, configures print options
    SPA->>Server: POST /userdocs/upload-url {fileName, size, contentType, metadata}
    Server->>S3: createSignedUploadUrl(fileKey)
    S3-->>Server: signedPutUrl
    Server->>Prisma: CREATE NoAuthUser {sessionId, kioskId, fileName, status:pending}
    Server-->>SPA: {uploadUrl, fileKey, expiresIn:600}

    SPA->>S3: PUT <uploadUrl> (binary PDF — direct, bypasses server)
    S3-->>SPA: 200 OK

    SPA->>Server: POST /userdocs/upload-complete {fileKey}
    Server->>S3: createSignedDownloadUrl(fileKey)
    S3-->>Server: signedGetUrl
    Server->>Kiosk: WS: download-file-from-s3-request {fileKey, fileName, downloadUrl, sessionId}
    Server->>Prisma: UPDATE s3UploadStatus=uploaded, kioskDownloadStatus=requested
    Server-->>SPA: {success:true, prefetchRequested:true}

    Kiosk->>S3: GET <downloadUrl> (downloads PDF)
    S3-->>Kiosk: PDF binary
    Kiosk->>Server: WS: download-file-from-s3-ack {sessionId, success:true, fileName}
    Server->>Prisma: UPDATE kioskDownloadStatus=downloaded
    Server->>Server: pendingS3PrintJobs[sessionId].downloadStatus = success

    User->>SPA: Confirms payment
    SPA->>Server: POST /userdocs/start-print {fileKey, copies, colorMode, orientation, ...}
    Server->>Mongo: findOne Kiosk → get printer name for colorMode
    Server->>Prisma: UPDATE paymentStatus=success, fileConfig={...}
    Server->>Kiosk: WS: print-file-request-from-user-via-server {fileName, printer, copies, ...}
    Server-->>SPA: {success:true, waitingForDownload:false}

    Kiosk->>Kiosk: Sends job to physical printer
    Kiosk->>Server: WS: printing-started
    Kiosk->>Server: WS: print-file-response-to-server {success:true, sessionId}
    Server->>Prisma: UPDATE isPrinted=true, printStatus=success
    Kiosk->>Server: WS: printed-status {status:success, price}
    Server->>Mongo: $inc metrics.totalPrintJobs, revenue

    loop Poll every 5s
        SPA->>Server: GET /userdocs/print-status?token=jwt
        Server-->>SPA: {status: print-completed}
    end

    SPA->>User: Shows "Print Complete" ✅
```

---

## 11. Sequence Diagram — Admin Kiosk Management

```mermaid
sequenceDiagram
    actor Admin as 🛡️ Admin
    participant AdminSPA as Admin React SPA
    participant Server as Express Server
    participant Mongo as MongoDB
    participant Kiosk as Kiosk App
    participant Agent as Agent Daemon

    Admin->>AdminSPA: Opens /admin/login
    AdminSPA->>Server: POST /admin/auth/login {email, password}
    Server->>Mongo: findOne Admin {email}
    Mongo-->>Server: Admin document
    Server->>Server: bcrypt.compare(password, hash)
    Server-->>AdminSPA: {token: JWT(30min), role, username}
    AdminSPA->>AdminSPA: Store adminToken in localStorage

    AdminSPA->>Server: WebSocket connect ws://?role=admin&token=jwt
    Server->>Server: jwt.verify(token) → lookup Admin in MongoDB
    Server-->>AdminSPA: WS: admin-connected {kiosks: [...live status...]}

    Admin->>AdminSPA: Clicks on KIOSK001
    AdminSPA->>Server: WS: view-kiosk {kioskId: KIOSK001}
    Server->>Server: Check lockedByAdmin
    Server-->>AdminSPA: WS: view-kiosk-result {success:true, message:Exclusive access granted}
    Server-->>AdminSPA: WS: kiosk-lock-update (broadcast to other admins)

    AdminSPA->>Server: WS: get-printers-request {kioskId: KIOSK001}
    Server->>Kiosk: WS: printer-get-list-request-from-server
    Kiosk-->>Server: WS: printer-list-result {printers: [...]}
    Server->>Mongo: findOneAndUpdate Kiosk printers.availableList
    Server-->>AdminSPA: WS: printer-list-result {kioskId, printers, colorPrinters, bwPrinters}

    Admin->>AdminSPA: Clicks "Open Terminal"
    AdminSPA->>Server: WS: open-terminal-request {kioskId: KIOSK001, cols:80, rows:24}
    Server->>Agent: WS: open-terminal {sessionId, cols, rows}
    Agent-->>Server: WS: terminal-opened {sessionId}
    Server-->>AdminSPA: WS: terminal-opened {sessionId, kioskId}

    Admin->>AdminSPA: Types command in terminal
    AdminSPA->>Server: WS: terminal-input {sessionId, data: ls -la\r}
    Server->>Agent: WS: terminal-input {sessionId, data}
    Agent-->>Server: WS: terminal-output {sessionId, data: output...}
    Server-->>AdminSPA: WS: terminal-output {sessionId, data}

    Admin->>AdminSPA: Closes terminal
    AdminSPA->>Server: WS: close-terminal-request {sessionId}
    Server->>Agent: WS: close-terminal {sessionId}
    Agent-->>Server: WS: terminal-closed {sessionId}
    Server-->>AdminSPA: WS: terminal-closed {sessionId}

    Admin->>AdminSPA: Clicks "Leave Kiosk"
    AdminSPA->>Server: WS: leave-kiosk
    Server->>Server: lockedByAdmin = null
    Server-->>AdminSPA: WS: leave-kiosk-result {success:true}
    Server-->>AdminSPA: WS: kiosk-lock-update (broadcast)
```

---

## 12. REST API Endpoints

### Auth — `/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/google` | None | Exchange Google OAuth code → app JWT + user profile |
| `GET` | `/auth/pr` | None | Health-check probe |

### Admin Auth — `/admin/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/admin/auth/register` | None | Register admin (first = superadmin, auto-activated) |
| `POST` | `/admin/auth/login` | None | Login → JWT 30min |
| `POST` | `/admin/auth/logout` | None | Logout (client-side) |
| `GET` | `/admin/auth/me` | Bearer JWT | Get current admin profile |

### Admin Management — `/admin`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/admin/accounts` | Bearer + superadmin | List all admin accounts |
| `PATCH` | `/admin/accounts/:id` | Bearer + superadmin | Update admin `isActive` / `role` |
| `GET` | `/admin/kiosks` | Bearer | List all kiosks (DB + live socket status merged) |
| `GET` | `/admin/kiosks/:kioskId` | Bearer | Get single kiosk details |
| `PATCH` | `/admin/kiosks/:kioskId` | Bearer | Update kiosk fields in MongoDB |
| `POST` | `/admin/kiosks/:kioskId/:command` | Bearer | Send command to kiosk (stub) |

### User / Session — `/`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/kioskRedirect` | None | Validate QR session UUID → return user JWT 10min |
| `POST` | `/kisokRedirect` | None | Alias (typo kept for compatibility) |

### Upload & Print — `/userdocs`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/userdocs/upload-url` | Bearer (user) | Generate S3 signed PUT URL + create Prisma record |
| `POST` | `/userdocs/upload-complete` | Bearer (user) | Confirm S3 upload + trigger kiosk pre-download |
| `POST` | `/userdocs/start-print` | Bearer (user) | Confirm payment + dispatch print to kiosk |
| `GET` | `/userdocs/print-status` | Bearer or `?token=` | Poll in-memory print job status |
| `GET` | `/userdocs/download-status` | Bearer (user) | Check kiosk download status from Prisma |

---

## 13. WebSocket Events Reference

### 13.1 Server → Kiosk

| Event | Key Payload Fields | Purpose |
|---|---|---|
| `setting-reference-id-for-user-identification` | `userSessionUUID, serverStatus` | Push session UUID for QR code generation |
| `connected-to-user-successfully` | `userName` | User scanned QR and connected |
| `status-user-connected-to-kiosk` | `msg` | General status message for kiosk UI |
| `user-disconnection-warning` | `msg, isActive, timeout_period` | Countdown warning before user disconnect |
| `user-disconnected` | `reason` | User session ended — reset kiosk UI |
| `download-file-from-s3-request` | `fileKey, fileName, downloadUrl, sessionId` | Ask kiosk to download PDF from S3 |
| `print-file-request-from-user-via-server` | `fileName, sessionId, copies, printer, orientation, paperSize, sides, pageRanges, fitToPage, colorMode` | Dispatch print job |
| `metadata-before-file-sending` | `userName, fileName, fileSize, totalChunks, sessionId` | File metadata before binary chunks (legacy) |
| `ack-after-file-sent` | `fileName, sessionId, kioskId` | Confirm file transfer complete (legacy) |
| `printer-status-request-from-server` | — | Request printer status |
| `printer-get-list-request-from-server` | — | Request printer list |
| `cancle-printing-request-from-server` | `printer` | Cancel active print job |
| `reset-printer-settings-from-server` | `printer` | Reset printer settings |
| `get-job-queue-request-from-server` | — | Request print job queue |
| `set-default-printer-request-from-server` | `printerName` | Set default printer |
| `test-print-request-from-server` | `printer` | Send test print |
| `ink-levels-request-from-server` | `printer` | Request ink/toner levels |
| `pause-printer-request-from-server` | `printer, reason` | Pause printer |
| `resume-printer-request-from-server` | `printer` | Resume printer |
| `print-history-request-from-server` | `limit` | Request print history |
| `restart-kiosk-now` | `msg` | Sent to agent when kiosk disconnects |

### 13.2 Kiosk → Server

| Event | Key Payload Fields | Purpose |
|---|---|---|
| `register-kiosk` | `kioskid` | Kiosk registers on connect |
| `reset-user-session-id-kiosk` | `oldId` | Request new session UUID (user left) |
| `download-file-from-s3-ack` | `sessionId, success, fileKey, fileName, error` | S3 download result |
| `printing-started` | `status, data` | Print job started |
| `print-file-response-to-server` | `sessionId, success` | Print job result |
| `printed-status` | `status, data.price` | Final print status — triggers metrics update on success |
| `printer-list-result` | `data.printers[]` | Available printers — updates MongoDB |
| `printer-get-list-response-to-server` | `printers[]` | Alias for above |
| `kiosk-status-result` | `printers[]` | Full kiosk status |
| `printer-status-response-to-server` | `data` | Printer status report |
| `ack-of-file-from-kiosk` | `sessionId` | File received (legacy direct transfer) |
| `unique-user-id-setuped` | `kioskStatus, kioskid, userUniqueReferenceId` | Session UUID confirmed |
| `job-status` | `...` | General job status |
| `testing-file-request-from-kiosk` | `sessionId` | Request test file send |

### 13.3 Server → Agent

| Event | Key Payload Fields | Purpose |
|---|---|---|
| `start-kiosk-now` | — | Start kiosk app via PM2 |
| `stop-kiosk-now` | — | Stop kiosk app via PM2 |
| `restart-kiosk-now` | — | Restart kiosk app via PM2 |
| `kiosk-status-check` | — | Get PM2 kiosk process status |
| `pm2-save` | — | Persist PM2 process list |
| `get-logs` | `lines` | Fetch PM2 logs |
| `restart-system-now` | — | Reboot kiosk machine |
| `update-system-now` | — | Run apt-get update + upgrade |
| `update-kiosk-now` | — | git pull + npm install + pm2 restart |
| `get-system-info` | — | CPU, memory, disk, temp, IPs |
| `list-processes` | — | List all PM2 processes |
| `kill-process` | `pid` | Kill a process by PID |
| `execute-command` | `cmd, cwd, timeout, requestId` | Execute arbitrary shell command |
| `open-terminal` | `sessionId, cols, rows` | Open PTY terminal session |
| `terminal-input` | `sessionId, data` | Send input to PTY |
| `terminal-resize` | `sessionId, cols, rows` | Resize PTY |
| `close-terminal` | `sessionId` | Close PTY session |

### 13.4 Agent → Server

| Event | Key Payload Fields | Purpose |
|---|---|---|
| `agent-ready` | `kioskName, hostname, platform, arch, capabilities` | Agent connected — updates MongoDB machineDetails |
| `agent-heartbeat` | `timestamp, freeMemory, uptime, loadAvg` | Periodic heartbeat — updates MongoDB lastSeenAt |
| `kiosk-command-result` | `command, success` | Result of kiosk management command |
| `kiosk-status-result` | `success, printers[]` | Kiosk status — updates MongoDB printers |
| `printer-list-result` | `printers[]` | Printer list — updates MongoDB |
| `system-info-result` | `platform, arch, hostname` | System info — updates MongoDB machineDetails |
| `process-list-result` | `processes[]` | PM2 process list |
| `logs-result` | `logs[]` | PM2 log output |
| `execute-command-result` | `success, stdout, stderr, requestId` | Shell command result |
| `terminal-opened` | `sessionId` | PTY session ready |
| `terminal-output` | `sessionId, data` | PTY output (forwarded to admin) |
| `terminal-closed` | `sessionId` | PTY session closed |
| `terminal-error` | `sessionId, error` | PTY error |

### 13.5 Admin → Server

| Event | Key Payload Fields | Purpose |
|---|---|---|
| `get-kiosk-list` | — | Get all kiosks with live status |
| `view-kiosk` | `kioskId` | Acquire exclusive lock on kiosk |
| `leave-kiosk` | — | Release kiosk lock |
| `get-kiosk-data` | `kioskId` | Fetch kiosk from MongoDB |
| `update-kiosk-data` | `kioskId, data{}` | Update kiosk fields in MongoDB |
| `print-file` | `kioskId, fileName, sessionId, copies, printer, ...` | Dispatch print job |
| `get-printer-list` / `get-printers-request` | `kioskId` | Request printer list |
| `get-printer-status` | `kioskId` | Request printer status |
| `cancel-printing` | `kioskId, printer` | Cancel print job |
| `reset-printer-settings` | `kioskId, printer` | Reset printer settings |
| `get-job-queue` | `kioskId` | Get print job queue |
| `set-default-printer` | `kioskId, printerName` | Set default printer |
| `test-print` / `test-print-request` | `kioskId, printer` | Send test print |
| `get-ink-levels` | `kioskId, printer` | Get ink/toner levels |
| `pause-printer` | `kioskId, printer, reason` | Pause printer |
| `resume-printer` | `kioskId, printer` | Resume printer |
| `get-print-history` | `kioskId, limit` | Get print history |
| `notify-user-connected` | `kioskId, userName` | Notify kiosk of user |
| `send-status-message` | `kioskId, message` | Push status to kiosk UI |
| `send-disconnection-warning` | `kioskId, message, timeoutPeriod` | Warn kiosk of disconnect |
| `disconnect-user` | `kioskId, reason` | Disconnect user from kiosk |
| `set-session-reference-id` | `kioskId, userSessionUUID` | Push new session UUID to kiosk |
| `start-kiosk` / `start-kiosk-request` | `kioskId` | Start kiosk via PM2 |
| `stop-kiosk` / `stop-kiosk-request` | `kioskId` | Stop kiosk via PM2 |
| `restart-kiosk` / `restart-kiosk-request` | `kioskId` | Restart kiosk via PM2 |
| `get-kiosk-status` / `get-kiosk-status-request` | `kioskId` | Get PM2 status |
| `pm2-save` | `kioskId` | Save PM2 process list |
| `get-logs` / `get-logs-request` | `kioskId, lines` | Fetch PM2 logs |
| `restart-system` | `kioskId` | Reboot kiosk machine |
| `update-system` | `kioskId` | Run system update |
| `update-kiosk` | `kioskId` | Update kiosk app |
| `get-system-info` / `get-system-info-request` | `kioskId` | Get system info |
| `list-processes` | `kioskId` | List PM2 processes |
| `kill-process` | `kioskId, pid` | Kill a process |
| `execute-command` | `kioskId, cmd, cwd, timeout` | Execute shell command |
| `open-terminal` / `open-terminal-request` | `kioskId, sessionId, cols, rows` | Open PTY terminal |
| `terminal-input` | `sessionId, data` | Send input to terminal |
| `terminal-resize` | `sessionId, cols, rows` | Resize terminal |
| `close-terminal` / `close-terminal-request` | `sessionId` | Close terminal |

### 13.6 Server → Admin (Responses & Broadcasts)

| Event | Purpose |
|---|---|
| `admin-connected` | Sent on connect with live kiosk list |
| `kiosk-list` | Response to `get-kiosk-list` |
| `kiosk-lock-update` | Broadcast when any kiosk lock changes |
| `view-kiosk-result` | Result of view-kiosk request |
| `leave-kiosk-result` | Result of leave-kiosk request |
| `update-kiosk-data-result` | Result of kiosk DB update |
| `get-kiosk-data-result` | Kiosk data from MongoDB |
| `agent-ready` | Forwarded from agent |
| `agent-heartbeat` | Forwarded from agent |
| `agent-disconnected` | Agent went offline |
| `printer-list-result` | Forwarded from kiosk/agent (with colorPrinters, bwPrinters categorized) |
| `kiosk-status-result` | Forwarded from agent/kiosk |
| `system-info-result` | Forwarded from agent |
| `process-list-result` | Forwarded from agent |
| `logs-result` | Forwarded from agent |
| `execute-command-result` | Forwarded from agent |
| `terminal-opening` | Terminal session being opened |
| `terminal-opened` | Terminal session ready |
| `terminal-output` | PTY output stream |
| `terminal-closed` | Terminal session closed |
| `terminal-error` | Terminal error |
| `printed-status` | Forwarded from kiosk |
| `download-file-from-s3-ack` | Forwarded from kiosk |
| `print-file-result` | Ack that print command was dispatched |
| `start/stop/restart-kiosk-result` | Ack for kiosk management commands |
| `error` | Error response |

---

## 14. Frontend Route Map

```mermaid
graph LR
    subgraph Public["Public Routes (no auth)"]
        Home["/\nHomePage"]
        Auth["/auth\nLoginPage"]
        OAuth["/oauth-callback\nOAuthCallbackPage"]
        KioskRedir["/kioskRedirect\n/kisokRedirect\nKioskRedirectPage"]
        Upload["/upload\nUploadPage"]
        Preview["/preview\nPreviewPage"]
        Payment["/payment\nPaymentPage"]
        Printing["/printing\nPrintingStatusPage"]
        Contact["/contact\nContactPage"]
        Error["/error\nNotFoundPage"]
    end

    subgraph AdminRoutes["Admin Routes (Bearer JWT required)"]
        AdminLogin["/admin/login\nAdminLoginPage"]
        AdminSignup["/admin/signup\nAdminSignupPage"]
        AdminDash["/admin\nAdminDashboardPage"]
        AdminRegion["/admin/regions/:name\nAdminRegionPage"]
        AdminKiosk["/admin/kiosk/:kioskId\nAdminKioskDetailPage"]
        AdminAccounts["/admin/accounts\nAdminAccountsPage\n(superadmin only)"]
    end

    KioskRedir -- "stores JWT\nredirects to" --> Upload
    Upload --> Preview --> Payment --> Printing
    Auth --> OAuth -- "exchanges code\nstores JWT" --> Home
```
