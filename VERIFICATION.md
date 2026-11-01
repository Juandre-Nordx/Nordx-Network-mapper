# Validation record

Validated locally on 2026-10-31. No Railway project or service has been accessed or deployed.

- `npm ci` / frozen npm lockfile installation: passed, including production-only installation inside Docker.
- `npm run build`: JavaScript syntax checks passed. The application serves browser assets directly.
- `npm test`: 2 tests passed; no skipped tests. The first exercises the complete authenticated planning workflow using embedded PostgreSQL: clients, sites, templates, diagram saving/reopening, equipment, PNG upload, PDF bytes, role restrictions, client assignment/revocation, persistence across application instances, and logout. The second verifies secret validation, production cookie attributes, and unhealthy database responses.
- Server-backed integration workflow: passed against a dedicated PostgreSQL 17 database, including saved background references and repeatable schema creation.
- `npm run migrate`: passed against the local PostgreSQL development database, including a repeat run.
- Chromium: login, client/site/plan navigation, device creation, save/reopen, multipart upload, and saved background selection passed. Desktop and mobile screenshots inspected. Development-only HTTPS redirect issue diagnosed and fixed; production retains HTTPS upgrade policy.
- Docker image: built successfully, production health returned HTTP 200 with `{"status":"ok"}`, login page returned 200, UID/GID 1000 confirmed, and persistent-volume write check passed.
- Production npm dependency audit: zero reported vulnerabilities at validation time.

The database and upload data used in tests are synthetic. No production credentials or default administrator account are installed. The development application database is separate from all test databases.

Still required: authenticated Railway deployment, public HTTPS/domain checks, actual production PostgreSQL migrations, initial administrator creation, production role/feature checks, upload survival across a real Railway redeployment, and tested backup/restore procedures. Browser checks are local smoke checks and do not establish production readiness. See README.md for missing functionality and scaling/security limits.

## Database startup fix — 2026-11-01

- Four tests passed with `STARTUP_TEST_DATABASE_URL` pointing to local PostgreSQL 17; zero skipped or failed tests.
- The new real-process test starts the actual server against a unique empty schema. It verifies that migrations complete before listening, `/login` writes to the PostgreSQL sessions table, authenticated sessions and existing clients survive restart, and startup recreates a missing sessions table without removing client records.
- Health returns 503 when PostgreSQL is connected but required tables are missing. Health returns 200 after startup repairs the schema.
- `npm run build` and `git diff --check` passed.
- Railway deployment remains unverified. Deploy this fix or run `npm run migrate` inside the web service against its existing database, then restart it. No database reset is necessary.

## Super-admin management — 2026-11-01

- Six tests passed, zero skipped/failed, with the real PostgreSQL startup test enabled.
- Verified super-admin account editing, password replacement, role changes, disable/re-enable behavior, and immediate session revocation. Administrator/technician attempts to manage accounts or escalate to super-admin are denied. Self-editing through the management endpoint is denied.
- Verified the schema upgrade preserves legacy users and password hashes and adds account status/session-version defaults.
- Verified the stdin-based `create-super-admin` command promotes an existing account and hashes its new password against PostgreSQL.
- Syntax validation and diff whitespace checks passed. No production account has been created from this environment; the deployment operator must run the secure creation command in the Railway web service.

## Connection port labels — 2026-11-01

- Six automated tests passed with the PostgreSQL startup workflow enabled. Diagram API coverage verifies master/slave port persistence, rejection of overlong or incomplete port pairs, and support for legacy connections without port metadata.
- Chromium against a private PostgreSQL schema verified the master/slave dialog, cancellation without mutation, canvas labels, saving/reopening, editing an existing link, and rejecting duplicate endpoint/port pairs. The exported PDF was downloaded and checked with `pdftotext`; both master and slave device names and ports appeared in the connection schedule.
- Syntax checks and diff whitespace checks passed. Existing diagrams and the database schema are preserved. Railway deployment has not been performed from this environment.

## Mobile canvas panning — 2026-11-01

- Mobile Chromium with a 390 × 844 touch viewport: real CDP touch swipes moved the canvas view, Reset view restored its starting position, Pan canvas allowed swiping from a device without moving that device, and normal device dragging remained available with pan mode off.
- Saved coordinates were checked in PostgreSQL after panning and remained unchanged. Existing desktop connection-port creation, editing, persistence, duplicate prevention, and PDF download also passed in the browser.
- JavaScript syntax and whitespace checks passed. This validates emulated touch interaction; physical iPhone/Android testing and Railway deployment remain outstanding.

## Railway proxy and upload storage — 2026-11-01

- Nine tests passed, including Railway production-mode detection with `NODE_ENV=development`, bounded proxy-hop configuration, per-forwarded-IP login rate limits, secure cookies, persistent-path validation, and startup write-probe success/failure.
- Container validation used a new volume deliberately owned by root with mode 0700. Startup prepared its upload directory and dropped the application process to UID/GID 1000. HTTPS-forwarded login, PNG upload, authenticated download, and file/session persistence after container restart all passed against PostgreSQL. No `EACCES` or unexpected forwarded-header validation error was produced by the application.
- Local image build used an uncommitted proxy-CA adapter for this environment. The committed Dockerfile retains plain `npm ci` for Railway compatibility. The short root initialization only adjusts the target directory owner, not existing files or permissions; HTTP/database work runs after privilege drop.
- Railway variable changes and deployment are still required. Preserve the existing volume, set production variables, align `UPLOAD_DIR` with `/var/uploads`, and deploy this branch. No production files or database data were modified during local validation.

## Device resizing and VoIP — 2026-11-01

- Nine automated tests passed, including persisted node width/height and VoIP type, rejection of out-of-range sizes, legacy nodes without dimensions, and the existing account/storage/PostgreSQL workflows.
- Chromium against a private PostgreSQL schema verified adding a VoIP phone, numeric dimension changes, mouse corner resizing, saved size restoration, touch corner resizing, and numeric mobile controls. Existing port editing, mobile panning, device dragging, and coordinate preservation checks also passed.
- PDF export succeeded and `pdftotext` confirmed the VoIP phone label and existing port schedule. PDF rectangles use the saved device dimensions.
- Syntax and whitespace checks passed. No database migration is needed; Railway deployment and physical-device testing remain outstanding.

## Named cabinet groups — 2026-11-01

- Nine automated tests passed. Diagram coverage verifies group and membership persistence and rejects dangling memberships, duplicate group IDs, and blank names. Existing legacy diagrams, dimensions, ports, accounts, storage, and PostgreSQL startup workflows remain covered.
- Desktop/mobile Chromium against PostgreSQL verified creation, batch assignment, renaming, per-device ungrouping, reassignment from another group, deletion without loss of devices/connections, and saved/reopened group outlines. Mouse and touch header dragging preserved member offsets.
- PDF download succeeded; `pdftotext` confirmed the cabinet name, its device list, and the existing connection port schedule. JavaScript syntax and whitespace checks passed.
- Railway deployment and physical-device validation remain outstanding. No database migration is needed for this feature.
