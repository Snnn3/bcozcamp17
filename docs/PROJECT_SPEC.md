# Camp Platform Project Specification

## 1. Status and product context

- **Status:** authoritative scope with an implementation baseline; organizer decisions in section 18 remain launch gates
- **Platform:** online, responsive web application supporting an onsite camp
- **Deployment model:** one camp in one year; no multi-event/year support is required
- **Confirmed scope:** Sprint 0, Sprint 1, and Sprint 2
- **Planning capacity:** approximately 200 concurrent users
- **Team:** two Developers
- **Primary priorities:** correctness, privacy, data isolation, recoverability, and a usable mobile experience

The first release must not depend on the whole camp-operations system being finished. Registration and review must be delivered as usable vertical slices.

## 2. Roles and boundaries

### Participant

Participants can:

- Open the registration website on mobile or desktop.
- Complete and submit one application for the camp.
- Upload required documents.
- View their own application and document statuses.
- See exactly which document failed and the applicant-facing reason.
- Upload a replacement document when the rules allow it.

### Staff

Staff can, when explicitly granted the relevant camp-wide permission:

- Sign in to the Staff Web.
- Search, filter, and open applications.
- View permitted applicant documents.
- Review each required document independently.
- Approve, reject, or request correction for a document.
- Write an applicant-facing reason.
- Write an internal note that is never shown to the applicant.
- View document versions and review history.

### Admin

Admins can:

- Manage camp configuration, users, roles, and permissions.
- Grant or revoke Staff permissions.
- Perform restricted final application-status actions when authorized.
- Access approved reports or exports.

There is no Leader role in the confirmed system.

## 3. Confirmed delivery scope

### Sprint 0 — Foundation and scope freeze

- Freeze the fields, documents, file rules, statuses, permissions, correction rules, privacy requirements, and technology decisions needed by Sprint 1–2.
- Create the monorepo, application shells, database migrations, authentication foundation, private-storage foundation, quality checks, and CI.
- Define the API contract and test plan.

### Sprint 1 — Registration MVP

- Responsive Participant Web registration form.
- Required document upload through private object storage.
- Client- and server-side validation.
- Duplicate-application prevention.
- Application code and submitted status.
- Participant application-status page.
- Minimal Staff intake view for submitted applications.

### Sprint 2 — Staff Review Web

- Responsive Staff Web.
- Search, filtering, pagination, and application detail.
- Per-document review actions.
- Applicant-facing correction/rejection reason.
- Applicant status banner and document summary.
- Replacement upload when allowed.
- Document version and review history.
- Staff-only internal notes.

### Not included in the confirmed release

- QR/check-in; the flow and delivery method are TBA.
- Missions and mission scoring.
- Evaluation forms.
- Buddy or group automation.
- Spin-wheel reward draw.
- Participant chat or realtime/push notifications.
- A separate Admin dashboard beyond the permissions and operational functions required for Sprint 0–2.

## 4. Functional requirements

### Registration

| ID | Requirement | Priority |
|---|---|---|
| FR-REG-001 | Show registration only while the camp registration window is open. | Must |
| FR-REG-002 | Validate required fields on the client and server. | Must |
| FR-REG-003 | Allow a draft when enabled by camp configuration. | Should |
| FR-REG-004 | Allow no more than one application per participant. | Must |
| FR-REG-005 | Generate an application code after successful submission. | Must |
| FR-REG-006 | Show a clear confirmation and current status. | Must |
| FR-REG-007 | Make a retried final submission idempotent. | Must |
| FR-REG-008 | Record the accepted privacy-notice version and acknowledgement time. | Must, policy approval required |

### Document upload

| ID | Requirement | Priority |
|---|---|---|
| FR-DOC-001 | Show the camp's required document types. | Must |
| FR-DOC-002 | Validate extension, detected content type, file size, ownership, and application scope. | Must |
| FR-DOC-003 | Store documents in private object storage. | Must |
| FR-DOC-004 | Never expose raw storage keys or public document URLs. | Must |
| FR-DOC-005 | Store every replacement as a new document version. | Must |
| FR-DOC-006 | Do not replace a previous valid version when an upload fails or is abandoned. | Must |
| FR-DOC-007 | Show upload errors in a clear applicant-facing format. | Must |

### Applicant status and feedback

| ID | Requirement | Priority |
|---|---|---|
| FR-APP-001 | A participant can view only their own application and documents. | Must |
| FR-APP-002 | Show the overall application status. | Must |
| FR-APP-003 | Show every required document's status. | Must |
| FR-APP-004 | When a document fails, show that document and the reason on the website. | Must |
| FR-APP-005 | Show an `Action required` state when a replacement is allowed. | Must |
| FR-APP-006 | Allow replacement only when document, application, and deadline rules allow it. | Must |
| FR-APP-007 | Never show Staff-only internal notes to applicants. | Must |

### Staff review

| ID | Requirement | Priority |
|---|---|---|
| FR-STAFF-001 | Require authentication and permission for Staff Web and review actions. | Must |
| FR-STAFF-002 | Search and filter applications within the permitted application scope. | Must |
| FR-STAFF-003 | Open an application with its current document versions. | Must |
| FR-STAFF-004 | Review each required document independently. | Must |
| FR-STAFF-005 | Require an applicant-facing reason for `rejected` and `correction_required`. | Must |
| FR-STAFF-006 | Support Staff-only internal notes. | Must |
| FR-STAFF-007 | Record reviewer, time, version, status, and feedback. | Must |
| FR-STAFF-008 | Reject a stale review instead of overwriting a newer document version. | Must |
| FR-STAFF-009 | Restrict final application decisions to the configured permission; default is Admin-only. | Must, policy confirmation required |

### Operations

| ID | Requirement | Priority |
|---|---|---|
| FR-OPS-001 | Configure camp dates, fields, document types, file rules, and correction rules. | Must |
| FR-OPS-002 | Manage Staff permissions for this camp. | Must |
| FR-OPS-003 | Audit important application, document, permission, and review changes. | Must |
| FR-OPS-004 | Support authorized applicant-data export when required. | Should |
| FR-OPS-005 | Document and test database backup and restore before production. | Must |

## 5. Status model

### Application status

```text
draft
submitted
reviewing
action_required
resubmitted
accepted
rejected
waitlisted
withdrawn
```

The complete transition baseline is defined in section 16. Organizer-dependent policies must be approved in Sprint 0. Document review must not silently change a final application decision.

### Document status

```text
not_uploaded -> pending -> approved
                        -> correction_required
                        -> rejected
```

Rules:

- `correction_required` means a replacement may be uploaded when configured.
- `rejected` means the document failed review; replacement behavior must be explicitly configured.
- Both failed statuses require an applicant-facing reason.
- A replacement creates a new version, resets the current document to `pending`, and preserves history.

## 6. Non-functional requirements

### Responsive and accessible

- Support mobile, tablet, and desktop layouts.
- Avoid horizontal scrolling in required flows.
- Support keyboard navigation and visible focus states.
- Do not communicate status by color alone.
- Use clear labels, validation messages, and status text.

### Performance and reliability

- Plan for approximately 200 concurrent users.
- Paginate Staff application lists.
- Do not load all applications or documents in one request.
- Use private object storage rather than database blobs.
- Make final submission and review changes transactional and retry-safe.
- Keep audit history and test backup restore before production.

### Security and privacy

- Enforce authorization on every sensitive endpoint.
- Scope records by participant ownership and role/permission.
- Use private storage and short-lived signed URLs.
- Do not log passwords, tokens, raw documents, or sensitive file contents.
- Approve the Privacy Notice, retention period, deletion owner, and contact before opening registration.

## 7. Permission matrix

| Action | Participant | Staff | Admin |
|---|---:|---:|---:|
| View public registration configuration | Yes | Yes | Yes |
| Create/edit own application | Yes, while open | No | No |
| Upload own documents | Yes | No | No |
| View own status | Yes | No | Yes, if permitted |
| List applications | No | If granted | If granted |
| View application documents | Own only | If granted | If granted |
| Review documents | No | If granted | If granted |
| View internal notes | No | If granted | If granted |
| Change final application decision | No | Policy-controlled | If granted |
| Manage Staff permissions | No | No | If granted |
| Export applicant data | No | Policy-controlled | If granted |

## 8. Architecture and repository structure

Use a TypeScript/Node.js monorepo with a modular-monolith API. Web applications never connect to PostgreSQL. They access private object storage only through narrowly scoped, short-lived upload/download URLs issued by the API.

```text
.
├── apps/
│   ├── web/                         # Participant Web
│   ├── staff/                       # Staff Web
│   └── server/                      # API Server
├── packages/
│   ├── api/                         # API contracts, errors, OpenAPI
│   ├── auth/                        # Authentication and session helpers
│   ├── config/                      # Shared tooling/configuration
│   ├── db/                          # Prisma schema, migrations, repositories
│   ├── storage/                     # Private S3-compatible storage adapter
│   ├── ui/                          # Shared responsive UI components
│   └── validation/                  # Zod schemas and validation rules
├── tests/
│   ├── e2e/
│   ├── integration/
│   └── fixtures/
├── infra/                           # Docker/local services/deployment
├── scripts/
├── .github/workflows/               # CI
├── docs/                            # Project contracts and contributor guidance
│   ├── API_SPEC.md
│   ├── CAMP_DATABASE_SCHEMA.md
│   ├── CONTEXT.md
│   ├── CONTRIBUTING.md
│   ├── DBDIAGRAM_SCHEMA.dbml
│   ├── PROJECT_SPEC.md
│   └── TEST_SPEC.md
├── README.md
├── package.json
├── package-lock.json
└── tsconfig.json
```

Backend request flow:

```text
router -> authentication/policy -> service -> repository -> database/external adapter
```

Keep business rules in the API service layer, not only in React components or route handlers.

## 9. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| Language/runtime | TypeScript, Node.js LTS | Use the version pinned in the repository. |
| Package manager | npm Workspaces | Matches the team's existing experience. |
| Participant/Staff Web | React 19 | Responsive separate apps or clearly separated routes. |
| Routing/data | TanStack Router and TanStack Query | Router handles routes; Query handles API data, cache, and mutations. |
| TanStack Start | Optional | Decide in Sprint 0; it is not required if the separate API architecture uses a simpler React setup. |
| UI | Tailwind CSS, shared shadcn-style components, Lucide | Shared visual language and responsive controls. |
| API | Node.js + Fastify, REST, Zod, OpenAPI | API is authoritative for validation and permissions. |
| Database | PostgreSQL | Transactional relational storage. |
| ORM/migrations | Prisma ORM + Prisma Migrate | Type-safe queries and migrations. |
| Authentication | Google login via OpenID Connect; Better Auth or approved server-side library | Google is the confirmed identity provider for Participant, Staff, and Admin; see section 19. |
| File storage | Private S3-compatible storage | MinIO/RustFS locally; production provider TBA. |
| Testing | Vitest, Testing Library, Playwright | Unit/component/integration/E2E coverage. |
| Code quality | Ultracite with one selected provider, or the approved equivalent | Do not run competing formatter/linter configurations. |
| CI/deployment | GitHub Actions, Docker, approved container host | Run quality gates before merge/deploy. |

Application boundary:

```text
Participant Web ──┐
                  ├──> API Server ──> PostgreSQL
Staff Web ────────┘          ├──────> Private object storage
                             └──────> Authentication/email providers
```

## 10. Sprint plan and Definition of Done

One sprint is planned as approximately one week. Sprint 1 and Sprint 2 may need two weeks if requirements, testing, deployment, and documentation are being completed at the same time.

### Sprint 0 — Foundation and scope freeze

**Goal:** make the project ready for implementation.

**Work:**

- Confirm fields, document types, file rules, statuses, permissions, correction limits, privacy policy, and registration dates.
- Create the monorepo and application shells.
- Configure Prisma/PostgreSQL, authentication, roles, private storage, TypeScript, quality tools, and CI.
- Create the responsive shell for Participant Web and Staff Web.
- Review and approve this specification, `API_SPEC.md`, `CAMP_DATABASE_SCHEMA.md`, and `TEST_SPEC.md`.

**Definition of Done:**

- The project installs and runs with documented npm commands.
- Clean database migrations and seed data run successfully.
- Participant, Staff, and Admin route protection works.
- Responsive shell works at agreed mobile and desktop viewports.
- Sprint 1–2 decisions are recorded and no critical security/data-isolation issue is known.
- Format, lint, typecheck, tests, and build pass in CI.

### Sprint 1 — Registration MVP

**Goal:** a participant can submit an application with required documents.

**Work:**

- Build the responsive registration form.
- Implement draft/edit behavior if enabled.
- Implement document upload intent, private upload, file validation, and completion.
- Implement duplicate prevention, application code, final submission, and applicant status.
- Implement minimal Staff intake/list view.

**Definition of Done:**

- A participant can complete and submit a valid application on mobile and desktop.
- Required fields and files are validated server-side.
- Files are private and stored outside the database as configured.
- Duplicate final submission is idempotent.
- Applicant sees confirmation and current status.
- Participant ownership and Staff access tests pass.
- Sprint 1 tests and CI checks pass.

### Sprint 2 — Staff Review Web

**Goal:** Staff can review each document and the applicant can see actionable feedback.

**Work:**

- Build Staff application list, search, filters, pagination, and detail page.
- Implement per-document approve/reject/correction actions.
- Require a reason for failed document statuses.
- Implement applicant status banner, failed-document details, replacement upload, and deadline rules.
- Implement version history, review history, audit records, and internal notes.
- Protect against stale document reviews.

**Definition of Done:**

- Staff can find and open permitted applications.
- Staff can review each document independently.
- A failed document displays its status and reason on the applicant website.
- A permitted replacement creates a new version and returns the document to `pending`.
- Internal notes never appear in applicant responses.
- Stale review conflicts are rejected safely.
- Responsive, permission, E2E, and CI checks pass.

### Future roadmap — not committed

After Sprint 2 is reviewed, the team may plan:

1. QR/check-in and onsite operations — flow TBA.
2. Missions and evaluation.
3. Spin-wheel reward draw.
4. Optional buddy/group assignment.
5. Additional onsite hardening and rehearsal. Registration/review security, load testing, and restore verification are required before the initial release.

## 11. Two-Developer split

| Sprint | Developer A: Web/UX | Developer B: Backend/Data |
|---|---|---|
| Sprint 0 | Responsive shells, initial pages, UI conventions | Database, authentication, roles, storage, environments, CI |
| Sprint 1 | Registration form, upload UI, applicant states | API, validation, duplicate prevention, application code, private storage |
| Sprint 2 | Staff Web, applicant feedback/status, responsive states | Review API, transitions, versions, permissions, audit, notifications |

Both Developers integrate the complete flow and review each other's pull requests.

## 12. Decisions required before implementation

Sprint 0 must explicitly approve:

- Final participant fields and field types.
- Required document types.
- Allowed extensions, detected MIME types, maximum size, and maximum count.
- Google OAuth client setup, server-side auth library, session settings, and Staff provisioning; Google login itself is confirmed.
- Registration opening/closing timestamps and timezone.
- Correction deadline and replacement limits.
- Final application decision authority.
- Thai, English, or bilingual UI and message copy.
- Privacy Notice, lawful basis, retention period, deletion owner, and data-subject contact.
- Email provider, production hosting, PostgreSQL hosting, and S3-compatible provider.
- Exact Node.js, package, Ultracite/provider, browser, and mobile OS versions.
- Whether TanStack Start is needed; do not add it automatically if the separate API architecture does not need SSR/full-stack routing.

Until approved, these values remain configuration or TBA rather than hidden assumptions in code.

## 13. Release acceptance

The confirmed Sprint 1–2 release is acceptable when:

1. A participant can submit a responsive application with all required documents.
2. Invalid fields and files are rejected by the server.
3. Duplicate final submission does not create a second application.
4. Staff can find and open the application in Staff Web.
5. Staff can review each document independently.
6. A failed document displays the exact document and reason on the applicant page.
7. An allowed replacement creates a new version and returns the document to pending review.
8. Internal Staff notes remain hidden from applicants.
9. Participant, Staff, Admin, and ownership/permission checks are tested.
10. Formatting, lint, type, test, and build checks pass.

## 14. Deployment recommendation

### Budget-capped production shape

Provider prices, tiers, and sizing below are estimates retained from the planning task, not reverified by this specification review. Recheck official provider terms and total cost before provisioning; selecting a host remains a launch decision.

This plan assumes that **USD 100 is the total deployment budget for the approximately three-month online period** (October–December 2026). It is suitable for the confirmed Sprint 0–2 scope: registration, document upload, and Staff review. It is not a guarantee that every future onsite feature will fit the same server.

### Confirmed domain layout

Use one registered domain with two subdomains:

```text
example.com        -> Participant Web
staff.example.com  -> Staff Web
api.example.com    -> Backend API
```

`example.com` is a placeholder for the real domain. The project should not purchase separate domains for the Staff Web or API.

### Approved DigitalOcean options

Keep both options available until the application has been implemented and tested:

| Option | Server | Deployment method | Approximate three-month server cost | Use when |
|---|---|---|---:|---|
| Economy | Basic 2 vCPU / 2 GiB / 60 GiB | Docker Compose + Caddy | USD 54 | The team accepts command-line deployment and wants the lowest resource usage |
| Easier operations | Basic 2 vCPU / 4 GiB / 80 GiB | Self-hosted Coolify | USD 72 | The team prefers dashboard-based deployment and needs more memory for API and PostgreSQL |

The Economy option should not run Coolify on the same server because the Coolify control plane already consumes most of the available memory. The Easier operations option may run Coolify, but it still requires a load test, backup restore test, and security review. Both options use Cloudflare Pages for the two frontend sites and Cloudflare R2 for private documents.

Use Singapore-region infrastructure for users in Thailand:

```text
Participant Web ──┐
Staff Web ────────┼──> Cloudflare Pages (static builds)
                  │
                         └──> api.example.com
                         │
                         └──> DigitalOcean Basic Droplet
                               ├── Reverse proxy + TLS
                               ├── Fastify API
                               └── PostgreSQL

Private documents ──> Cloudflare R2 Standard bucket
Database backups ───> Separate encrypted backup location
```

The shared architecture is:

- **Frontend:** Cloudflare Pages Free for the Participant Web and Staff Web if both apps are built as static client applications. Static asset requests are free; the Free plan currently allows up to 500 builds per month and 20,000 files per site. If TanStack Start SSR becomes a requirement, run the Node applications on the VPS instead.
- **Application and database server:** Choose one of the approved DigitalOcean options above. The 2 GiB option runs the API, PostgreSQL, and reverse proxy with Docker Compose. The 4 GiB option can run those services with self-hosted Coolify.
- **Document storage:** Cloudflare R2 Standard, private bucket, accessed through short-lived signed URLs. R2 currently includes 10 GB-month of storage, 1 million Class A operations, and 10 million Class B operations per month; egress is free. Do not make the bucket public.
- **Reverse proxy and TLS:** Caddy or Nginx on the VPS for the Compose option; Coolify's managed proxy for the Coolify option. `api.example.com` points to the VPS, while `example.com` and `staff.example.com` point to their respective Cloudflare Pages projects.
- **Deployment:** Use Docker Compose + Caddy for the Economy option, or self-hosted Coolify for the Easier operations option. Do not add both deployment control planes to the same server.
- **Protection:** Add Cloudflare Turnstile to public registration/login actions if abuse or bot submissions are a concern. The Free plan supports production use.

Required cost-control decisions:

- Upload document bytes directly from the browser to R2 using short-lived signed upload URLs. The API should create upload intents and review metadata, not proxy every file byte.
- Keep the VPS database and API on the same machine, use a small bounded connection pool, paginate Staff lists, and add indexes before load testing.
- Use one project domain with `example.com`, `staff.example.com`, and `api.example.com`. Reserve part of the remaining budget for the domain if it has not already been purchased. Email provider, tax, and payment fees must be checked separately.
- Store encrypted database backups in R2 for the live period and download a final offline copy before shutdown. R2 is separate from the VPS but not a provider-independent disaster-recovery location.

This is a single-server design with no automatic failover. The risk is acceptable only if database backups, restore rehearsal, health checks, and a manual recovery procedure are completed before registration opens.

The 200-concurrent-user target is an acceptance criterion, not an assumption from the server size. If the load test fails, either reduce simultaneous upload pressure or increase the budget. The next DigitalOcean Basic size (8 GiB / 4 vCPUs) is USD 48 per month, which would be approximately USD 144 for three full months before taxes and add-ons.

### Alternative options

| Option | Approximate cost | Trade-off |
|---|---:|---|
| DigitalOcean 2 vCPU / 4 GiB + R2 | USD 24/month; approximately USD 72 for three full months | Recommended budget option; still requires the 200-user load test |
| DigitalOcean 2 vCPU / 2 GiB + R2 | USD 18/month; approximately USD 54 for three full months | Cheaper fallback, but less memory headroom for PostgreSQL and uploads |
| DigitalOcean 4 vCPU / 8 GiB + R2 | USD 48/month; approximately USD 144 for three full months | Better peak-traffic headroom, but exceeds the USD 100 total cap |
| Hetzner Singapore CPX12 + R2 | USD 17.99/month before IPv4, tax, and add-ons | Similar budget; smaller 1-core/2 GiB instance and more manual operations |
| Supabase Pro for PostgreSQL/storage + separate API host | Starts at USD 25/month for Pro, plus compute/hosting choices | Easier database backups and operations, but the total is usually higher and introduces another platform |

### Thai VPS + self-hosted Coolify candidate

A VPS located in Thailand may reduce the cash cost and provide local support. Self-hosted Coolify has no separate recurring platform fee, but the team must operate Coolify, Docker, the host OS, backups, and recovery. Coolify's published minimum is 2 CPU cores, 2 GB RAM, and 10 GB disk; for this project, use at least **2 CPU cores / 4 GB RAM** because the same server also runs PostgreSQL and the API.

Keep the frontend on Cloudflare Pages and use Coolify for the API and PostgreSQL. This leaves the VPS responsible for fewer requests while preserving the selected domain layout:

```text
example.com        -> Cloudflare Pages Participant Web
staff.example.com  -> Cloudflare Pages Staff Web
api.example.com    -> Thai VPS running Coolify-managed API
```

Before purchasing a Thai VPS, verify all of the following in writing:

- Root or sudo SSH access and support for Ubuntu/Debian.
- Docker and Docker Compose are allowed; ports 22, 80, and 443 can be opened.
- A public IPv4 address and custom DNS records are available.
- The advertised CPU is sufficient for a 200-user load test and is not severely oversubscribed.
- Database backups can be downloaded or restored independently of the VPS.
- The advertised price includes or clearly excludes VAT, setup, bandwidth, IPv4, snapshots, and renewal fees.
- The provider can reboot, reinstall, and recover the VPS within the required support window.

Do not expose the Coolify dashboard publicly without access restrictions. Build images in CI where possible so a production deployment does not consume all VPS memory. The Thai VPS option is approved only after the same staging load test, backup restore test, and security checklist pass.

The Free Supabase plan is not the production default because it can pause after inactivity and does not include automatic backups. The low-cost VPS plan must also not store applicant documents only on its local disk.

### Estimated camp-period budget

The expected online window is approximately **15 October–31 December 2026**. Budget for three billing months:

- DigitalOcean budget Droplet: approximately USD 72 for three full months (USD 24/month).
- Cloudflare Pages: USD 0 for static asset hosting within the Free plan limits.
- Cloudflare R2: target USD 0 if document storage and operations remain within the included monthly tier; actual cost depends on file size and access frequency.
- Cloudflare Turnstile: USD 0 on the Free plan if used.
- Remaining budget: approximately USD 28 before tax, domain, email, and unexpected overage.

The budget target is therefore **approximately USD 72 for three full months**, with a hard ceiling of **USD 100 for deployment infrastructure**. The remaining budget can cover a domain and small usage charges, but exact tax and domain costs must be checked before provisioning. If the USD 100 ceiling must also include high-volume email, paid monitoring, or managed backups, the scope or budget should be revisited.

### Production deployment steps

1. Provision the VPS in Singapore with an SSH key and a firewall allowing only SSH, HTTP, and HTTPS.
2. Install Docker and Docker Compose; do not expose PostgreSQL publicly.
3. Create a private R2 bucket and server-only access keys.
4. Configure production secrets through the host secret store or an ignored environment file.
5. Deploy the API, PostgreSQL, and reverse proxy from a tagged release.
6. Run Prisma migrations as a controlled release step, never automatically against an unknown database.
7. Deploy the Participant Web and Staff Web to separate Pages projects, or serve their static builds from the reverse proxy if SSR is later selected.
8. Enable HTTPS, health checks, structured logs, database metrics, and disk-space alerts.
9. Run a backup and restore rehearsal using synthetic data.
10. Run the load-test plan below against staging before opening registration.

### Backup and shutdown plan

- Run a nightly encrypted PostgreSQL dump to a location separate from the VPS.
- Keep at least daily backups during the live period and one final archive after the camp closes.
- Test restoring a backup before launch and again before shutdown.
- Keep uploaded documents in the private bucket until the approved retention period ends.
- On or after 1 January 2027, disable public access only after the final export, backup, retention decision, and incident contact are confirmed.

## 15. Load-test plan for 200 concurrent users

The target means **200 concurrent virtual users following realistic flows**, not necessarily 200 requests per second. Capacity must be measured with the real API, database, and document-upload path.

Use k6 from a separate load-generator machine so the test machine does not compete with the application server. Protocol-based API traffic should cover most load; use a small number of browser checks for frontend confirmation.

### Test profiles

| Test | Profile | Purpose |
|---|---|---|
| Smoke | 5–10 virtual users for 2–5 minutes | Detect broken scripts and environment issues |
| Baseline | 50 virtual users for 10 minutes | Establish normal latency and resource usage |
| Target | Ramp to 200 virtual users, hold for 15 minutes | Validate the launch target |
| Spike | Ramp from 20 to 200 users in 30–60 seconds | Simulate a registration announcement or deadline spike |
| Upload | 20–50 concurrent representative uploads | Validate signed uploads, storage, and API completion |
| Soak | 100–200 users for 30–60 minutes | Detect memory leaks, connection leaks, and storage failures |

### Suggested workload mix

- 60% read registration configuration, application status, and document status.
- 25% save application answers and request upload intents.
- 10% complete submissions and replacement uploads.
- 5% Staff list, detail, and document-review actions.

Use synthetic accounts and synthetic documents. Never run destructive or real-applicant load tests against production.

### Initial acceptance thresholds

- HTTP error rate below 1% for the target test.
- No unexpected 5xx responses.
- p95 read latency below 1.5 seconds.
- p95 write/review latency below 2.5 seconds, excluding the time a user spends uploading a file to object storage.
- No duplicate application, duplicate document version, or stale-review corruption.
- Database connection pool remains below its configured limit.
- VPS CPU stays below approximately 70% sustained and memory below approximately 80% during the target test.
- No disk-space, database, object-storage, or backup alert is triggered.

These are starting release thresholds and may be tightened after a baseline run. A failed threshold requires either optimization, a larger VPS, or a revised workload assumption; it must not be silently ignored.

### Example k6 command

```text
k6 run --vus 200 --duration 15m tests/load/registration.js
```

The committed test script should model ramp-up, human think time, idempotent writes, synthetic accounts, and cleanup. Record p50/p95/p99 latency, throughput, error rate, active VUs, database CPU/connections, VPS CPU/memory/disk, and object-storage errors.

### Release decision

The production size is approved only after the target test passes in staging with the same container images, database indexes, storage rules, and environment settings planned for production. The 200-user target is an acceptance criterion, not a guarantee that can be inferred from the VPS specification alone.

## 16. Complete lifecycle and invariants

Revision: 20 September 2026. These rules resolve unspecified implementation behavior; they do not claim organizer approval of the open business decisions in section 18. Read this section together with the API, schema, and test contracts. Any later policy change must update all four and its tests.

### 16.1 Identity, drafts, and configuration

- One application means one per authenticated participant profile, enforced by a database unique constraint even for simultaneous requests. It does not prove that a person has not registered using another account. No automatic identity merging, document-based matching, or extra identity collection is included.
- Create the participant profile and draft atomically. Profile contact fields may be null while incomplete; required identity/contact fields are checked at submission. Login email and contact email have separate purposes. Do not duplicate the same field in both the profile and dynamic answers.
- A server-side draft is required to own uploads, including when the optional save-and-resume UI is disabled. Drafts are not Staff intake applications and have no application code. Disabling the optional UI does not remove ownership or retry protection.
- Draft edits validate supplied values but allow missing required fields. Final submission validates the entire application. After submission, form answers/profile fields used in the application are frozen; document correction is the only applicant edit in this release. Account contact changes must not silently rewrite a submitted application.
- Freeze field codes, types, options, requiredness, document rules, and privacy-notice version before registration opens. Once any draft exists, reject structural changes in this release. Emergency changes need a reviewed migration, explicit participant impact handling, and new tests; no silent reinterpretation of saved answers.
- Operational changes to dates, capacity, or camp status require configuration-management permission, a reason, optimistic concurrency, and audit. Never reduce capacity below the accepted count. Camp status does not override time checks.
- Keep historical configurations and notice text available through the retention period. Draft expiry and abandoned-file cleanup use an approved retention policy, not the registration closing time alone.

### 16.2 Time, correction eligibility, and counts

- Use the authoritative database clock checked after acquiring mutation locks. Persist UTC instants; display dates with the configured IANA timezone (proposed: `Asia/Bangkok`). Registration is open exactly when camp status is `registration_open` and `opensAt <= now < closesAt`. At the closing instant, new writes are closed; being on the page or holding an upload URL gives no grace period.
- New drafts, draft edits, initial upload completion, and first submission require an open registration window. Own reads remain available after closing until access is intentionally retired. Corrections can continue after registration closes.
- Effective correction deadline is the application override, otherwise the camp correction deadline. If neither exists, correction is disabled, never unlimited. At `now == deadline`, completion is denied. Only configuration managers may change the override, with a reason and audit; reviewers cannot grant extra time.
- Replacement after submission requires: active account; owned application in `submitted`, `reviewing`, `action_required`, or `resubmitted`; current document in `correction_required` or `rejected`; document-type replacement enabled; reviewer permission flag enabled; remaining replacement allowance; and an unexpired effective deadline. Camp `draft` or `archived` disables mutations. All predicates are recomputed by the API at both intent creation and completion.
- Initial upload does not consume a replacement allowance. Only a successful post-submission replacement consumes one; rejected files, abandoned uploads, expired intents, and replayed completions do not. The limit is per logical document and is a required nonnegative configuration value. Zero disables replacement. Pre-submission revisions are subject to upload quotas, not this allowance.
- MVP baseline is one file per document type (`max_count = 1`), with many historical versions. Multiple pages must be in one permitted file. Supporting several simultaneous files requires a separate bundle/slot model before enabling `max_count > 1`.
- Camp capacity means accepted participants, not total applications, registered accounts, or concurrent users. Submission never consumes a seat. Acceptance and seat release serialize through the camp row. Two concurrent accepts for one remaining seat produce one acceptance and one capacity conflict. Waitlisting does not reserve a seat or automatically promote anyone.

### 16.3 Application transition table

Every transition requires authorization and a transaction containing state, history, and audit. Explicit submit/review/final-decision requests require the expected application version; draft creation uses uniqueness and upload completion uses the intent's captured document revision plus the locked current application state. Increment the application version once per successful transaction that changes its answers, documents, deadline, or status. Reads and retry replays do not increment it. The API must reject any transition not listed below. Valid document operations may leave the application state unchanged and still increment revisions; do not add a status-history row when the status did not change.

| Current state | Trigger | Next state and preconditions |
|---|---|---|
| No application | Participant creates draft | `draft`; registration open; return existing record on concurrent duplicate |
| `draft` | Participant submits | `submitted`; all required answers, validated uploads, and current notice acknowledgement present; create code once |
| `submitted`, `resubmitted` | Staff saves first review without an actionable failure | `reviewing` |
| `submitted`, `reviewing`, `resubmitted` | Review creates at least one eligible correction | `action_required` |
| `action_required` | Replacement completes | Remain `action_required` if another eligible failed document exists; otherwise `resubmitted` |
| `action_required` | Staff revises a decision and no eligible failed document remains | `reviewing` |
| `submitted`, `reviewing`, `action_required`, `resubmitted` | Final decision permission | `accepted`, `rejected`, or `waitlisted`; reason required; acceptance requires all required documents approved and a seat |
| `waitlisted` | Final decision permission | `accepted` or `rejected`; acceptance rechecks documents and capacity |
| `accepted` | Final decision permission revokes an acceptance | `rejected`; reason required; release seat atomically |
| Any submitted state including `accepted`, `waitlisted`, or `rejected` | Final decision permission records participant withdrawal | `withdrawn`; reason required; release seat if accepted |
| `rejected`, `withdrawn` | Reopen/reapply | Not supported in this release; do not create another application |

`accepted`, `rejected`, `waitlisted`, and `withdrawn` lock document review and upload. No direct applicant withdrawal endpoint is committed; the organizer contact path handles the request with an authorized Staff/Admin action. The Admin role alone does not bypass explicit permission denials. Users must not review or make final decisions on their own applications, even when they also hold Staff/Admin roles.

Document approval never automatically accepts an application. A nonreplaceable rejected document leaves the application awaiting a Staff decision; it does not automatically reject the application. Expiry alone does not rewrite stored application status: the status page keeps the recorded workflow status but shows `canCorrect=false` and the blocking reason. Do not show an actionable upload button merely because status is `action_required`.

### 16.4 Document review and upload consistency

- `not_uploaded` has no current submission. A validated completion creates a new immutable version and sets `pending`. Review operates on an existing current version only, after first application submission.
- Review may revise any reviewed status while the application is nonfinal, with a fresh reason for failure and a new history event. Require both `expectedSubmissionId` and `expectedDocumentVersion`: two reviewers of the same file must not silently overwrite one another.
- Increment the logical document revision for every review and successful completion. Do not confuse this revision with the file's version number. An upload intent captures the document revision it is replacing. Only one concurrent completion against that revision may win.
- Failed review requires a trimmed, nonblank applicant message. Internal notes and applicant messages are distinct fields and permissions. Render both as text, never executable markup. Clearing the current message on replacement/approval must preserve historical review text.
- Treat upload URLs as temporary credentials. They necessarily contain an opaque object path; never return a separate storage key or allow clients to choose one. A private download URL is also a temporary credential, not a public file URL.
- Upload only to staging objects. Verify actual length, signature/content, parser readability, allowed type, and checksum before promotion. Reject empty, truncated, encrypted/unreadable, disallowed active-content, or unsafe files. Publish the supported file-validation policy before launch.
- The final object must be immutable and must contain exactly the bytes validated. Bind validation to an object version or copy to a server-only immutable object and validate that copy; an upload URL must not allow overwriting the final object after review. Do not treat an ETag as a universal content checksum.
- Storage and database writes are not one transaction. Prepare and validate the immutable object outside short DB transactions, then lock/recheck eligibility and publish the pointer with history/audit. On DB failure, retain the prior current version and reconcile the orphan safely. Never keep a DB lock while uploading or scanning.
- A committed completion retried after a deadline returns its original result after authorization. An uncommitted completion after a deadline fails. Validation outages remain retryable; they must not mark a file usable. Cleanup must not delete referenced, processing, or still-valid intent objects.

## 17. Edge-case requirements

| ID | Area | Required behavior |
|---|---|---|
| EC-01 | Two tabs/accounts | Unique participant/application constraint; stale draft writes fail without data loss; cross-account IDs return safe 404 |
| EC-02 | Lost response | Submission, completion, review, and final decision retries return one committed operation; no duplicate code, history, notification, or seat |
| EC-03 | Same retry key, different body | Reject with a conflict; never execute the changed request |
| EC-04 | Deadline boundary | Test before, exactly at, and after both deadlines, including intent before deadline/completion after it |
| EC-05 | Multiple failed documents | Correcting one does not clear another document's required action; mixed permanent failure/pending/approval stays explicit |
| EC-06 | Concurrent Staff actions | Review versus review, review versus replacement, completion versus completion, acceptance versus correction, and acceptance versus capacity update serialize or conflict |
| EC-07 | Account/permission revocation | Disabled account cannot act; explicit deny wins over allow; check live permissions before mutation and download URL issuance; never self-review an application |
| EC-08 | Session/network failure | Preserve unsent form state where safe, show retry/re-login, reconcile server state before resending; never claim success on a timeout |
| EC-09 | File abuse | Enforce per-file, per-user intent, concurrent upload, request-body, and total staging quotas; do not trust filename, declared MIME, or client checksum |
| EC-10 | Private downloads | Authorize each version, audit Staff issuance, short expiry, no shared cache; explain that already issued URLs may work until expiry and downloaded copies cannot be recalled |
| EC-11 | Form types | Support Thai/Unicode names without ASCII-only rules; reject whitespace-only required text, invalid dates, nonfinite numbers, wrong types, duplicate/foreign options, and unknown fields; false and zero are valid values |
| EC-12 | Search/export | Bound queries, stable pagination, escaped text, explicit export fields, spreadsheet formula-injection protection, no internal notes by default; no drafts in intake/export |
| EC-13 | Configuration/notice change | Reject stale configuration/notice at submission; do not revalidate historical accepted submissions against new rules silently |
| EC-14 | Storage/DB outage | No half-committed current pointer, missing audit, or false success; bounded retries, orphan reconciliation, and operator visibility |
| EC-15 | Browser accessibility | Keyboard and screen-reader labels, announced errors/status changes, focus management, 200% zoom, Thai text wrapping, slow uploads and mobile file-picker cancellation |
| EC-16 | Capacity | Acceptance count never exceeds capacity; accepted-to-rejected/withdrawn releases exactly one seat; no automatic waitlist promotion |
| EC-17 | Retention and shutdown | Delete expired originals, replacements, staging files, derived previews, exports, and backups under approved schedules; retry partial deletion; do not restore purged data into active service |
| EC-18 | Monitoring/restore | Restore database and matching objects; report missing files; reconcile incomplete intents; invalidate restored sessions/temporary credentials as needed before reopening writes |
| EC-19 | Public/private cache | Public configuration may cache only with revalidation; all private API/file-link responses use `Cache-Control: no-store`; clear client caches on logout/account switch |
| EC-20 | Last administrator | Prevent removal/disablement of the last active account able to manage permissions; never grant Staff/Admin via public registration |

Permission resolution: disabled account denies all access; otherwise an explicit user deny overrides user allow and role grants; absent any allow means deny. `application_read`, `document_read`, `document_review`, `internal_note_read`, `internal_note_write`, `application_final_decision`, `export_applications`, `configuration_manage`, and `permissions_manage` are separate capabilities. Review requires read and review capabilities; writing an internal note also requires its write capability. Viewing notes requires its read capability. All roles obey these rules.

Keep sensitive fields out of browser analytics, URL queries, crash reports, audit values, and proxy/storage logs. CSRF protection, exact credentialed CORS origin allowlists, host-only secure session cookies, and account recovery must be tested with the actual participant/staff/API domain layout. Authentication error messages must not reveal account existence.

In-app feedback means the persisted applicant status page is authoritative. Durable notification rows may accompany it; push, realtime delivery, and application-status email delivery remain uncommitted. Notification failure must roll back a transaction when a notification row is part of that transaction. External delivery, if later added, must not occur inside it.

## 18. Decision register and launch gates

Source context: the referenced task “วางแผนระบบค่ายตามลำดับความสำคัญ” confirms English specifications, two Developers, one camp/year, incremental Sprints 0–2, npm/Prisma familiarity, approximately 200 concurrent users, and a roughly mid-October–December hosting window. The latest budget discussion uses USD 100 total infrastructure planning. Hosting figures in section 14 are historical planning estimates, not newly verified quotes or purchase approval.

These are unresolved organizer choices; do not invent production values. The baseline elsewhere in this document can guide implementation and synthetic tests while decisions are pending.

| Decision | Owner | Required before | Baseline / action |
|---|---|---|---|
| Exact fields, eligibility, age/guardian requirements | Organizer | Form implementation freeze | Approve a field dictionary including types, lengths, optionality, and contact-data ownership |
| Files, sizes, allowed formats, correction count | Organizer + Developers | Upload implementation freeze | One file/type baseline; approve limits and safe parsing/scanning approach |
| Authentication and recovery | Developers + Organizer | Auth implementation | Google login confirmed; configure OAuth clients, session limits, Staff provisioning, and Google-account recovery support |
| Registration/correction dates and capacity | Organizer | Registration launch | UTC instants plus displayed timezone; accepted-seat semantics; no implicit correction grace period |
| Final decisions, waitlist, withdrawal, self-review | Organizer | Review launch | Explicit permissions, manual waitlist promotion, no self-review or reopening baseline |
| Languages and applicant messages | Organizer | UI acceptance | English specifications do not imply an English-only participant interface |
| Notice, sensitive/minor data, retention and deletion | Organizer / designated policy owner | Any real personal data collection | Approve notice and policies, owner/contact, deletion schedule; this specification is not legal approval |
| Upload/link/retry/abuse limits | Developers | Security acceptance | Numeric values in API section 11 are proposed implementation defaults; validate provider support |
| Recovery targets and operator | Organizer + Developers | Launch | Proposed RPO <=24h and RTO <=4h; measure a full restore; approve or change before launch |
| Hosting, total cost, shutdown | Organizer + Developers | Provisioning | Recheck prices, taxes, backups, email, staging, domain and post-camp retention against USD 100; do not promise free tiers |

Launch requires closed decisions for the relevant slice, passed EC tests, actual-domain authentication checks, full backup/object restore evidence, a named incident operator, and section 15 performance thresholds. Audit and upload recovery are Sprint 1 requirements, not work deferred until Sprint 2. A single VPS is a single point of failure; the agreed RTO must include restoring it.

No finite specification proves coverage of every possible edge case. Add each discovered incident or ambiguity to this table and its test before closing it.

## 19. Authentication: Google login (confirmed)

### Identity and access

- Participant, Staff, and Admin use **Continue with Google**. Google is the only login provider in this release; no application passwords, email OTP, magic links, or local password-reset flow.
- Use Google OpenID Connect with server-side authorization-code exchange. Request only `openid email profile`; do not request Drive, Gmail, or offline access. Google login does not grant the camp permission to access Google files.
- Identify an account by Google's stable `sub`, not email/name/photo. Validate Google signature, issuer, audience, expiry, nonce, and flow state through the selected auth library before resolving the user. Require a verified email claim. These provider rules follow [Google OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect).
- Personal and Google Workspace accounts are supported by default; no school-domain restriction is assumed. An email domain/name/photo never grants a role or proves camp eligibility. Google profile data may prefill contact fields but participants confirm them; submitted answers remain frozen.
- First successful login creates one local user with Participant role only. It does not create or submit an application, acknowledge the camp notice, or reserve a seat. Draft creation continues through the application endpoint. Returning login restores the same user/application even if the Google email changes.
- Preserve normalized email uniqueness if required by the selected library. If another subject already owns the email, fail safely for operator investigation; never auto-link or transfer ownership based on matching email. One Google identity maps to one local user. Login with a different Google account is a different participant; no automatic merge or account switching inside an existing session.
- Registration dates restrict application mutations, not existing-account login/status access. Disabled local users remain blocked even after successful Google authentication. Camp closure does not revoke all sessions unless the operator explicitly retires access.

### Staff and Admin provisioning

- Staff use the same login flow. The Staff URL provides no extra privilege; users without permission receive an access-denied page.
- An authorized permission manager grants roles/capabilities to an existing local user after verifying the intended Google identity through an organizer-controlled process. Bind grants to local user ID and subject, never to a client-supplied role or an automatic email/domain allowlist.
- Bootstrap the first Admin using a restricted, audited deployment command against an already authenticated, verified local user; no public bootstrap endpoint. Preserve last-admin protection. Role elevation rotates/reissues the session or requires a fresh login, and subsequent requests read current permissions.

### Sessions, logout, and recovery

- After Google validation, issue a server-managed opaque session on `api.example.com`. Browser apps send credentialed requests to that API. Cookies are Secure, HttpOnly, host-only, Path=/, and SameSite=Lax for the redirect flow. Use exact allowed origins and CSRF protection; sibling subdomains alone are not a CSRF defense.
- Proposed implementation defaults: session idle timeout 30 minutes and absolute lifetime 12 hours for all roles, enforced server-side; OAuth transaction expiry 10 minutes. Rotate the session identifier on login and privilege elevation. Expiry requires Google login again; it does not delete saved applications.
- Logout revokes the local session and clears private browser caches; it does not sign the user out of Google. Account switching explicitly logs out locally and starts a new Google account-selection flow. Do not silently replace an authenticated identity during a callback.
- Google owns Google-password/MFA/account recovery. The camp cannot reset a Google account. Provide a support contact, but do not bypass identity checks or reassign applications based only on email/name. Manual transfer to another Google account is outside this release and needs a separately approved process.
- Google outages prevent new logins; existing valid local sessions may continue subject to local account/permission checks. Do not create a password fallback. Google logout/revocation is not guaranteed to end a local session immediately; local disablement and session revocation are the camp's immediate controls.
- Do not persist Google access/refresh tokens unless the chosen library strictly needs them for login; discard transient tokens after identity verification where supported. Never expose provider tokens, codes, secrets, or session identifiers in frontend storage, analytics, logs, or redirect URLs.

### Setup and launch acceptance

- Configure a Google Cloud OAuth web client, consent-screen branding/support/privacy URLs, and exact callback URI for each environment. Keep secrets server-side and production credentials separate from development/staging. Use the auth library's documented callback path, not a guessed route.
- Configure production access for the intended audience; a test-user-only configuration must not be mistaken for public availability. Verify any Google publishing requirements for the chosen configuration before launch.
- Test sign-in from both frontend domains, mobile redirect/back navigation, cancellation, wrong account, expired/replayed callback, blocked cookies, role denial, email collision/change, disabled accounts, and Google outages. Google authentication is identity verification; the camp Privacy Notice acknowledgement remains a separate submission requirement.
