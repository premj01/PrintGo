# server2

This folder is a modularized copy of `server/`.

- Native `server/` code is untouched.
- Entry point: `server2/server.js`
- Start command: `npm start`

## Structure

- `src/app` -> express app bootstrapping
- `src/ws` -> websocket setup, validation, handlers
- `src/modules` -> auth/admin/user/upload/system route modules
- `src/state` -> shared runtime in-memory store
- `src/config` -> CORS and file type config
- `src/middleware` -> upload middleware
- `src/services` -> utility services
