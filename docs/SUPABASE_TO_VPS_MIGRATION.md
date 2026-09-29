# Supabase-to-VPS Migration Plan

## Purpose

This document describes how to move the production application from the initial Supabase Free setup to a VPS without moving the frontend or uploaded documents unnecessarily.

**Repository readiness:** this repository now defines and tests the temporary
Fastify identity-verification boundary, but it still does not contain a
deployable Supabase project, Edge Functions, application business routes, or a
trusted Supabase-to-app-user provisioning workflow. The identity-check route
does not itself protect business operations. Backup/restore automation and a
200-user load scenario also remain release gates; this runbook is not evidence
that a live migration or restore has succeeded.

> **Specification alignment:** `docs/PROJECT_SPEC.md`, `docs/API_SPEC.md`, and the database contracts now define the temporary Supabase-first architecture and the later Fastify/session target. This runbook describes operational sequencing; the normative contracts remain authoritative for product behavior, API shape, identity mapping, and persistence.

### Starting architecture

- **Frontend:** responsive web application on Cloudflare Pages.
- **Authentication:** Supabase Auth with Google as the sign-in provider.
- **API:** Supabase Edge Functions.
- **Database:** Supabase-managed PostgreSQL.
- **Documents:** private Cloudflare R2 bucket, accessed through short-lived signed URLs.
- **Database backups:** scheduled, encrypted database exports stored separately in R2.
- **API boundary:** Supabase Edge Functions only. Browser clients do not call PostgREST/Data APIs for application tables; enforce server-side permissions and default-deny database access.

### Target architecture

- **Frontend:** remains on Cloudflare Pages.
- **Authentication:** Google OpenID Connect with server-managed sessions in the Fastify API.
- **API:** Fastify on the VPS.
- **Database:** PostgreSQL on the VPS.
- **Documents:** remain in the same private R2 bucket. Only the code that authorizes and signs uploads/downloads moves to Fastify.

The current VPS candidate is a DigitalOcean Singapore Droplet with 2 GB RAM. Treat that as a starting size, not a capacity guarantee; verify it against the 200-concurrent-user target in `docs/PROJECT_SPEC.md` section 15 and resize if the measured results require it.

## When to Prepare and When to Migrate

Do not decide from registered-user count alone. Review actual database growth, resource use, errors, and load-test results.

Begin preparing the migration when any of these are true:

1. **Database size reaches about 350 MB.** This is an early-warning threshold chosen for this project, not a Supabase limit. Plan the cutover before the Free Plan's 500 MB database quota, which can put the database into read-only mode. Track the growth rate and bring the cutover forward if the forecast reaches the quota before the next event or release. See [Supabase database size limits](https://supabase.com/docs/guides/platform/database-size).
2. **The 200-concurrent-user acceptance test fails.** Use the workload and acceptance criteria in `docs/PROJECT_SPEC.md` section 15. First inspect slow queries, indexes, connection usage, and application behavior; migrate when the workload still fails after reasonable optimization.
3. **The service shows sustained resource pressure or user-visible failures.** Look for repeated timeouts, elevated 5xx responses, connection exhaustion, or CPU, memory, and I/O pressure during representative peak traffic. Supabase Reports exposes database, API, Auth, Storage, and Realtime metrics: [Supabase Reports](https://supabase.com/docs/guides/observability/reports).
4. **A Free Plan availability condition conflicts with the launch schedule.** Free projects with low database activity over a seven-day period may be paused. This matters for seasonal applications and must be considered in the availability plan: [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
5. **A plan quota or operational requirement is approaching.** Compare current database, egress, function, and other usage with the current Free Plan limits before a major event.

The Free Plan's 200 concurrent-connection limit applies to Supabase Realtime WebSocket connections. It is not a general limit of 200 people using normal HTTP pages or API requests. If the application does not use Realtime, assess normal web traffic using the section 15 load test instead: [Supabase Realtime limits](https://supabase.com/docs/guides/realtime/limits).

Growth in document volume alone is not a reason to move the database. Documents remain in R2, independently of the database migration.

## Portability Requirements Before Launch

Keep these boundaries in place from the first release so the later migration has a clear path:

- Route sensitive reads and writes through an API boundary. Avoid putting business rules only in browser code or relying on the frontend to enforce access.
- Keep the application-owned `users.id` as the permanent application user ID and `users.google_subject` as the immutable Google identity. During the Supabase-first phase, maintain a separate, unique mapping from each Supabase Auth user ID to the application user ID. Populate that mapping and `google_subject` server-side from the verified Supabase identity; never accept either value from the browser. Fastify must resolve the verified Supabase token subject through this mapping during the first cutover. Do not key application records directly to a Supabase Auth user ID or use email as the permanent identity key; Google's `sub` is stable while email may change. See [Google OpenID Connect claims](https://developers.google.com/identity/openid-connect/reference), [Supabase identities](https://supabase.com/docs/guides/auth/identities), and `docs/CAMP_DATABASE_SCHEMA.md` section 6.
- Store R2 object keys and file metadata in the database, not long-lived signed URLs. Keep the R2 bucket private and issue scoped, short-lived signed URLs from the backend.
- Keep database schema changes in versioned migrations. Document which policies, functions, triggers, and constraints are required by the application.
- Keep a scheduled database export and periodically verify that it can be restored. A backup that has not been restored in a test is not sufficient migration evidence.

### Supabase token-signing prerequisite

Set `AUTH_PHASE=supabase` while Supabase Auth remains the identity provider and
the temporary Fastify bridge is enabled. Set `AUTH_PHASE=fastify` only after the
final Fastify OIDC cutover. The server registers Google login routes only in the
`fastify` phase; the Supabase bridge phase exposes the bearer identity route and
does not expose `/auth/google/start` or `/auth/google/callback`.

The temporary Fastify bridge in this repository accepts **RS256 asymmetric
signing keys only**. It obtains the project's public keys from
`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`, then verifies the exact issuer
`<SUPABASE_URL>/auth/v1`, audience `authenticated`, role `authenticated`,
expiry, UUID subject, and signature. It rejects legacy HS256 tokens, service
role tokens, unknown signing algorithms, and unmapped users. Before the first
API/database cutover, configure the Supabase project to sign access tokens with
an RS256 asymmetric key and confirm new test tokens use that key. Tokens issued
under a legacy HMAC key are not discoverable through JWKS; do not enable the
bridge until the project is on the supported signing mode and old tokens have
expired or users have signed in again. Never configure a Supabase service-role
key in the browser or use one as a user's bearer token.

## Recommended Migration: Two Cutovers

Separating the API/database move from the authentication move reduces the number of changes made at once. During the first cutover, Supabase Auth remains in use temporarily; the final cutover removes that dependency.

### Phase 0: Prepare the destination

1. Provision the VPS, install and secure PostgreSQL, deploy Fastify behind HTTPS, and configure firewall rules, secrets, logging, and monitoring.
2. Deploy the application schema from the project's versioned Prisma migrations. For a plain PostgreSQL + Fastify target, do not blindly restore Supabase-managed `auth`, `storage`, or other platform schemas.
3. Port each required Edge Function to a Fastify route. Move authorization and business rules into the server's policy and service layers, and preserve the relevant database constraints and transaction behavior.
4. Implement R2 signing in the Fastify API. Keep the same bucket and object-key convention so existing documents remain reachable.
5. Temporarily keep Supabase Auth as the identity provider. Set `SUPABASE_URL` on Fastify, enable the RS256 JWKS verifier, and resolve verified token subjects to application-owned user IDs through the mapping described above. Do not trust unverified client-supplied user IDs, roles, or editable user metadata. The verifier is not compatible with legacy HS256 projects.

### Phase 1: Dry-run the database and API migration

1. Export a recent Supabase database copy and restore the **application schema and data** to a non-production VPS database.
2. Adapt Supabase-specific SQL, extensions, RLS assumptions, functions, and roles to the target PostgreSQL and Fastify authorization model.
3. Compare row counts and key relationships; verify application history, permissions, and R2 object keys.
4. Test Participant and Staff flows, including ownership denials, private-field exclusion, upload recovery, and authorized document downloads.
5. Run the section 15 load test against the VPS candidate. Resize or optimize before production cutover if it does not pass.
6. Restore a backup into a separate test database and record the result.

Supabase's platform restore guide targets a self-hosted Supabase instance. It notes that Edge Functions and Storage objects need separate handling. A plain Fastify + PostgreSQL VPS is a different target, so use the guide as a reference for export/restore constraints, not as a one-click migration procedure: [Restore a Supabase platform project](https://supabase.com/docs/guides/self-hosting/restore-from-platform).

### Phase 2: Cut over the API and database

1. Announce a short maintenance window and temporarily disable application writes.
2. Create a final export from Supabase and restore it to the production VPS database.
3. Verify row counts, required constraints, user-to-application mappings, permissions, and file references before accepting writes.
4. Point the Cloudflare Pages application to the Fastify API on the VPS, configure its temporary Supabase bearer-token mode, and keep Google sign-in routed through Supabase Auth for this transition.
5. Run smoke checks for sign-in, application submission, staff review, and private R2 uploads/downloads. Re-enable writes only after the checks pass.
6. Keep the old Supabase database unchanged and read-only for an agreed rollback period. Before the VPS accepts new writes, rollback can point traffic back to Supabase. After the VPS accepts writes, rollback also requires a plan to preserve or replay those new writes; changing DNS alone would lose them.

### Phase 3: Move Google sign-in off Supabase Auth

Supabase Auth owns the Google login flow and provider login limits before this
phase. Only after this cutover are Fastify's `/auth/google/start` and
`/auth/google/callback` endpoints enabled; configure their shared application
rate limiter across API instances as specified in `docs/API_SPEC.md` section 3.

1. Configure Google OpenID Connect for the Fastify application and add the VPS callback URL to the Google OAuth client.
2. At sign-in, validate Google's OIDC response and map the Google `sub` to the existing `users.id`. Use the identity mapping and `users.google_subject` prepared before launch, never email matching alone. Follow the existing account-collision rule; do not automatically link a different Google identity by matching email.
3. Create a server-managed session in Fastify using secure, HttpOnly cookies. Apply the project's CSRF protection and exact allowed-origin rules.
4. Update the frontend's sign-in and sign-out flow to use the Fastify API. Existing Supabase access tokens will not authenticate to the new session system, so users must sign in again after this cutover.
5. Verify that existing users map to the correct accounts and that authorization still uses current application permissions.
6. After monitoring confirms the new login flow works, remove Supabase Auth configuration and retire the Supabase project when its data is no longer needed for rollback or audit.

## Go/No-Go Checklist

Proceed with the production cutover only when all of the following are true:

- The latest database export has been restored successfully to the target PostgreSQL version.
- Row counts, important relationships, application user mappings, and R2 object references have been verified.
- Fastify accepts only mapped RS256 Supabase Auth users with current local account status and permissions; legacy HS256 and service-role tokens are rejected.
- The Fastify API passes the relevant unit and integration checks, including permission denials and private-data protections.
- The VPS passes the 200-concurrent-user acceptance test in `docs/PROJECT_SPEC.md` section 15.
- Backup creation and restore have both been demonstrated.
- The maintenance window, rollback conditions, and post-cutover monitoring owner are defined.

## References

- [Supabase database size limits](https://supabase.com/docs/guides/platform/database-size)
- [Supabase Free Plan pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase Reports](https://supabase.com/docs/guides/observability/reports)
- [Supabase Realtime limits](https://supabase.com/docs/guides/realtime/limits)
- [Supabase platform restore guide](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
- [Supabase Auth identities](https://supabase.com/docs/guides/auth/identities)
- [Google OpenID Connect reference](https://developers.google.com/identity/openid-connect/reference)
