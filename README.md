# UABS Event Backend

Backend API for the **University of Abuja Business School (UABS) Event Registration and Accreditation Platform**.

This repository is currently includes **Phases 1–3: setup, database architecture, and administrator authentication**. It contains the server foundation only: environment validation, MongoDB connection, security middleware, error handling and a health-check endpoint. Business features (registration, authentication, email, QR codes) are added in later phases.

## Technology stack

- Node.js 20+
- Express.js
- TypeScript (strict mode)
- MongoDB Atlas with Mongoose
- Zod (environment and request validation)
- Helmet, CORS, Morgan
- dotenv
- tsx (development runner)

## Requirements

- Node.js 20 or higher
- npm
- A MongoDB Atlas account (free M0 tier is enough)

## Installation

```bash
cd uabs-event-backend
npm install
cp .env.example .env
```

Then fill in `.env` (see below).

## Environment configuration

| Variable | Required in Phase 1 | Description |
| --- | --- | --- |
| `NODE_ENV` | No (default `development`) | `development`, `production` or `test` |
| `PORT` | No (default `5000`) | Port the server listens on |
| `CLIENT_URL` | Yes | Allowed frontend origin(s), comma-separated, no trailing slash |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Not yet | Used in the authentication phase |
| `JWT_REFRESH_SECRET` | Not yet | Used in the authentication phase |
| `RESEND_API_KEY` | Not yet | Used in the email phase |

Supporting local and deployed frontends together:

```
CLIENT_URL=http://localhost:5173,https://your-frontend.example.com
```

Only the listed origins are allowed by CORS. If a required variable is missing or invalid, the server prints which variables are wrong (never their values) and exits.

Never commit `.env`. Only `.env.example` is tracked.

## Connecting MongoDB Atlas

1. Create a free account at https://www.mongodb.com/cloud/atlas and create a cluster (M0 Free).
2. **Database Access**: add a database user with a username and password. Use a password without special characters, or URL-encode them.
3. **Network Access**: add your current IP address. For Render deployment, you will need to allow Render's outbound IPs or temporarily `0.0.0.0/0` (less secure).
4. Click **Connect** on your cluster, choose **Drivers**, and copy the connection string.
5. Add a database name before the `?`, for example:

   ```
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/uabs-events?retryWrites=true&w=majority
   ```

6. Paste it into `.env`.

## Running in development

```bash
npm run dev
```

The server restarts automatically on file changes. Check it at http://localhost:5000/api/v1/health.

## Building for production

```bash
npm run build
npm start
```

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the server with tsx in watch mode |
| `npm run build` | Compile TypeScript into `dist/` |
| `npm start` | Run the compiled app from `dist/` |
| `npm run typecheck` | Type-check without emitting files |

## Health check

`GET /api/v1/health` returns:

```json
{
  "success": true,
  "status": "ok",
  "application": "UABS Event Registration API",
  "environment": "development",
  "timestamp": "2026-11-19T16:00:00.000Z",
  "database": "connected"
}
```

It responds with HTTP 503 and `"status": "degraded"` when the database is not connected, which suits uptime monitors such as Render's health checks.

## Project structure

```
uabs-event-backend/
├── src/
│   ├── config/         env.ts (validated env), database.ts (Mongoose connection)
│   ├── constants/      shared constants
│   ├── controllers/    request handlers
│   ├── middleware/     notFound, errorHandler
│   ├── routes/         route modules, mounted under /api/v1
│   ├── services/       business logic (later phases)
│   ├── models/         Mongoose models (later phases)
│   ├── validators/     Zod request schemas (later phases)
│   ├── types/          shared TypeScript types
│   ├── utils/          logger, AppError
│   ├── app.ts          Express app (no startup logic)
│   └── server.ts       startup, DB connection, graceful shutdown
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Phase 2: database models

Phase 2 adds seven timestamped Mongoose models under `src/models/`:

- **Event** — event identity, schedule, venue, contact details, registration window and lifecycle status. `slug` is globally unique. `institution` and `organizingBody` store the initial event's institutional context as data.
- **ParticipantCategory** — event-scoped configurable categories and category-specific required/optional participant field keys. Category names are unique within an event.
- **Participant** — personal, registration, optional academic, QR reference-hash and additional information. Email is normalized to lowercase. The default policy is one email per event; registration IDs are globally unique; matriculation numbers are unique only when present and only within an event.
- **Administrator** — normalized unique email, password hash (excluded from query selection by default), centrally enumerated roles and permissions.
- **Attendance** — event/participant relationship, check-in state and administrator reference. A unique `(eventId, participantId)` index prevents duplicate records. The future check-in service should use conditional atomic `findOneAndUpdate` operations and handle duplicate-key races; the unique index is the final concurrency guard.
- **Invitation** — one logical invitation per participant/event, unique reference code, delivery state and resend metadata.
- **ActivityLog** — append-only audit entries, with indexes for event, administrator, action and date. Mongoose update/delete operations are blocked; production database credentials should also deny update/delete privileges on this collection for stronger enforcement.

### Important index decisions

| Index | Reason |
| --- | --- |
| `Event.slug` unique | Stable event lookup and URL identity |
| `Participant.registrationId` unique | Prevent duplicate registration references |
| `Participant(eventId, email)` unique | Default duplicate-registration policy per event; email is stored normalized |
| `Participant(eventId, matriculationNumber)` partial unique | Prevent duplicate student registrations without making the field globally unique or restricting non-students |
| `Attendance(eventId, participantId)` unique | One attendance record per participant per event; supports concurrent check-in protection |
| `Invitation(eventId, participantId)` unique | One logical invitation per participant/event |
| `Administrator.email` unique | One administrator account per normalized email |
| Activity log compound date indexes | Efficient event/admin/action audit history queries |

Cross-document existence and category-specific required-field checks (for example, ensuring the selected category belongs to the same event and that its required fields are present) must be enforced in the future registration service, because MongoDB schema validators cannot safely enforce references across collections. MongoDB transactions should be used by future multi-document workflows when the deployment supports them.

### Seed initial event data

```bash
npm run seed
```

The seed uses upserts and `$setOnInsert`, so rerunning it does not overwrite later event edits or duplicate categories. It creates no participants, attendance, or administrator credentials. The seeded event starts as `DRAFT` with registration closed.

### Model tests

```bash
npm test
```

Tests use `mongodb-memory-server`, an isolated in-memory MongoDB instance, and call `Model.init()` before testing unique indexes. The package needs to be installed before running tests. The first execution may download a MongoDB binary; environments without network access may need a locally available MongoDB test instance instead.

## Phase 3: administrator authentication

Authentication endpoints (prefix `/api/v1/auth`):
- `POST /login` — email/password; returns access token and profile; refresh token is HttpOnly cookie.
- `POST /refresh` — rotates refresh cookie, returns access token.
- `POST /logout` — revokes refresh session and clears cookie.
- `GET /me` — bearer access token; current safe profile.
- `POST /forgot-password` — generic response, creates reset token; email delivery is an injectable service stub.
- `POST /reset-password` — reset using token and strong new password.
- `POST /change-password` — authenticated password change and session revocation.

Passwords must be at least 10 characters and include uppercase, lowercase, numeric and symbol characters. Refresh token and reset token values are stored hashed. Roles: SUPER_ADMIN, REGISTRATION_ADMIN, ACCREDITATION_ADMIN, VIEWER. Permissions are centrally mapped by role; explicit administrator permissions are additive. Middleware exports `authenticate`, `authorizeRoles`, and `authorizePermissions`.

Required Phase 3 variables: `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (each at least 32 characters), `JWT_ACCESS_EXPIRES_IN` (default 15m), `JWT_REFRESH_EXPIRES_IN` (default 7d), `COOKIE_SECURE`, `COOKIE_SAME_SITE`, optional `COOKIE_DOMAIN`, `BCRYPT_SALT_ROUNDS` (10–16), `PASSWORD_RESET_EXPIRES_IN_MINUTES`. CORS accepts credentialed requests from `CLIENT_URL` origins. In production set COOKIE_SECURE=true and use HTTPS.

Create the first SUPER_ADMIN interactively:
```bash
npm run create-super-admin
```
Or set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in your environment for non-interactive execution. Password is never echoed intentionally or logged. The script refuses if a SUPER_ADMIN already exists.

Example login request:
```json
{"email":"admin@example.com","password":"ExampleStrong1!"}
```
Login response includes `data.accessToken` and `data.administrator`; refresh token is only in the cookie. Attach access token as `Authorization: Bearer <accessToken>`. Reset email sending is intentionally stubbed behind `EmailService` until provider integration is configured.

## Phase 4 — Public event and participant registration

Public endpoints (prefix `/api/v1`):

- `GET /events?page=1&limit=10` — published events with pagination and `registrationCurrentlyOpen`.
- `GET /events/:slug` — published event details and active categories.
- `GET /events/:slug/categories` — active categories with required/optional fields.
- `POST /events/:slug/register` — submit a participant registration.
- `GET /registrations/lookup?registrationId=...&email=...` — rate-limited lookup requiring both fields.

Registration POST body example:

```json
{
  "fullName": "Example Participant",
  "email": "participant@example.com",
  "phone": "+2348012345678",
  "categoryId": "000000000000000000000000",
  "department": "Management",
  "enrolledProgramme": "MBA"
}
```

The actual category ID must be copied from the event's category response. Category-specific fields are checked server-side. Registration is permitted only for published events whose registration flag and configured date window allow it. The database unique indexes on event/email and event/matriculation number protect duplicate registrations; registration IDs are generated server-side. Registration status is assigned by the server (PENDING). No QR code or email delivery is implemented in Phase 4.

Lookup requires the registration ID and email together and is rate limited. It returns a limited registration summary only.

Postman: set the API base URL (for example `http://localhost:5000/api/v1`), GET `/events`, open a published event's slug, retrieve its category ID, POST the registration body to `/events/:slug/register`, and then GET `/registrations/lookup` with both query parameters.

## Phase 5 — QR passes and accreditation verification

Each registration now receives an opaque QR token rendered as a PNG data URI. The QR does not contain participant details. The backend stores only the SHA-256 token hash and issuance timestamp. The token is deterministically derived with HMAC-SHA256 using `QR_TOKEN_SECRET`, the participant Mongo ID and `qrIssuedAt`; this allows protected image retrieval without persisting the raw token. Regeneration changes `qrIssuedAt`, invalidating the prior token and hash.

Configure `QR_TOKEN_SECRET` as a randomly generated secret of at least 32 characters. `QR_VERIFY_URL` is optional and may be set to a frontend verification URL; when configured, the QR contains that URL with the token query parameter. Otherwise, it encodes the token itself. The frontend verification page should submit the scanned token to the protected verification API.

### Phase 5 endpoints

- `POST /api/v1/accreditation/verify` — authenticated `SUPER_ADMIN` or `ACCREDITATION_ADMIN`, body `{ "token": "..." }`. Verification does not check in attendees.
- `GET /api/v1/participants/:participantId/qr` — protected PNG retrieval (`image/png` response).
- `POST /api/v1/participants/:participantId/qr/revoke` — revoke active pass.
- `POST /api/v1/participants/:participantId/qr/regenerate` — replace token and return PNG data URI.

Verification outcomes include `VALID`, `NOT_FOUND`, `REVOKED`, `EXPIRED`, `INVALID`, `EVENT_CANCELLED`, `REGISTRATION_NOT_APPROVED`, and `REGISTRATION_CANCELLED`. `VALID` requires APPROVED registration status. PENDING registrations are not accreditation-eligible. No verification route performs attendance check-in.

Registration response now includes `data.qrCode.status` and `data.qrCode.image` (data URI). PNG images are generated at 480 pixels with high error correction. Production systems should use a frontend verification page and consider object storage/CDN for pass assets only if needed; no object storage is required for this phase.

QR management and verification are restricted to `SUPER_ADMIN` and `ACCREDITATION_ADMIN`. Audit entries are written for administrator verification and QR management operations, without recording QR tokens or hashes.


## Phase 6 — Resend email notifications

Email delivery uses the centralized `src/modules/email/email.service.ts` provider wrapper. Registration remains successful when delivery is disabled or provider calls fail; the API includes `email.sent` and a delivery log ID so clients do not assume delivery. Templates include received, approved, rejected, cancelled, event update, and password reset variants, following the supplied UABS invitation/accreditation-pass design. The registration message attaches the participant's existing QR credential as PNG (CID), reconstructed using the Phase 5 HMAC-derived token and issuance time; it does not issue a new credential for email sends.

Set `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`, `FRONTEND_URL`, `EMAIL_ENABLED=true` and `RESEND_WEBHOOK_SECRET`. Sender domain must be verified in Resend. Configure DNS as instructed in Resend domain setup: publish the provider's DKIM TXT records and SPF TXT record (and any return-path MX/TXT records Resend supplies); allow DNS propagation and confirm the domain shows verified before sending. Never copy API secrets into frontend code or source control. In development set EMAIL_ENABLED=false; automated tests suppress provider delivery regardless of settings.

Webhook: POST `/api/v1/webhooks/resend`; configure this endpoint in Resend for sent, delivered, delivery delayed, bounced and complaint events. Resend/Svix signature headers are checked against raw request payload and `RESEND_WEBHOOK_SECRET`; duplicate event IDs are ignored.

Protected resend foundation: POST `/api/v1/participants/:id/resend` requires authenticated SUPER_ADMIN or REGISTRATION_ADMIN and has an hourly rate limit. It uses the participant's existing active QR credential and registration reference. Failed delivery attempts are tracked; manual resend attempts use unique attempt keys. This implementation does not add background scheduling; manual retries are available.

Troubleshooting: verify the sender domain, API key permissions, recipient address, EMAIL_ENABLED, DNS propagation, webhook secret, and provider response. Provider acceptance is SENT, not DELIVERED; only verified delivered webhooks update delivery state to DELIVERED.

## Phase 7 — PDF invitation and accreditation pass

### PDF engine and design
Phase 7 uses **PDFKit** (`pdfkit`) to create A4 PDF documents directly in Node.js. It does not launch Chromium or require a browser. The template is implemented in `src/modules/pdf/pdf.templates/accreditation-pass.template.ts`; it uses vector shapes and selectable text, the existing UABS logo asset, and the participant's existing Phase 5 QR image. It follows the supplied invitation reference with a deep-green masthead, gold divider, reference/issue-date panel, event theme, participant card, schedule/venue and QR panel.

### Personalisation and credentials
The PDF service retrieves the participant, event and participant category from MongoDB. It calls the existing `getCurrentQr()` Phase 5 function, which reconstructs and verifies the existing token from the participant ID and QR issue timestamp; PDF generation never issues or rotates a QR credential. The existing `Invitation` model is reused. One invitation per event/participant is enforced by its unique index; a random reference code and issue date are created once and reused on regeneration.

### Endpoints
- `GET /api/v1/participants/:participantId/accreditation-pass` — administrator-only; requires `SUPER_ADMIN`, `ACCREDITATION_ADMIN` or `REGISTRATION_ADMIN`.
- `POST /api/v1/registrations/:registrationId/accreditation-pass` — participant-facing download; requires the registration ID in the URL and matching registered email in the JSON body. Rate limited; responses are private and `no-store`.

The public-facing email + registration ID check is a basic verification layer, not a high-assurance identity proof. For deployments requiring stronger protection, issue a short-lived, single-use document access token through a verified email link or authenticated participant account.

### Registration email attachment
On registration, the service attempts to create/retrieve the invitation reference and generate the PDF, then attaches it as `UABS-Accreditation-[RegistrationID].pdf` through the existing centralized Phase 6 email service. PDF generation is best-effort: a PDF or email failure does not delete the participant or invalidate their QR. The existing registration ID, invitation reference and QR credential remain stable. The email delivery record continues to be tracked by Phase 6.

### Branding and customisation
- Replace `src/modules/email/uabs-logo.png` with the approved transparent PNG logo (keep the same filename, or update the logo path in `src/modules/pdf/pdf.service.ts`).
- Edit the `GREEN`, `DARK_GREEN`, `GOLD`, `CHARCOAL` and `MUTED` constants in `accreditation-pass.template.ts` to change colours.
- PDFKit built-in Helvetica fonts are used by default. To use custom fonts, add licensed `.ttf` files to a private assets directory and register them with `doc.registerFont()` in the template before drawing text.
- Adjust A4 margins in the `PDFDocument` constructor and the drawing positions/sizes in the same template file.

### Storage
PDFs are generated on demand and returned as buffers; no binary documents are stored in MongoDB and no public storage URL is created. For larger deployments, store PDFs in a private object-storage bucket and issue short-lived signed download URLs only after authorization.



## Phase 8 — Admin Participant Management

Administrative participant endpoints are mounted under `/api/v1/admin` and require bearer authentication.

- `GET /admin/events/:eventId/participants` — paginated listing, search and filters.
- `GET /admin/events/:eventId/participants/statistics` — event-specific statistics.
- `GET /admin/events/:eventId/participants/export` — filtered CSV export (SUPER_ADMIN/REGISTRATION_ADMIN).
- `GET /admin/participants/:participantId` — participant detail.
- `PATCH /admin/participants/:participantId` — edit permitted participant fields.
- `PATCH /admin/participants/:participantId/approve` — approve pending registration.
- `PATCH /admin/participants/:participantId/reject` — reject with reason.
- `PATCH /admin/participants/:participantId/cancel` — cancel registration.
- `POST /admin/participants/:participantId/resend-email` — resend registration email.
- `POST /admin/participants/:participantId/resend-accreditation-pass` — resend PDF pass.
- `POST /admin/participants/:participantId/revoke-qr` — revoke credential.
- `POST /admin/participants/:participantId/regenerate-qr` — issue replacement QR.

Roles: SUPER_ADMIN and REGISTRATION_ADMIN manage registrations; ACCREDITATION_ADMIN and VIEWER are read-only on listing/details/statistics. CSV export and QR management are restricted. Sensitive QR token hashes are never included in list/detail payloads. CSV values are escaped against formula injection. Activity logs record management and export actions. Resend is rate limited.

List filters: page, limit, search, category, registrationStatus, qrStatus, email, matriculationNumber, department, programme, startDate, endDate, sortBy, sortOrder.

Approval only accepts PENDING. Rejection requires a reason. Rejection/cancellation status is respected by QR verification. Email delivery is best-effort and does not reverse status changes.

## Phase 9 — Accreditation and Attendance Check-in

Camera capture/QR decoding belongs in the frontend. Authenticated backend endpoints:

- `POST /api/v1/accreditation/scan` — validate a token without checking in.
- `POST /api/v1/accreditation/check-in` — re-verify token and atomically check in.
- `GET /api/v1/admin/events/:eventId/attendance` — paginated attendance listing (`page`, `limit`, `search`, `category`, `gate`, `startDate`, `endDate`, `checkInStatus`, `sortOrder`).
- `GET /api/v1/admin/events/:eventId/attendance/statistics` — approved, checked in, remaining, percentage, category/gate breakdown, today and last-hour counts.
- `GET /api/v1/admin/participants/:participantId/attendance` — attendance status/details.
- `PATCH /api/v1/admin/participants/:participantId/attendance/reverse` — SUPER_ADMIN-only reversal, requiring `{ "reason": "..." }`.

Scan and check-in/reversal require bearer authentication. SUPER_ADMIN and ACCREDITATION_ADMIN can scan/check-in; SUPER_ADMIN, ACCREDITATION_ADMIN and VIEWER are allowed read access to attendance views. Only SUPER_ADMIN can reverse. Registration administrators have no access by default.

Frontend workflow: capture/decode QR token with camera; POST `{token,eventId,gate?,deviceId?}` to scan; show verification outcome; ask officer to confirm; POST the same payload to check-in; show final result. The backend never accepts client-supplied participant/admin IDs or timestamps. QR token values are not logged. Scan endpoints are rate limited.

The existing Attendance compound unique index on `eventId + participantId` is retained. Check-in uses an atomic conditional upsert; duplicate-key races resolve to the existing check-in. Reversal retains the attendance record, clears the active check-in fields, and records reversal metadata/history so the participant can check in again. No accreditation window is configured in this phase; the default is to allow check-in at any time for an approved participant and non-cancelled event.

Postman: set Bearer token from the existing admin login; scan with JSON `{ "token": "<QR token>", "eventId": "<event Mongo ID>", "gate": "Gate A", "deviceId": "Tablet-01" }`; then send the same body to check-in. A repeat check-in returns HTTP 409 and `ALREADY_CHECKED_IN`. For reversal, use the participant ID and JSON `{ "reason": "Duplicate entry recorded in error" }` as a SUPER_ADMIN.
