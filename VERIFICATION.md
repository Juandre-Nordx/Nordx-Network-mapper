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
