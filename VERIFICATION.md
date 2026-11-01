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

## Production diagnostics — 2026-11-01

Seven tests passed with the real PostgreSQL startup test enabled. Verified generated request IDs, correlated server error logs, safe browser references, release identifiers, unhealthy-schema logs, and exclusion of query strings and session cookies from structured request records. Production error responses do not expose database error text. Schema readiness now validates user status/session-version columns. Production failure remains unconfirmed pending the deployed health/login responses or runtime error details.

A follow-up PostgreSQL process test also verified that a promoted super-admin can sign in and render both the dashboard (with an existing client) and Team page successfully. This did not reproduce the reported production error; the production health and login pages were reported working by the user.
