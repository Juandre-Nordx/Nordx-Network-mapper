# Nordx Network Mapper

Professional network and CCTV planning, mapping, and documentation.

New application built with Node.js 24, Express 5, EJS, and PostgreSQL. There is no PHP/Laravel or Vite build: browser assets are served directly. PostgreSQL is required in production and development. No default users or passwords are installed.

## Local development

1. Install Node.js 24 and provide a PostgreSQL database (PostgreSQL 16 or newer recommended).
2. Run `npm ci` in the repository root.
3. Copy `.env.example` to `.env`. Set `DATABASE_URL`, generate a random `SESSION_SECRET` using the command in that file, and set `UPLOAD_DIR` to a writable directory.
4. Run `npm run migrate`. Migrations are additive, transactional, serialized with a PostgreSQL advisory lock, and safe to repeat. Back up production data before any future schema changes.
5. Create the first super administrator without putting the password in shell history:

   ```bash
   read -r -s -p 'New administrator password (12+ characters): ' admin_password
   printf '\n'
   printf '%s' "$admin_password" | npm run create-super-admin -- owner@example.com "Super Administrator"
   unset admin_password
   ```

6. Run `npm run dev`. For local readiness, request `/health` and confirm `{"status":"ok"}`. Sign in at `/login`.
7. Run `npm test` and `npm run build`. The build command validates JavaScript syntax; there is no asset compilation. Tests use embedded PostgreSQL (PGlite) by default; set `TEST_DATABASE_URL` to a **dedicated empty test database** to test against a PostgreSQL server. Tests create sample records and must never target production. To run the real-process startup regression, set `STARTUP_TEST_DATABASE_URL` to a development PostgreSQL database and run `npm test`. It creates and removes a unique private schema, exercises real PostgreSQL sessions across process restarts, and tests recovery from a missing sessions table. The database user needs permission to create schemas. Without this variable, that server-backed test is explicitly skipped.

## Features

- Super-administrator, administrator, and technician roles; super-admins manage other accounts, reset passwords, change roles, and disable/re-enable access.
- Clients and sites, with explicit technician assignments per client.
- Network and CCTV plans with blank, office, and CCTV templates.
- Drag devices, connect nodes with master/slave port labels, delete selected devices, save and reopen diagrams.
- Site equipment inventories.
- Private PNG/JPEG uploads with a 10 MB limit and file-signature checks.
- Floor-plan image backgrounds saved with the plan.
- PDF exports of saved topology and labels, restricted to authorized users.
- PostgreSQL-backed sessions, CSRF tokens, rate-limited login, secure production cookies, Helmet headers, parameterized SQL, and non-root container runtime.

Technicians may read and edit all sites, plans, equipment, and uploads for assigned clients. Administrators and super-admins may create clients and users and assign client access. Only super-admins may edit other accounts, reset their passwords, disable/re-enable access, or create another super-admin. There is no public registration.

## Railway deployment

Deployment requires authenticated Railway access and access to this GitHub repository. Do not create duplicate services: check the existing project first.

1. Push the repository to GitHub. In Railway, create or select **Nordx Network Mapper**, add or reuse a PostgreSQL service, and add the application service from this repository. Railway uses `Dockerfile` and `railway.json`.
2. Set application variables:

   | Name | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (replace `Postgres` with the actual database service name) |
   | `SESSION_SECRET` | Generate 48 random bytes locally; store securely in Railway variables |
   | `APP_URL` | Actual HTTPS domain assigned to this service |
   | `UPLOAD_DIR` | `/data/uploads` |

   Railway supplies `PORT`; the server binds to `0.0.0.0`. Preserve database URL TLS settings and use verified certificates if connecting through TLS. No credentials belong in source control.
3. Add a persistent volume mounted at `/data`. Confirm it is writable by UID/GID 1000 (the container's `node` user). The image runs as a non-root user; a root-owned volume may need its ownership prepared through Railway's supported volume controls before startup. Do not store permanent uploads on the ephemeral filesystem.
4. Generate the public domain under Networking, set `APP_URL` to its HTTPS address, then deploy. `npm start` runs the additive, transactional migrations against the web service's own `DATABASE_URL` before opening the HTTP listener. A PostgreSQL advisory lock serializes concurrent startup migrations. The server exits if migration or schema validation fails, and `/health` checks that all required tables, including `sessions`, exist. A separate pre-deploy command is not required. No records are deleted or seeded during startup.
5. Run the one-time administrator command above **inside the deployed service** using Railway's service shell/SSH facilities; do not use `railway run` for a private database unless the local machine has access to that private network. No automatic seeding runs.
6. Verify `/health` returns HTTP 200 and sign in. Exercise the checklist below before declaring production ready.

For an already linked service, subsequent CLI deployments are `railway status`, `railway up`, and `railway logs`. Install the official Railway CLI and authenticate with `railway login` first if needed; select the correct project, environment, and service. The repository must already be linked using `railway link`. Do not publish or deploy an unrelated service.

### Required deployment checks

- Administrator login/logout and team creation.
- Technician denied unassigned clients, plans, files, and exports; allowed after assignment.
- Client and site creation; create both plan types and select templates.
- Add and connect devices, save, reload, and confirm saved positions and connections.
- Add equipment; verify persistence.
- Upload a real PNG/JPEG and use it as a CCTV background.
- Download a PDF and inspect labels/connections.
- Restart/redeploy the application; verify records, sessions, and uploaded files survive.
- Inspect deployment logs; verify HTTPS, cookie flags, and health responses.
- Configure and test PostgreSQL backups and volume backups before storing critical data.

## Current limits

This is an initial implementation, not a fully audited production release. There is no self-service password reset/change UI, MFA, audit trail, record deletion/editing UI, custom template management, undo/redo, device-to-inventory linking, or multi-user edit conflict detection (last saved diagram wins). PDF exports contain the saved topology, not floor-plan images or an inventory report. Uploads have file signature checks but no image re-encoding or malware scanning; only trusted technicians should receive upload access. PDF generation is synchronous and diagrams are limited to 300 nodes/600 edges. No queues, scheduled tasks, or workers are needed for this version. Login rate limits use process memory; run one web replica until a shared limiter is implemented. A Railway volume also constrains scaling; use object storage before scaling beyond one replica.

## Operations

Logs go to stdout/stderr without logging request bodies or secrets. `/health` checks database connectivity. Shutdown handles SIGTERM/SIGINT. Back up PostgreSQL **and** `/data/uploads` together: metadata is in PostgreSQL, image bytes are on the volume. Treat session secrets as credentials; rotating them signs out current sessions. Keep Node/container and npm dependencies updated. Never run tests against the production database.

### Recovering a missing sessions table

If logs report `relation "sessions" does not exist`, the database selected by the running web service has not received the schema. Deploy the startup initialization fix and keep the start command as `npm start`; startup will create the missing tables safely before accepting requests. Alternatively, run `npm run migrate` inside that Railway web service, using its existing `DATABASE_URL`, then restart it. Do not drop the database or regenerate the session secret. Verify the logs show `Database schema ready.` followed by the listening message, and request `/health` before signing in. If creation fails, check that the selected PostgreSQL user has schema/table creation permission and that the service points to the intended database.

## Super-admin account management

The `superadmin` role can access all clients and sites and manage every other user in **Team**: name, email, role, active status, and password. Account updates immediately revoke existing sessions; re-enabling a user does not revive old sessions. Passwords are hashed and cannot be viewed. Disabling preserves records and assignments. Self-demotion and self-disable are blocked. Account changes are serialized and recheck the actor's active super-admin status to avoid concurrent lockouts.

After deploying this version, open a shell **inside the Railway web service** and run:

```bash
read -r -s -p 'Super-admin password (12–128 characters): ' owner_password
printf '\n'
printf '%s' "$owner_password" | npm run create-super-admin -- your-email@example.com "Your name"
unset owner_password
```

Use your actual email and name. This command creates the account or promotes the matching existing email, replaces its password, enables it, and revokes its previous sessions. It applies the safe schema migration first. Use the web service's existing `DATABASE_URL`; do not paste production credentials or passwords into chat. Sign in with that email and password, then open **Team**. No built-in super-admin password is created. Ordinary administrators retain account-creation access for administrators and technicians; they cannot modify existing users or grant super-admin privileges.

## Connection ports

Click **Connect devices**, select the master device first and the slave device second. Enter both port names (for example, master `Gi0/1` and slave `ether2`), then click **Apply connection** and **Save diagram**. Labels appear beside the connection as **M** (master) and **S** (slave). Click an existing connection, or focus it and press Enter, to edit its ports. Cancelling adds no connection. An identical connection/port pair is rejected. Port names accept up to 64 characters. Existing diagrams without port labels remain valid; edit a connection to add its ports. PDF exports include a separate connection-port schedule. Port metadata uses the existing diagram JSONB, so no database migration is required for this feature.
