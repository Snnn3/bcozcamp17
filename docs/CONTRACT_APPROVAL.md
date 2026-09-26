# Sprint 0 Contract Approval Record

## Decision

The Sprint 1–2 API, database, and test contracts are approved for implementation
against the `v1` documents in this repository. This approval covers the
synthetic development baseline; production launch gates that require organizer
decisions or measured infrastructure evidence remain open.

## Approved alignment

- API errors use the strict `{ error: { code, message, requestId, fieldErrors? } }`
  envelope. Dependency failures use `DEPENDENCY_UNAVAILABLE` and never expose
  SQL, Prisma, storage, provider, or stack details.
- `Idempotency-Key` is 16–128 printable ASCII characters. Unknown request keys
  are rejected by the shared schemas.
- Shared status unions cover application, document, document-review, upload
  intent, role, camp, and user values used by the API and Prisma schema.
- Browser origins are exact scheme/host/port origins. Paths, queries,
  fragments, credentials, protocol-relative values, and alternate ports are
  rejected; production origins must use HTTPS.
- Google login initiation and callback have independent baseline limits of 10
  and 20 requests per minute per client IP. A limit response is `429` with a
  safe error, request ID, and `Retry-After`; production requires a shared or
  otherwise coordinated limiter.
- Upload intent URLs use the API contract’s ten-minute lifetime. Download URLs
  remain one minute. Production storage configuration explicitly disables
  path-style addressing.
- Applicant projections exclude internal notes and storage keys. Local
  sessions and browser-bound OAuth transactions are application-owned Prisma
  tables; Google provider tokens are not persisted.
- `document_review_history.status` uses the dedicated Prisma
  `DocumentReviewStatus` enum and its migration casts existing text values
  without dropping review history.

## Evidence locations

- API and shared schema implementation: `packages/api`, `packages/validation`,
  and `tests/api/contract.spec.ts`.
- Configuration and storage contract tests: `tests/config/environment.spec.ts`
  and `tests/storage/storage.spec.ts`.
- Authentication safety and rate-limit tests: `tests/server/auth.spec.ts`.
- Database alignment: `packages/db/prisma/schema.prisma`,
  `packages/db/prisma/migrations/20260926130108_issue8_contract_alignment/`,
  `docs/CAMP_DATABASE_SCHEMA.md`, and `docs/DBDIAGRAM_SCHEMA.dbml`.
- Required behavior coverage and unresolved production gates:
  `docs/TEST_SPEC.md` section 12.

## Explicitly deferred

This record does not approve implementation of application/document HTTP
handlers, a production distributed rate-limiter adapter, a production storage
provider, or organizer-specific policy values. Those remain in their issue and
production-readiness scopes.
