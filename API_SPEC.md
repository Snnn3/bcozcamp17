# Camp Platform API Specification

## 1. Document Status

- Version: `v1`
- Scope: Sprint 1 and Sprint 2 only
- Transport: HTTPS JSON API
- Base path: `/api/v1`
- Related documents: [PROJECT_SPEC.md](PROJECT_SPEC.md), [CAMP_DATABASE_SCHEMA.md](CAMP_DATABASE_SCHEMA.md)

QR/check-in, missions, evaluation, buddy features, and spin wheel endpoints are intentionally not defined in this version.

---

## 2. API Principles

- The API Server is authoritative for validation, permissions, status transitions, and transactions.
- Participant Web and Staff Web never connect directly to PostgreSQL; object access uses API-authorized short-lived signed URLs only.
- All timestamps are ISO 8601 UTC values.
- All IDs are opaque UUIDs unless a public application code is explicitly returned.
- Applicant-facing responses never include internal Staff notes, raw storage keys, or private implementation details.
- All sensitive endpoints are scoped to the authenticated user, role, and permission for this single camp.
- Collection endpoints are paginated and return stable ordering.

---

## 3. Authentication and Headers

Google login is confirmed for Participant, Staff, and Admin. Use server-side Google OpenID Connect authorization-code flow and a local server-managed session, as specified in PROJECT_SPEC section 19. The auth library and its exact mounted routes are implementation decisions; the domain API must not accept an arbitrary Google token as a substitute for its local session.

Required headers:

```http
Accept: application/json
Content-Type: application/json
Cookie: session=<secure-session-cookie>
```

For direct file upload, the client uses the short-lived URL returned by the API. It must not send permanent storage credentials to the browser.

For submission, upload completion, review, and final decision operations, the client must send:

```http
Idempotency-Key: <unique-request-key>
```

Use idempotency for final submission, upload completion, replacement upload completion, and review actions where retries can cause duplicate writes.

---

## 4. Common Response Shapes

### Success

```json
{
  "data": {},
  "meta": {}
}
```

`meta` is optional and may contain pagination or request information.

### Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "fieldErrors": [
      {
        "field": "email",
        "message": "Enter a valid email address."
      }
    ],
    "requestId": "req_opaque_id"
  }
}
```

The `message` must be safe for the target user. Stack traces, SQL errors, storage keys, and internal notes must not be returned.

---

## 5. Common HTTP Status Codes

| Status | Meaning |
|---:|---|
| 200 | Successful read or update |
| 201 | Resource created |
| 202 | Accepted for asynchronous processing, if used |
| 204 | Successful operation with no response body |
| 400 | Malformed request |
| 401 | Authentication required or session invalid |
| 403 | Authenticated but not permitted |
| 404 | Resource does not exist or is not visible to the caller |
| 409 | Duplicate, invalid state, or stale version conflict |
| 413 | File or request is too large |
| 415 | File type is not allowed |
| 422 | Valid request shape but business validation failed |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error; log with `requestId` |

---

## 6. Public and Participant Endpoints

### 6.1 Get Registration Configuration

```http
GET /api/v1/registration-config
```

Authentication: Public, unless the camp requires an account before viewing the form.

Response:

```json
{
  "data": {
    "name": "Camp 2026",
    "registration": {
      "isOpen": true,
      "opensAt": "2026-01-10T00:00:00Z",
      "closesAt": "2026-02-10T00:00:00Z"
    },
    "fields": [],
    "documentRequirements": [],
    "privacyNotice": {
      "version": "TBA",
      "url": "TBA"
    }
  }
}
```

The server must not return inactive fields or document requirements.

### 6.2 Create or Return Own Application

```http
POST /api/v1/me/applications
```

Authentication: Participant.

Request:

```json
{}
```

Behavior:

- Creates one draft application for the participant.
- If one already exists, returns the existing application rather than creating a duplicate.
- Returns `409` only if the camp policy explicitly disallows the current state.

### 6.3 Update Own Application

```http
PATCH /api/v1/me/applications/{applicationId}
```

Authentication: Participant.

Request:

```json
{
  "answers": [
    {
      "fieldId": "uuid",
      "value": "example value"
    }
  ],
  "expectedVersion": 3,
  "configurationVersion": 1
}
```

Rules:

- Allowed only while the application is editable.
- The server validates supplied field ownership and types; incomplete required values are allowed in drafts and rejected at submission.
- A stale `expectedVersion` returns `409 CONFLICT_STALE_VERSION`.

### 6.4 Create Document Upload Intent

```http
POST /api/v1/me/applications/{applicationId}/documents/{applicationDocumentId}/upload-intent
```

Authentication: Participant.

Request:

```json
{
  "fileName": "transcript.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 245678,
  "expectedDocumentVersion": 1,
  "configurationVersion": 1
}
```

Response:

```json
{
  "data": {
    "uploadId": "uuid",
    "method": "PUT",
    "uploadUrl": "https://storage.example/signed-url",
    "requiredHeaders": {
      "Content-Type": "application/pdf"
    },
    "expiresAt": "2026-01-10T01:00:00Z"
  }
}
```

The server validates file size, declared type, document ownership, replacement rules, and deadline before issuing the intent.

### 6.5 Complete Document Upload

```http
POST /api/v1/me/applications/{applicationId}/documents/{applicationDocumentId}/uploads/{uploadId}/complete
```

Authentication: Participant.

Request:

```json
{
  "checksum": "sha256:opaque-value"
}
```

Behavior:

- Verifies that the private object exists and matches the expected metadata.
- Creates an immutable `document_submissions` version.
- Sets the current document to `pending`.
- Clears the current applicant message while retaining review history.
- A repeated request returns the original completed result.

### 6.6 Submit Own Application

```http
POST /api/v1/me/applications/{applicationId}/submit
```

Authentication: Participant.

Request:

```json
{
  "privacyNoticeVersion": "2026-01",
  "privacyNoticeAcknowledged": true,
  "expectedVersion": 4,
  "configurationVersion": 1
}
```

Rules:

- Registration must be open.
- All required answers and validated required uploads must exist.
- Documents do not need to be approved at submission time.
- The transaction creates the submitted status, history, and application code together.
- A retry returns the existing submitted application.

### 6.7 Get Own Application

```http
GET /api/v1/me/applications/{applicationId}
```

Authentication: Participant.

Applicant-safe response:

```json
{
  "data": {
    "id": "uuid",
    "applicationCode": "APP-2026-000123",
    "status": "action_required",
    "documents": [
      {
        "id": "uuid",
        "documentTypeCode": "transcript",
        "status": "correction_required",
        "latestVersion": 2,
        "applicantMessage": "Please upload all pages.",
        "replacementAllowed": true,
        "correctionDeadline": "2026-02-15T16:59:59Z"
      }
    ]
  }
}
```

Internal notes, reviewer identity when not intended for applicants, storage keys, and unrelated applicants must never appear in this response.

---

## 7. Staff Endpoints

All endpoints in this section require Staff authentication and an explicit permission. Admin may use them only when the permission is granted.

### 7.1 List Applications

```http
GET /api/v1/staff/applications?query=&status=&page=1&pageSize=25
```

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "applicationCode": "APP-2026-000123",
      "participantDisplayName": "Applicant Name",
      "status": "submitted",
      "submittedAt": "2026-01-10T00:30:00Z",
      "documentSummary": {
        "required": 3,
        "uploaded": 3,
        "pending": 3,
        "approved": 0,
        "needsAction": 0
      }
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 1
  }
}
```

### 7.2 Get Application Review Detail

```http
GET /api/v1/staff/applications/{applicationId}
```

The response may include permitted internal notes, review history, document version metadata, and applicant answers. It must remain permission-checked.

### 7.3 Review a Document

```http
POST /api/v1/staff/application-documents/{applicationDocumentId}/reviews
```

Request:

```json
{
  "status": "correction_required",
  "applicantMessage": "The uploaded image is incomplete. Please upload all pages.",
  "internalNote": "Page 2 is missing.",
  "replacementAllowed": true,
  "expectedSubmissionId": "uuid",
  "expectedDocumentVersion": 3,
  "expectedVersion": 5
}
```

Rules:

- `applicantMessage` is required for `rejected` and `correction_required`.
- `internalNote` is optional and Staff-only.
- The referenced submission must still be the newest usable version.
- A stale submission, document revision, or application version returns `409 CONFLICT_STALE_VERSION`, including another review of the same file.
- The service writes current state, review history, audit log, and applicant notification in one transaction.
- The service recalculates the application action state without automatically changing a final application decision.

Response:

```json
{
  "data": {
    "applicationDocumentId": "uuid",
    "submissionId": "uuid",
    "status": "correction_required",
    "replacementAllowed": true,
    "reviewedAt": "2026-01-12T09:00:00Z"
  }
}
```

### 7.4 Get Document Review History

```http
GET /api/v1/staff/application-documents/{applicationDocumentId}/history
```

Returns document versions and review decisions allowed by the Staff permission. Do not return raw document contents in the history response.

### 7.5 Change Overall Application Status

```http
POST /api/v1/staff/applications/{applicationId}/status
```

Authentication: Staff/Admin with the explicit final-decision permission.

Request:

```json
{
  "status": "accepted",
  "reason": "All required documents approved.",
  "expectedVersion": 5
}
```

The service validates allowed transitions, required document approval, camp capacity, actor permission, and concurrent updates. The default Sprint 2 permission policy should keep final acceptance/rejection restricted to Admin unless the organizers approve otherwise.

### 7.6 Export Applications

```http
GET /api/v1/staff/applications/export?format=csv
```

Authentication: Staff/Admin with explicit export permission.

Exports must be audited, generated with a bounded scope, and protected from public access.

---

## 8. Error Codes

The initial error code set is:

```text
AUTHENTICATION_REQUIRED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
REGISTRATION_CLOSED
DUPLICATE_APPLICATION
APPLICATION_NOT_EDITABLE
REQUIRED_FIELD_MISSING
REQUIRED_DOCUMENT_MISSING
FILE_TYPE_NOT_ALLOWED
FILE_TOO_LARGE
UPLOAD_NOT_READY
REPLACEMENT_NOT_ALLOWED
CORRECTION_DEADLINE_PASSED
CONFLICT_STALE_VERSION
INVALID_STATUS_TRANSITION
CAPACITY_REACHED
RATE_LIMITED
INTERNAL_ERROR
```

Error codes are stable API contracts. Human-readable messages may be localized.

---

## 9. API Security Requirements

- Require HTTPS outside local development.
- Use secure, HttpOnly, SameSite session cookies where cookie sessions are selected.
- Apply rate limits to login, upload intent, submission, review, and export endpoints.
- Use CSRF protection appropriate to the authentication design.
- Verify participant ownership and role/permission server-side.
- Use short-lived signed storage URLs.
- Never trust a document type, file extension, or MIME type supplied only by the browser.
- Redact sensitive fields in logs and error reports.
- Audit Staff review, status, permission, and export actions.

---

## 10. API Acceptance Checklist

- Participant can create or resume exactly one application for the camp.
- Participant can upload required documents through private storage.
- Final submission is validated and idempotent.
- Participant can read only the applicant-safe view of their own application.
- Staff can list and inspect permitted applications.
- Staff can review a document with a required reason for failed statuses.
- Stale document reviews are rejected safely.
- Replacement upload creates a new version and preserves history.
- Internal notes never appear in participant responses.
- All sensitive actions enforce role and permission checks.

## 11. Normative edge-case contract

Apply PROJECT_SPEC sections 16–18 to every endpoint. Earlier examples are illustrative payloads, not permission or policy overrides. Required optimistic version fields must be positive integers. Unknown body keys are rejected. Timestamps in examples are synthetic, not registration dates.

### Retry and concurrency

- Scope `Idempotency-Key` by authenticated actor, HTTP method, route/resource, and key. Require 16–128 printable ASCII characters. Persist a canonical request hash with the operation result reference atomically with the mutation. A changed body under the same key returns `409 IDEMPOTENCY_KEY_REUSED`.
- Authenticate and authorize before replaying. An authorized committed replay is resolved before deadline, status, or stale-version checks, and returns the original operation receipt without reapplying it. Never replay an old signed URL: issue a fresh authorized URL through the access endpoint. Recheck field visibility so revocation cannot leak formerly permitted notes.
- Concurrent same-key requests serialize; if still running return `409 OPERATION_IN_PROGRESS` with `Retry-After: 1`. A DB rollback does not consume a success receipt. A network timeout is an unknown outcome; the client retries the same key/body and then refreshes the resource.
- Retain success receipts through the camp write period and at least 24 hours after writes close, subject to the approved retention policy. Completed upload IDs and submitted application identity additionally remain naturally idempotent throughout their record lifetime. Requests with a new key and stale versions must conflict.
- Submission of an already submitted application returns its existing ID/code and current status without resetting it, generating another code, or acknowledging a different notice. Authorization still applies. Reopening withdrawn/rejected applications is not supported.
- Every successful application/document mutation returns `version`, and document mutations also return `documentVersion` and `submissionId`. Detail responses expose these versions so the caller can supply expected values. Reviews include application version; upload intents bind document revision; completion increments both revisions atomically and recalculates the latest application state under lock.

### Validation and projections

- PATCH semantics: omitted fields are unchanged; `null` clears a scalar; an empty array clears a choice; reject duplicate field IDs or options. Text is a string, number is finite JSON number, date is a valid `YYYY-MM-DD`, boolean is true/false, single choice is one option UUID or null, multi choice is an array of option UUIDs. Do not coerce strings to numbers/booleans. Normalize Unicode consistently without transliterating names; validate configured bounds.
- PATCH may also include `profile: {fullName, contactEmail, phone}` for draft-only contact fields. Apply its changes and answers in the same application transaction; reject changes after submission. Validate email/phone using the approved field dictionary, not an assumed national format.
- Submission requires `privacyNoticeAcknowledged: true` and the published notice version. The server records its own acknowledgement time. Client timestamps are not evidence. Return `409 CONFIGURATION_CHANGED` for stale notice/configuration and require refresh/re-acknowledgement.
- Public configuration adds `configurationVersion`, `serverTime`, timezone, correction deadline, file limits, and published notice. PATCH, intent, and submit require `configurationVersion`. A valid replay remains valid across a later configuration change.
- Own application detail includes profile, typed answers, `version`, and documents with `documentVersion`, current submission metadata, remaining replacements, effective deadline, `replacementAllowed`, and `replacementBlockedReason`. `replacementAllowed` is the effective policy result, not the stored review flag. Application `canCorrect` is true iff at least one failed document is currently eligible. Client clocks cannot grant permission.
- Review's `replacementAllowed` is a restrictive reviewer flag: it cannot override document-type policy, deadline, count, or final application state. Approval forces it false and clears the current failure message. For failure messages use 1–2000 trimmed characters; internal notes max 4000. Notes require their separate read/write permissions.
- Use explicit allowlist response serializers per audience. Do not serialize ORM objects directly. History and exports never gain note access solely from application-read permission.

### Missing read and document access routes

| Method and path (under `/api/v1`) | Contract |
|---|---|
| `GET /me/applications` | Return `{data: []}` or a one-item applicant-safe array; allows recovery without a remembered application ID |
| `POST /me/applications/{applicationId}/documents/{applicationDocumentId}/submissions/{submissionId}/access` | Own document version only; return a freshly signed download URL and expiry; historical own versions allowed while retained |
| `POST /staff/application-documents/{applicationDocumentId}/submissions/{submissionId}/access` | Require `application_read` and `document_read`; authorize version ownership and audit issuance |

Access endpoints return `{data: {downloadUrl, expiresAt}}` with `Cache-Control: no-store`. Download as attachment with sanitized filename; preview only through a sandboxed viewer appropriate to the type. Default URL lifetime is 60 seconds, configurable downward. Issued URLs can work until expiry despite logout or permission revocation; never claim immediate revocation. Do not log URLs or put them in persistent client storage.

Create draft returns 201 if new, 200 if existing. Create the profile, application, initial history, and one `not_uploaded` document slot per active type in one transaction. Do not expose drafts through Staff lists. Submission returns 200 with ID, code, status, and version.

### Upload state machine

`issued -> validating -> completed | failed | expired`. Validation processing may be retried after a crash using a bounded lease; never create a second submission for one intent. The intent stores owner, document, base revision, declared metadata, configuration revision, expiry, and private staging object identity.

- Intent response additionally returns `documentVersion` and `status`. Default expiry is 10 minutes. The API must cap declared/actual size using the approved per-type limit and enforce staging quotas even if a PUT URL cannot enforce size by itself.
- Completion request may provide a checksum for comparison, but server validation computes the authoritative SHA-256. If verification is asynchronous, return `202` with `{uploadId, status: "validating", retryAfterSeconds: 2}`. Add `GET /me/applications/{applicationId}/documents/{applicationDocumentId}/uploads/{uploadId}` for authorized polling; it returns safe status, failure code, and completed submission/version when ready, never a storage key.
- Completion rechecks owner, account, current policy, intent expiry, deadline, and base document revision after validation. Concurrent upload intents do not reserve correction rights. A stale intent returns 409 and cannot replace the winner.
- A completed intent returns the same submission ID on any retry. Failed/expired intents need a new intent; retryable dependency failure must not change them to completed. An intent in validation is not a required uploaded document and cannot satisfy submission.
- Logical document and application remain unchanged on validation or DB failure. Reconciliation handles promoted but unreferenced files and expired staging uploads after a grace period beyond URL expiry/active processing leases. Actual file bytes are never uploaded to the JSON API.

### List, export, and operational boundaries

- `page` >=1; `pageSize` default 25 and max 100; invalid values return 422. Sort `submittedAt DESC, id DESC`; filter before pagination/count. Empty/out-of-range pages return an empty list. Pagination is not a snapshot during concurrent changes; clients deduplicate IDs or refresh.
- Search is literal, trimmed, max 100 characters; searchable columns are application code and approved name/contact fields. Escape SQL wildcard characters and parameterize queries. Unknown status/filter returns 422. History uses the same bounded page size and `createdAt DESC, id DESC`.
- Export is optional until FR-OPS-004 is approved. If enabled, freeze a consistent bounded snapshot of matching submitted applications, require export plus application-read permission, audit scope/count, use allowlisted columns and CSV quoting, and neutralize formula prefixes including leading whitespace/control characters. Stream as attachment with no-store; on failure report failure and do not present a partial export as complete.
- Configuration and permission management use authenticated operational commands in Sprint 0–2; a separate Admin UI/API is not required. Commands use the same policy/services, version checks, audit, last-admin protection, and validation as HTTP. Never edit production rows manually as the normal management flow.
- Proposed guardrails: JSON bodies <=256 KiB, <=5 active upload intents/user, upload intents <=20/min/user, submit <=10/min/user, review <=60/min/user, export <=2/min/user; configure IP limits separately for shared camp networks. Google-login initiation/callback abuse limits must be configured and tested before launch; there is no local OTP endpoint. Return `Retry-After` on 429; no quota counter can bypass ownership checks.
- Sensitive endpoints return no-store; exact allowed origins only, credentialed CORS tested on real domains, CSRF defense on all cookie-authenticated mutations. Private endpoints return 401 if unauthenticated, 404 for hidden records, 403 for missing capability on otherwise visible scope.

### Additional stable errors

| HTTP | Code | Meaning |
|---|---|---|
| 409 | `IDEMPOTENCY_KEY_REUSED`, `OPERATION_IN_PROGRESS` | Retry key conflict or request still processing |
| 409 | `CONFIGURATION_CHANGED`, `UPLOAD_EXPIRED` | Refresh policy or request a new upload intent |
| 422 | `FILE_INVALID`, `REPLACEMENT_LIMIT_REACHED` | Unsafe/unreadable bytes or exhausted allowance |
| 422 | `PRIVACY_ACKNOWLEDGEMENT_REQUIRED` | Notice not acknowledged |
| 503 | `DEPENDENCY_UNAVAILABLE` | Retryable database/storage/validation dependency failure |

Existing errors map as follows: stale versions, invalid transitions, closed registration/deadline, noneditable application, prohibited replacement, and capacity conflicts use 409; missing required fields/documents use 422; malformed JSON uses 400; oversize bodies/files use 413; disallowed type uses 415. Requests with valid authorization but invalid field shape use 422. Include a safe request ID and never raw parser/storage errors.

## 12. Google authentication integration contract

Authentication routes are owned by the selected library and may live outside `/api/v1`. Before implementation freeze, record its exact start/callback/session/logout paths in the OpenAPI integration notes and Google Cloud configuration. Do not implement a second parallel OAuth handler.

| Operation | Required behavior |
|---|---|
| Start Google login | Trusted-origin initiation; bind single-use state/nonce and PKCE where supported to a short-lived browser transaction; save only an allowlisted return destination |
| Google callback | Server exchanges code and validates provider claims/transaction; atomically resolves subject and provisions Participant-only user if new; issues rotated local session; redirects to a clean allowlisted frontend URL |
| Read session | Return minimal local user ID, display email, roles/effective permissions, expiry; no provider tokens or internal account records; no-store; unauthenticated domain calls remain 401 |
| Logout | CSRF-protected mutation; revoke current local session, expire cookie, return success; repeated logout is harmless |

- Reject missing/mismatched/expired/reused state, nonce, or authorization code. Failed or canceled callbacks must not create a user/application or replace an existing session. Allow multiple tabs through independently bound transactions; never relax validation to accommodate them.
- Reject unknown return destinations, protocol-relative URLs, alternate ports/hosts, and encoded open-redirect attempts. Never reflect provider descriptions or codes in frontend query strings. Return a safe login outcome and request ID.
- A valid callback for a different subject while already signed in must require explicit local logout/account switching. Never merge records or inherit the previous user's permissions. Concurrent first logins resolve to one user under the subject uniqueness constraint.
- Use Google library verification and key rotation support; fail closed on unverifiable identity. Provider exchange failure is retryable by restarting login, not replaying a consumed code. Local disabled status always blocks session issuance.
- Domain API responses remain 401 for expired/revoked sessions and 403 for an authenticated user lacking Staff permission. Login UI distinguishes cancellation, retryable provider failure, and denied sign-in without exposing another account's existence. Codes are `AUTH_LOGIN_CANCELLED`, `AUTH_LOGIN_FAILED`, and `AUTH_PROVIDER_UNAVAILABLE`; keep detailed reasons only in sanitized server diagnostics.
- Email is profile metadata, not the identity/linking key. Google consent is not camp-notice acknowledgement. No Google API token is accepted in application CRUD bodies or retained in browser local/session storage.
