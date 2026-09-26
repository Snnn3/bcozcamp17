# BCOZ Camp 17 Platform

An online, responsive platform for BCOZ Camp 17. The confirmed release covers participant registration, private document upload, and Staff document review for one onsite camp.

This repository is a TypeScript/npm-workspaces monorepo. The Participant Web and Staff Web are separate React applications; both communicate with the modular-monolith API and never connect directly to PostgreSQL or private object storage.

## Example project structure

```text
.
├── apps/
│   ├── web/                    # Participant Web: registration and status
│   │   ├── src/api/            # API client boundary
│   │   └── src/features/       # Participant features
│   ├── staff/                  # Staff Web: application and document review
│   │   ├── src/api/            # Permission-aware API client boundary
│   │   └── src/features/       # Staff features
│   └── server/                 # Fastify REST API
│       └── src/
│           ├── routes/         # HTTP adapters
│           ├── policies/       # Authentication, permissions, ownership
│           ├── services/       # Business rules and transactions
│           ├── repositories/   # Prisma queries and pagination
│           └── adapters/       # Storage, identity, and external systems
├── packages/
│   ├── api/                    # Shared API contracts and error shapes
│   ├── auth/                   # Identity, roles, and permission helpers
│   ├── config/                 # Validated server environment variables
│   ├── db/                     # Prisma schema, migrations, and seed
│   ├── storage/                # Private S3-compatible storage adapter
│   ├── ui/                     # Shared responsive React components
│   └── validation/             # Shared Zod schemas and domain unions
├── docs/                       # Product, API, database, test, and team contracts
├── infra/                      # Local PostgreSQL and MinIO services
├── tests/
│   ├── e2e/                    # Playwright scenarios
│   ├── integration/            # API/service boundary tests
│   └── fixtures/               # Synthetic test data only
├── scripts/                    # Repeatable repository helpers
├── .github/workflows/          # GitHub Actions CI
├── package.json                # Workspace scripts and dependencies
├── package-lock.json           # Reproducible npm dependency lockfile
└── tsconfig.json               # Strict TypeScript configuration
```

The API request flow is intentionally layered:

```text
router -> authentication/policy -> service -> repository -> database/external adapter
```

## Technology stack

| Area | Selected technology |
|---|---|
| Language and runtime | TypeScript, Node.js LTS, npm Workspaces |
| Participant and Staff Web | React 19, Vite |
| Routing and server data | TanStack Router, TanStack Query |
| UI | Tailwind CSS, shared shadcn-style components, Lucide |
| API | Fastify, REST, Zod contracts, OpenAPI-ready boundaries |
| Database | PostgreSQL, Prisma ORM, Prisma Migrate |
| Authentication | Google OpenID Connect with a server-managed session |
| File storage | Private S3-compatible storage; MinIO locally |
| Testing | Vitest, Testing Library, Playwright |
| Code quality | Oxfmt and Oxlint with strict TypeScript checks |
| Delivery | GitHub Actions, Docker, approved container hosting |

## Prerequisites

Install the following before setting up the project:

- Git
- Node.js 24 LTS and npm 11 or newer compatible versions
- Docker Desktop with Docker Compose
- A Google OAuth application when implementing the confirmed login flow

The repository pins the expected Node major in `.nvmrc`. Do not commit real credentials, applicant information, or real documents.

## Local setup

Clone the repository and install the workspace dependencies:

```bash
git clone https://github.com/Snnn3/bcozcamp17.git
cd bcozcamp17
npm ci
```

Create the local environment file. On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

The root `.env` is server- and CLI-only. It contains the database URL, session
secret, storage credentials, and Google OAuth secret; never expose it to a
browser bundle, commit it, or copy these values into `VITE_*` variables. The
checked-in `.env.example` contains development placeholders only. `WEB_ORIGINS`
must be a comma-separated list of exact origins, such as
`http://localhost:5173,http://localhost:5174`; do not add paths, credentials,
wildcards, or query strings.

Start PostgreSQL and MinIO:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Compose creates the private `bcoz-private` MinIO bucket automatically after the
MinIO health check passes. Local storage uses path-style requests; production
storage should use a separate private S3-compatible bucket and server-only
credentials. Verify the services before running migrations:

```powershell
docker compose -f infra/docker-compose.yml ps
docker compose -f infra/docker-compose.yml exec -T postgres pg_isready -U bcoz -d bcozcamp17
curl.exe -fsS http://localhost:9000/minio/health/live
```

Use `curl` instead of `curl.exe` on macOS/Linux. The API health check becomes
available after starting the server with `npm run dev:server`:

```text
http://localhost:3000/api/v1/health
```

Generate the Prisma client, apply tracked migrations, and seed synthetic
baseline data:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

The seed command is intentionally restricted to `NODE_ENV=development` or
`test` and `BCOZ_SEED_MODE=synthetic`. It creates only synthetic users,
applications, permissions, and documents; do not add real participant
information or real uploaded files to this repository or local fixtures.

Local service endpoints:

| Service | URL |
|---|---|
| Participant Web | http://localhost:5173 |
| Staff Web | http://localhost:5174 |
| API health check | http://localhost:3000/api/v1/health |
| MinIO API | http://localhost:9000 |
| MinIO console | http://localhost:9001 |
| PostgreSQL | localhost:55432 |

## Development

Run each process in its own terminal:

```bash
npm run dev:server
npm run dev:web
npm run dev:staff
```

The current Sprint 0 shell provides responsive Participant and Staff entry pages plus the API health route. Registration, upload, authentication, and document-review behavior will be added in the Sprint 1–2 vertical slices.

### Google OAuth development setup

When testing the login flow, create a Google OAuth web client and add this
exact authorized redirect URI:

```text
http://localhost:3000/auth/google/callback
```

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
`GOOGLE_REDIRECT_URI` in the server-only `.env`, then restart the API. Keep the
client secret out of both web applications. The non-authenticated Sprint 0
shell and health route can still be developed with the Google values empty.

### Common local failures

- If ports `55432`, `9000`, `9001`, `3000`, `5173`, or `5174` are already in
  use, stop the conflicting process or change the corresponding Compose and
  application configuration consistently. The PostgreSQL container listens on
  port `5432` internally and is exposed locally as `55432` by default.
- A Prisma `P1000` error means the `.env` database credentials do not match
  the Compose credentials (`bcoz` / `bcoz_dev_password`) or the wrong host
  port is configured. Correct `.env` first; if the credentials in Compose were
  changed, recreate the local container only after confirming that local data
  can be discarded.
- A missing-table error means migrations have not been applied to the database
  selected by `DATABASE_URL`. Start Compose, run `npm run db:migrate`, and then
  run `npm run db:seed`.
- If MinIO signing or the bucket is unavailable, inspect
  `docker compose -f infra/docker-compose.yml logs minio minio-init`, bring the
  stack up again, and re-run the health check. The initializer creates a
  private bucket; it does not make objects publicly readable.
- To intentionally reset all local PostgreSQL and MinIO data, run
  `docker compose -f infra/docker-compose.yml down -v`, then repeat the start,
  migration, and seed commands. This is destructive and is not a normal
  recovery step.

## Quality checks

Run the complete local gate before committing:

```bash
npm run check
```

Individual commands are also available:

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run e2e
```

`npm run check` runs formatting, linting, strict TypeScript, Vitest, Prisma client generation, package builds, and both web application builds.

GitHub Actions uses the same Node version from `.nvmrc`, installs with
`npm ci`, starts a disposable PostgreSQL service, runs Prisma generation,
migrations, and synthetic seeding, and finishes with `npm run check`. The
local equivalent is the setup sequence above followed by `npm run check`.

## Scope and roles

- Sprint 0: project foundation and scope freeze
- Sprint 1: participant registration, required document upload, and submitted status
- Sprint 2: Staff search, application detail, document review, correction reasons, and review history
- Roles: Participant, Staff, and Admin
- One camp and one year; no Leader role

QR/check-in, missions, evaluation, buddy/group automation, and spin-wheel rewards are future scope.

## Documentation

- [Documentation index](docs/README.md)
- [Project specification](docs/PROJECT_SPEC.md)
- [API specification](docs/API_SPEC.md)
- [Database schema](docs/CAMP_DATABASE_SCHEMA.md)
- [DBML schema](docs/DBDIAGRAM_SCHEMA.dbml)
- [Test specification](docs/TEST_SPEC.md)
- [Contribution rules](docs/CONTRIBUTING.md)
- [Domain context](docs/CONTEXT.md)
- [Local infrastructure](infra/README.md)
- [CI workflow](.github/workflows/ci.yml)

Read the relevant contract before changing product behavior, API fields, persistence, permissions, or acceptance coverage. Update affected contracts together when behavior changes.
