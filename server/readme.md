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

## Customer email bills

Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in the server's `.env` (or the hosting
provider's server environment), then restart the server. The sender must be on
your verified Resend domain. See `.env.example` for the two settings; keep all
existing database, payment, and storage settings.

`POST /bill-e-customer` requires the customer's existing Bearer session token:

```json
{ "email": "customer@example.com", "sessionId": "the-current-session", "paymentId": "pay_optional_reference" }
```

The session must match the token. The endpoint loads a verified payment from
PostgreSQL and sends an HTML bill plus a plain-text version through Resend.
`paymentId` selects a specific payment; omitting it selects the latest verified
payment in that session. Unpaid sessions cannot request receipts. The bill uses
stored quantities/rates and the recorded payment total, with refund information
when available. Older payments without a saved breakdown show a single printing
charge. No database schema migration is needed; the breakdown uses `fileConfig.billing`.

Requests are limited to five per session per ten minutes per server process.
Identical email retries use Resend's idempotency key (24-hour window). For a
multi-instance deployment, use a shared rate limiter as well.

Payment verification in the customer app automatically requests printing and
opens the bill dialog independently. A failed bill request never cancels the
print job. Customers can close/reopen the dialog, change the email, and reuse
the address saved in their browser. No email is sent until they press Send bill.

Checks: `node --experimental-test-module-mocks --test test/*.test.js` in `server`;
run `npm test` and `npm run build` in `printgoapp`.
