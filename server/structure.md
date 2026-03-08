# server2 Structural Format

This folder follows modular server structure while keeping behavior aligned with the original `server/`.

## Entrypoint
- `server.js`: bootstrap only (create app, create websocket server, listen)

## App Layer
- `src/app/createApp.js`: middleware + route registration

## WebSocket Layer
- `src/ws/createWebSocketServer.js`: initializes `WebSocketServer`
- `src/ws/connectionRouter.js`: role-based connection orchestration
- `src/ws/validators/validateKioskId.js`: kiosk validation
- `src/ws/handlers/kiosk.handler.js`: kiosk socket behavior
- `src/ws/handlers/agent.handler.js`: agent socket behavior

## HTTP Modules
- `src/modules/auth/*`
- `src/modules/admin/*`
- `src/modules/user/*`
- `src/modules/upload/*`
- `src/modules/system/*`

## Shared Runtime
- `src/state/runtimeStore.js`: in-memory shared objects

## Cross-cutting
- `src/config/*`
- `src/middleware/*`
- `src/services/*`
