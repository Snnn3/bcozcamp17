# Camp Platform Test Specification

## 1. Document Status

- Scope: Sprint 0, Sprint 1, and Sprint 2
- Test target: Participant Web, Staff Web, API Server, database, and private document storage
- Related documents: [PROJECT_SPEC.md](PROJECT_SPEC.md), [API_SPEC.md](API_SPEC.md), [CONTRIBUTING.md](CONTRIBUTING.md)

QR/check-in, missions, evaluation, buddy features, and spin wheel tests are future scope and are not required for the confirmed release.

---

## 2. Test Objectives

The test suite must prove that:

- Participants can submit valid applications with required documents.
- Invalid input and invalid files are rejected safely.
- Duplicate submissions do not create duplicate applications.
- Participants can see only their own data.
- Staff can review documents through the Staff Web.
- A failed document displays the correct applicant-facing reason.
- Replacement documents create new versions without destroying history.
- Internal Staff notes remain private.
- Role permissions, participant ownership, and stale-update protection work.
- The responsive flow works on mobile and desktop layouts.

---

## 3. Test Levels

### 3.1 Static and Quality Checks

Run on every Pull Request:

- Formatter check
- Linter check
- TypeScript strict type check
- Build check for changed applications
- Dependency and secret scanning when configured

### 3.2 Unit Tests

Unit tests cover deterministic logic without a real database or external storage:

- Registration field validation
- Document file rules
- Application status transition rules
- Document status transition rules
- Permission policies
- Applicant-safe response mapping
- Error code mapping
- Pagination and filter parsing
- Idempotency-key handling

### 3.3 Component Tests

Component tests cover important UI states:

- Registration form initial, loading, validation error, server error, and success states
- File upload selecting, uploading, failed, and completed states
- Applicant status page with approved, pending, correction-required, and rejected documents
- Staff application list loading, empty, filtered, paginated, and error states
- Staff review form with required feedback validation
- Hidden internal notes in the Participant Web
- Responsive navigation and no horizontal overflow

### 3.4 Integration Tests

Integration tests use a test PostgreSQL database and isolated object-storage bucket:

- Application and participant ownership constraints
- One application per participant
- Required answer and document validation
- Document version creation
- Review history creation
- Application status history creation
- Permission and participant-ownership checks
- Transaction rollback on failed submission or review
- Stale document review conflict
- Private storage upload completion
- Signed URL authorization and expiry

### 3.5 End-to-End Tests

E2E tests use synthetic accounts and documents through the deployed test environment. Do not use real applicant data.

---

## 4. Confirmed E2E Scenarios

### E2E-001 Successful Registration

1. Open the registration page on a mobile viewport.
2. Complete all required fields.
3. Upload valid required documents.
4. Submit the application.
5. Verify the application code is displayed.
6. Verify the status is `submitted`.
7. Refresh and verify the same application is returned.

Expected result: exactly one application exists with the required document versions.

### E2E-002 Invalid Registration Data

1. Leave a required field empty.
2. Enter invalid field values.
3. Try to submit.

Expected result: field-level errors are shown and no final application is created.

### E2E-003 Invalid Document Upload

1. Select a disallowed file type.
2. Select a file above the configured size limit.
3. Attempt to upload a corrupted or content-mismatched file.

Expected result: the upload is rejected, a safe error is shown, and no invalid document version becomes current.

### E2E-004 Duplicate Submission

1. Submit a valid application.
2. Retry the same final submission request or refresh and submit again.

Expected result: the API returns the original result and does not create a second application.

### E2E-005 Staff Document Review

1. Submit an application with at least two documents.
2. Sign in as permitted Staff.
3. Find the application by code or participant information.
4. Approve one document.
5. Mark another document as `correction_required`.
6. Enter an applicant-facing reason and an internal note.

Expected result: the review is saved, history is recorded, and the applicant can see only the intended reason.

### E2E-006 Applicant Correction

1. Open the applicant status page.
2. Verify the failed document and reason are visible.
3. Verify the `Action required` state is visible.
4. Upload a replacement document.
5. Verify a new document version is created.
6. Verify the current document status returns to `pending`.
7. Review the new version as Staff.

Expected result: the old version and review decision remain in history.

### E2E-007 Permission Isolation

1. Try to access another participant's application as a participant.
2. Try to access Staff endpoints without Staff permission.
3. Try to review an application without the required Staff permission.
4. Try to download a document without authorization.

Expected result: requests return safe `403` or `404` responses without leaking record existence or private data.

### E2E-008 Stale Review Conflict

1. Open the same document version in two Staff sessions.
2. Review it from session A.
3. Submit a review from session B with the same file ID but the old logical document revision/application version.

Expected result: session B receives a stale-version conflict even though the file ID has not changed, and cannot overwrite the newer review. Repeat with a replacement creating a different file ID.

---

## 5. Security and Privacy Tests

- Verify authentication is required for participant and Staff private routes.
- Verify participant ownership on every applicant endpoint.
- Verify Staff and Admin permissions.
- Verify Admin-only or explicitly granted final decision actions.
- Verify internal notes are absent from applicant API responses.
- Verify private documents cannot be fetched by guessing a URL.
- Verify signed URLs expire and cannot be reused beyond their policy.
- Verify file content validation is performed server-side.
- Verify logs do not contain passwords, tokens, raw files, or sensitive document content.
- Verify rate limits for login, upload, submit, review, and export operations.
- Verify CSRF protection according to the chosen authentication design.

---

## 6. Responsive and Accessibility Tests

Minimum viewports:

| Device class | Width examples |
|---|---:|
| Small mobile | 320–375 px |
| Large mobile | 390–430 px |
| Tablet | 768 px |
| Desktop | 1280 px |

Verify:

- No horizontal scrolling on required flows.
- Forms and upload controls are usable by touch.
- Error messages appear near the relevant field and in a summary when needed.
- Keyboard users can reach all controls.
- Focus indicators are visible.
- Labels are associated with inputs.
- Status is not communicated by color alone.
- Text remains readable at the configured zoom level.

---

## 7. Performance and Reliability Tests

The system should be tested against approximately 200 concurrent users after the confirmed flow is stable.

Load-test targets:

- Registration configuration reads
- Application draft reads and updates
- Document upload-intent requests
- Final application submissions
- Applicant status reads
- Staff application list and detail reads
- Staff review writes

Use PROJECT_SPEC section 15 thresholds: p95 reads <1.5 seconds, p95 writes <2.5 seconds excluding transfer time, HTTP error rate <1%, and zero unexpected 5xx. Report deliberate negative-test 4xx separately, never exclude unexpected errors to improve the result. Record throughput, error rate, p95 latency, database saturation, storage errors, and recovery behavior.

Reliability tests:

- Retry final submission.
- Retry document completion.
- Retry a review action.
- Interrupt a file upload.
- Fail an external storage operation.
- Roll back a database transaction.
- Restore a database backup in a test environment.

---

## 8. Test Data Rules

- Use generated names, emails, phone numbers, and documents.
- Use synthetic files with safe test content.
- Never copy real applicant documents into local development, test, CI, screenshots, or fixtures.
- Reset test data between isolated E2E runs.
- Keep test secrets in CI secret storage or local ignored files.

---

## 9. Test Exit Criteria

Sprint 1 is ready when:

- Registration happy path, validation, upload, duplicate prevention, ownership, and responsive tests pass.
- A Staff intake view can be tested with submitted applications.
- Format, lint, typecheck, and build checks pass.

Sprint 2 is ready when:

- All confirmed E2E scenarios pass.
- Document review and replacement versioning tests pass.
- Staff and participant permission tests pass.
- Internal notes are proven not to leak.
- No unresolved critical or high-severity issue remains.
- The release is demonstrated using synthetic data on supported mobile and desktop viewports.

## 10. Edge-case acceptance matrix

Each row maps to PROJECT_SPEC section 17. These are required test scenarios, not a claim that tests already exist or pass. Use real PostgreSQL transactions and isolated storage for race/recovery tests; frontend-only mocks cannot prove these invariants.

| Requirement | Test / trigger | Observable expected result | Level |
|---|---|---|---|
| EC-01 | Send two draft creates at a barrier; edit from two tabs with same version | One profile/application; one edit wins, other gets 409; no lost answer | Integration |
| EC-01 | Substitute another participant's application, document, submission, upload ID | Safe 404 and zero mutation/file issuance, including nested-ID mismatches | Integration |
| EC-02 | Drop HTTP response after commit for submit, review, completion, final decision | Same-key retry identifies original operation; exactly one history/audit/notification and no extra seat | Integration |
| EC-03 | Replay same key with changed body; reuse key under different account/resource | Changed body gets 409; actor/resource scope remains isolated | Integration |
| EC-04 | Freeze DB time at deadline minus 1 ms, deadline, plus 1 ms | Only first new mutation succeeds; committed receipt still replays after close | Integration |
| EC-04 | Intent created before expiry/deadline; completion validation ends afterward | No new current version; previous file retained; safe deadline/expiry error | Integration |
| EC-05 | Two eligible failures, replace only one, then both | First leaves action_required; second gives resubmitted; independent histories preserved | E2E |
| EC-05 | Mix approved/pending/nonreplaceable rejected; expire all corrections | No automatic acceptance/rejection; canCorrect false when none eligible; clear blocked reasons | Unit + component |
| EC-06 | Two same-file reviews with same revisions; two completions of different intents | Exactly one mutation succeeds in each race; loser 409; versions/counters increment once | Integration |
| EC-06 | Race review/replacement and accept/correction at controlled barriers | Serially valid result or conflict; never accepted with an unapproved required current file | Integration |
| EC-07 | Disable user or revoke permission between page load and mutation/URL issuance | Fresh request denied; no receipt replay exposes forbidden data; explicit deny beats role grant | Integration |
| EC-07 | Staff+Participant user attempts own document review/final decision | Denied even with broad Staff permissions | Integration |
| EC-08 | Session expires during upload; network disconnects after submit | Re-login/reconcile flow, no false success or duplicate application; ownership rechecked | E2E |
| EC-09 | Zero-byte, just-at/over-limit, spoofed MIME, malformed, encrypted, active-content files | Only approved policy-valid bytes become current; safe error for others | Integration |
| EC-09 | Rewrite staging object after validation; reuse PUT after completion | Final immutable bytes/checksum unchanged; never preview unvalidated bytes | Integration |
| EC-09 | Exhaust active intents/request/byte quotas; retry completed intent | Bounded resource use, 429/413 as applicable; receipt replay consumes no replacement count | Integration |
| EC-10 | Request historical file URL, use wrong owner, expire URL | Own/permitted history works, unauthorized issuance fails, expiry enforced | Integration |
| EC-10 | Revoke access after URL issuance | No new URL issued; document the residual valid-URL lifetime; no false immediate-revocation claim | Integration |
| EC-11 | Thai combining marks, whitespace-only name, false, zero, invalid leap date, foreign choices | Valid Unicode/false/zero retained; invalid values rejected; no coercion or choice cross-link | Unit + integration |
| EC-11 | Partial draft with missing contact fields; submit without them | Draft saves; submission 422; post-submit profile mutation rejected | Integration |
| EC-12 | Equal timestamps, huge page size, unknown filter, empty/out-of-range page | Stable ID tie-breaker; invalid limit/filter rejected; legitimate empty list succeeds | Integration |
| EC-12 | Export cells starting with =, +, -, @, tabs/newlines; inject quoted text | CSV remains valid; formulas cannot execute under supported spreadsheet policy; notes absent | Integration |
| EC-13 | Edit structural configuration with existing draft; submit obsolete notice revision | Structural edit rejected; stale notice requires refresh/ack; no silent data reinterpretation | Integration |
| EC-14 | Fail storage validation/copy; fail DB at history/audit/receipt insertion | No pointer/state/counter partial commit; retryable dependency error or safe validation error | Integration |
| EC-14 | Kill worker during validation or after immutable copy, before DB commit | Lease recovery completes once; safe orphan cleanup; referenced objects never deleted | Integration |
| EC-15 | 320px viewport, 200% zoom, keyboard/screen reader, cancel file picker | Required flow usable, errors announced, focus retained/restored, no phantom upload success | E2E + manual |
| EC-16 | Capacity N with N-1 accepted, race two accepts | Accepted count N, one capacity conflict; retry cannot consume another seat | Integration |
| EC-16 | Revoke/withdraw accepted; retry; race capacity decrease | Exactly one seat released; below-accepted capacity rejected; no automatic waitlist promotion | Integration |
| EC-17 | Retention job interrupted, then retried; restore older backup | All approved targets eventually removed; no unapproved cascading loss or resurrected data | Operational |
| EC-18 | Restore DB and object inventory onto clean environment | Missing blobs detected; intents reconciled; private access verified; measured RPO/RTO meets approved target | Operational |
| EC-19 | Switch accounts/logout/back button; inspect CDN/client cache | Previous applicant/Staff data not exposed; no-store on private responses; caches cleared | E2E |
| EC-20 | Concurrent removal of last two permission managers | At least one active manager remains; self-grant/public privilege escalation rejected | Integration |

### Additional invariant suites

- Generate every application-state/action pair: only PROJECT_SPEC section 16 transitions succeed. Verify document review and completion never mutate final states. Test review reversal with fresh revisions, blocked correction flags, and all-required-approved without automatic acceptance.
- Test replacement limits 0, 1, and N; exact final allowed replacement; failed/replayed attempts do not consume count. Multiple draft revisions do not consume post-submission allowance. Optional document omissions do not block submission/acceptance.
- Try direct invalid DB writes to exercise unique/check/composite FK/trigger constraints: singleton, dangling/mismatched current pointer, foreign option, duplicate review revision, invalid count, missing submitted acknowledgement, completed intent without result. Verify constraints exist in clean migrations, not just service mocks.
- Verify history, audit, and notification cardinality after every rollback and retry; review note access is tested independently from document-read access. Inspect browser bundles, logs, telemetry, CSV, and errors for forbidden fields using synthetic canary strings.
- Exercise credentialed CORS and CSRF with actual participant/staff/API origin layout, untrusted origins, missing tokens, logout, Google callback replay/expiry, and shared-IP rate limits. Record selected browser/OS and auth-library versions. Google account recovery is external; no local reset/OTP flow exists.

### Test evidence and release ownership

For each case record requirement ID, implementation/test path, environment/commit, result, and any defect. Developer B owns database, races, storage, and restore evidence; Developer A owns UI, accessibility, and actual-browser flows; both review permissions and release results. No matrix row is marked passed merely because this document was written.

Sprint 1 gates include initial uploads, retries, privacy/ownership, audit, deadline boundaries, full restore, and 200-user load validation before public registration. Sprint 2 adds review/correction/final-decision races and their UI flows. Optional export cases gate export enablement. Unresolved organizer decisions in PROJECT_SPEC section 18 block the relevant production feature, while synthetic development may proceed.

## 11. Google login acceptance tests

| ID | Scenario | Expected result |
|---|---|---|
| AUTH-01 | First Google sign-in, then returning sign-in | One local Participant user; same subject restores identity; no draft, submission, seat, or notice acknowledgement created by login |
| AUTH-02 | Simultaneous first callbacks for one subject | One local user/provider mapping; no duplicate roles or profiles |
| AUTH-03 | Same subject changes email; different subject has same email | First retains user/application/permissions; conflicting email fails safely without linking or transfer |
| AUTH-04 | Wrong issuer/audience/signature, expired ID token, absent verified email | No session or partial local provisioning; safe sign-in error |
| AUTH-05 | Missing/wrong/expired state or nonce; reused code/callback; independent login tabs | Invalid/replayed transaction denied; valid independent transactions remain isolated |
| AUTH-06 | Cancel login, block cookies, disconnect, or simulate Google outage | Clear retry/cancel UI, no false success; existing valid sessions obey local expiry/permissions |
| AUTH-07 | Participant enters Staff URL or sends role in login request | No privilege escalation; Staff denied until explicitly granted local permissions |
| AUTH-08 | Disable user/revoke permissions after Google authentication | New sessions denied for disabled user; existing sessions cannot bypass live local checks |
| AUTH-09 | Idle/absolute expiry, logout/retry logout, account switch | Server expiry enforced; session revoked, caches cleared, no previous user's data; Google itself remains signed in |
| AUTH-10 | External/encoded return URL or cross-origin login/logout initiation | Open redirect/login CSRF/logout CSRF blocked; exact trusted-origin flow works on both frontend domains |
| AUTH-11 | Bootstrap/grant Admin, elevate session, attempt last-admin removal | Restricted audited provisioning; rotated session or re-login; last-admin protection retained |
| AUTH-12 | Personal and Workspace accounts on mobile/desktop | Both supported without implicit domain restrictions; explicit permissions still required |
| AUTH-13 | Inspect logs, redirects, frontend storage, and login consent | No secret/code/token/session leakage; only identity scopes requested; camp notice remains separate |

Use deterministic provider fixtures to test failures/claims and isolated storage for sessions. Run separate real-Google smoke tests with dedicated test accounts against each environment's configured callback and audience before launch; do not automate Google's password/MFA UI or use real applicant accounts. Auth library route mapping, session policy, and Google Cloud production configuration are required evidence, not assumed complete from these specifications.
