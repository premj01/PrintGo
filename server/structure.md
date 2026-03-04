# Server Modularization Structure

Date: 2026-03-04
Scope: `server/`

## Goal
Refactor current monolithic entry logic into modular, domain-based files while preserving behavior.

---

## Current High-Level Issues

1. `server.js` contains bootstrapping + route mounting + websocket orchestration + runtime state.
2. Multiple modules import runtime objects from `server.js`, creating tight coupling and circular dependencies.
3. Some files are incomplete or inconsistent (naming/exports/vars), making future maintenance harder.

---

## Target Folder Structure

```txt
server/
  src/
    app/
      createApp.js
    config/
      cors.js
      fileTypes.js
    state/
      runtimeStore.js
    routes/
      index.js
    ws/
      createWebSocketServer.js
      connectionRouter.js
      handlers/
        kiosk.handler.js
        agent.handler.js
      validators/
        validateKioskId.js
    modules/
      auth/
        auth.routes.js
        auth.controller.js
        auth.service.js
      admin/
        admin.routes.js
        admin.controller.js
      user/
        user.routes.js
        user.controller.js
      upload/
        upload.routes.js
        upload.controller.js
        upload.service.js
      kiosk/
        kioskRedirect.controller.js
    middleware/
      uploadMiddleware.js
      errorHandler.js
    services/
      fileCleanup.service.js
  server.js
```

Notes:
- Keep root `server.js` as **bootstrap only**.
- Move business logic from routes/handlers into controllers/services.
- Move shared in-memory objects to one store module.

---

## `server.js` Migration Map (Line Range -> Module)

Based on current `server/server.js`.

1. **Lines 1-16 (imports)**
   - Keep only minimal bootstrap imports in `server.js`.
   - Move route imports into `src/routes/index.js`.
   - Move websocket handler imports into `src/ws/createWebSocketServer.js`.

2. **Lines 19-25 (express app + middleware + static + upload route mount)**
   - Move to `src/app/createApp.js`.

3. **Line 27 (`new WebSocketServer`)**
   - Move to `src/ws/createWebSocketServer.js`.

4. **Lines 29-33 (exported runtime objects)**
   - Move to `src/state/runtimeStore.js`:
     - `kioskSockets`
     - `userSessionIdWithKioskId`
     - `userWithFiles`
     - `allFiles`

5. **Lines 37-40 (`validateKioskId`)**
   - Move to `src/ws/validators/validateKioskId.js`.

6. **Lines 42-128 (`wss.on("connection", ...)`)**
   - Move to `src/ws/connectionRouter.js`.
   - Split by role into:
     - `src/ws/handlers/kiosk.handler.js`
     - `src/ws/handlers/agent.handler.js`

7. **Lines 132-134 (route mounting)**
   - Move to `src/routes/index.js` and called from `createApp.js`.

8. **Lines 138-146 (`/data`, `/health`)**
   - Move to `src/modules/system/system.routes.js` (or `src/routes/system.routes.js`).

9. **Lines 148-150 (`server.listen`)**
   - Keep in root bootstrap `server.js`.

---

## Route/Module Mapping

### Existing -> Target

- `router/auth.js` -> `src/modules/auth/auth.routes.js`
- `router/admin.js` -> `src/modules/admin/admin.routes.js`
- `router/user.js` -> `src/modules/user/user.routes.js`
- `router/upload.js` -> `src/modules/upload/upload.routes.js`

- `controllers/kisokRedirectHandle.js` -> `src/modules/kiosk/kioskRedirect.controller.js`
- `controllers/agentCommandMgt.js` -> `src/modules/admin/admin.controller.js` (or remove if unused)

- `Handlers/kioskHandler.js` -> `src/ws/handlers/kiosk.handler.js`
- `Handlers/agentHandler.js` -> `src/ws/handlers/agent.handler.js`
- `Handlers/send_to_kiosk.js` -> `src/ws/services/sendToKiosk.service.js`

- `utils/files_garbage_collector.js` -> `src/services/fileCleanup.service.js`
- `middleware/uploadMiddleware.js` -> `src/middleware/uploadMiddleware.js`

- `configurations/cors.js` -> `src/config/cors.js`
- `configurations/fileTypes.js` -> `src/config/fileTypes.js`

---

## Dependency Rule (Important)

To avoid circular imports:

1. **No module should import from root `server.js`.**
2. Shared runtime state must come from `src/state/runtimeStore.js`.
3. Routes should call controllers, controllers call services, services use state/config.
4. WebSocket handlers should receive dependencies (store, helpers) via parameters where possible.

---

## Suggested Bootstrap Shape (`server.js`)

```js
import http from "http";
import { createApp } from "./src/app/createApp.js";
import { createWebSocketServer } from "./src/ws/createWebSocketServer.js";

const app = createApp();
const server = http.createServer(app);
createWebSocketServer(server);

server.listen(3000, () => {
  console.log("✅ WebSocket + Express server running on port 3000");
});
```

---

## Phase-by-Phase Refactor Plan

1. Extract `runtimeStore.js` and replace all `../server.js` imports.
2. Extract websocket connection router + validator.
3. Move route mounting to centralized route index.
4. Move route business logic into controllers/services.
5. Fix incomplete files and naming consistency (`kisok` -> `kiosk`).
6. Add global error middleware and basic module-level tests.

---

## Known Files To Review During Refactor

- `controllers/kisokRedirectHandle.js` (incomplete vars and response flow)
- `Handlers/send_to_kiosk.js` (inconsistent function names/exports)
- `router/user.js` (`req.kioskSockets` dependency should come from store/service)

---

## Naming Convention Recommendation

- Files: `kebab` or `dot` style consistently (current recommendation: `feature.type.js`, e.g. `auth.routes.js`).
- Folders: domain-first (`modules/auth`, `modules/upload`, etc.).
- Keep `controller` thin, `service` for logic, `routes` for HTTP mapping only.
