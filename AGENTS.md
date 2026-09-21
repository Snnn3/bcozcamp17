# Code Standards

## Project-wide agent workflow

For every code review, branch review, implementation, or bug-fix task in this repository:

1. Read `.agents/agent.md`.
2. For a review or audit, read `.agents/reviewer.md` and use `C:\Users\lchan\.agents\skills\code-review\SKILL.md`.
3. For implementation or code changes, read `.agents/coder.md` and use `C:\Users\lchan\.agents\skills\implement\SKILL.md`.
4. Follow this file and the relevant documents under `docs/`; report actual verification results.
5. Write review reports as Markdown files under the ignored `.reviews/` directory.

These role files are the project-wide local workflow. A user may narrow the task or choose a different review baseline, but the required skill and verification discipline still apply unless explicitly overridden.

This project specifies **Ultracite** plus project-specific code standards, with **Oxlint + Oxfmt** as the recommended linting and formatting tools. Configure one agreed toolchain during Sprint 0; the current workspace contains specifications only, so these tools and commands are not installed yet.

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Favor clear intent and protect participant information throughout registration and document review.

Use [CONTEXT.md](docs/CONTEXT.md) for domain language and [CONTRIBUTING.md](docs/CONTRIBUTING.md) for the full coding and review rules. Product behavior belongs to [PROJECT_SPEC.md](docs/PROJECT_SPEC.md), the wire contract to [API_SPEC.md](docs/API_SPEC.md), persistence to [CAMP_DATABASE_SCHEMA.md](docs/CAMP_DATABASE_SCHEMA.md) and [DBDIAGRAM_SCHEMA.dbml](docs/DBDIAGRAM_SCHEMA.dbml), and acceptance coverage to [TEST_SPEC.md](docs/TEST_SPEC.md). Update affected contracts together when behavior changes.

### Type Safety & Explicitness

- Enable TypeScript strict mode. Use explicit parameter types and return types for exported functions and public service methods.
- Use `unknown` with validation for unknown input; application code must not use `any`.
- Prefer type narrowing and Zod parsing over unsafe assertions. Use `as const` for literal values where appropriate.
- Model statuses and actions with narrow unions and shared schemas.
- Name constants by their domain meaning. Keep organizer-dependent values configurable and visibly provisional until approved.
- Validate environment variables centrally and keep server-only values out of browser bundles.

### Modern JavaScript/TypeScript

- Use `const` by default and `let` when reassignment is necessary.
- Use arrow functions for callbacks and short functions.
- Prefer `for...of` for iteration, destructuring for assignments, and template literals for interpolation.
- Use optional chaining and nullish coalescing when absence is valid; validate required values explicitly.
- Follow CONTRIBUTING naming conventions: camelCase API fields, snake_case database names, and PascalCase React components.

### Async & Promises

- Await or return promises so completion and failures remain observable.
- Prefer `async`/`await`; use parallel execution only for independent operations.
- Handle errors where recovery or translation is possible. Preserve useful error causes without exposing internals to applicants.
- Use synchronous Promise executors.
- Keep uploads and file scanning outside database locks. Recheck eligibility inside the short transaction that publishes a validated file pointer.

### React & JSX

- Use function components and React 19 ref props where appropriate.
- Call hooks at the top level and specify their dependencies accurately.
- Define components outside other components and use stable record IDs as list keys.
- Use TanStack Query for server data and mutations and TanStack Router for routes, following the selected scaffold.
- Handle loading, empty, error, and success states, including stale-review conflicts and unavailable corrections.
- Use semantic HTML, labeled inputs, meaningful image alternatives, visible focus, and keyboard-operable controls.
- Associate validation messages with their fields and test mobile layouts and keyboard navigation.
- Render applicant reasons and Internal Notes as text. Display only the fields authorized for the current view.

### Error Handling & Debugging

- Throw descriptive `Error` objects and translate failures into the stable API error envelope and codes.
- Prefer early returns over deeply nested error branches.
- Handle expected conflicts, expired deadlines, and retryable upload failures explicitly.
- Remove temporary debugging statements before delivery. Use structured server logs without tokens, document contents, signed URLs, or personal information.

### Code Organization

- Keep functions focused and group code by feature.
- Follow the planned boundaries: `apps/web`, `apps/staff`, `apps/server`, and the shared packages in PROJECT_SPEC section 8.
- Browser flow: route -> feature UI -> shared API client -> API Server.
- Server flow: router -> authentication/policy -> service -> repository -> database/external adapter.
- Keep business rules and transactions in services, queries in repositories, and external storage behind adapters.
- Export deliberate package APIs. Avoid broad re-export barrels and circular dependencies.
- Read PROJECT_SPEC sections 16–17 before changing lifecycle behavior, and section 19 before changing authentication. Read the later normative API and schema sections as well as their introductory examples.

### Security

- Authenticate through Google OpenID Connect and a local server-managed session; authorize each sensitive action using current effective permissions and ownership.
- Apply explicit denials to every role and prevent users from reviewing or making final decisions on their own Applications.
- Validate external input on the server using shared schemas. Browser validation is for usability.
- Keep Internal Notes and storage keys out of applicant responses. Enforce separate note read/write permissions.
- Use private object storage, scoped short-lived signed URLs, immutable validated file versions, and the specified upload recovery flow.
- Protect cookie-authenticated mutations against CSRF and configure exact allowed origins.
- Keep secrets server-side and use synthetic personal information and documents in tests.

### Performance

- Paginate application lists with stable ordering and use the indexes defined by the persistence contract.
- Avoid repeated copying of growing accumulators and unnecessary work inside loops.
- Prefer specific imports and appropriately sized images with explicit dimensions; this project does not require Next.js image components.
- Keep database transactions short and avoid external network work while holding mutation locks.
- Measure the 200-concurrent-user target against PROJECT_SPEC section 15; do not present estimates as load-test evidence.

## Testing

The specified stack is **Vitest**, **Testing Library**, and **Playwright**, with PostgreSQL and isolated private storage for integration tests. Establish the runnable setup in Sprint 0; Vite Plus, Bun, test-watch scripts, and seed commands are not current project requirements.

### Commands

The root npm workspace must provide the checks defined in CONTRIBUTING:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run check
```

These are required future scripts until a root `package.json` exists. Inspect the actual scripts before execution. Use `npm run format` to apply the configured formatter once available.

### Test Design

- Test observable behavior through the Fastify HTTP boundary, exported services/package APIs, and rendered components.
- Use plain fakes for owned collaborators in unit tests. Mock external boundaries where appropriate.
- Use real PostgreSQL transactions and isolated storage for constraints, concurrent mutations, upload recovery, and acceptance-seat races; frontend mocks cannot establish those invariants.
- Assert independent expected outcomes rather than repeating the implementation algorithm.
- Cover ownership denials, effective permissions, stale revisions, idempotent retries, deadlines, and private-field exclusion for affected sensitive operations.
- Map feature coverage to TEST_SPEC, including the edge-case matrix in section 10 and Google login cases in section 11.
- Keep assertions inside `it()` or `test()` blocks and use `async`/`await`. Remove accidental `.only` and `.skip` markers before delivery.

### TDD Loop

- For a behavior change or bug fix, write a focused failing test through the public boundary, then make the smallest implementation change that passes it.
- Work one vertical slice at a time and refactor after its behavior is green.
- For documentation-only changes, verify terminology, links, and cross-document consistency instead of adding implementation-mirroring tests.

### Verification

Run the focused tests for the change, then the applicable required checks from CONTRIBUTING. Report actual results and clearly identify unavailable checks. For documentation changes in the current specification-only workspace, application tests cannot run.

Once Git is initialized, include `git diff --check` when reviewing the patch. Preserve applied migrations and add new migrations for database changes.

## When Oxlint + Oxfmt Can't Help

Automated formatting and linting do not establish:

1. **Domain correctness** — allowed Application transitions, correction eligibility, and separation of Document Review from final decisions.
2. **Authorization and privacy** — ownership, effective permissions, self-review denial, and safe response projections.
3. **Consistency under retries** — one committed operation, immutable file versions, preserved history, and atomic seat allocation.
4. **User experience** — accessible registration, clear applicant reasons, responsive layouts, and recoverable errors.
5. **Release readiness** — approved decisions in PROJECT_SPEC section 18, real authentication checks, restore evidence, and measured load results.

Keep implementation within Sprints 0–2 unless scope is explicitly expanded. Pending organizer decisions may use the documented baseline for synthetic development; they remain unresolved for the production features they gate.

## Seed Workflow

No seed scripts exist yet. When implementing them, use synthetic fixtures and document the actual npm commands and prerequisite services. Model the selected authentication library accurately without creating local-password accounts or public Admin bootstrap routes. Production Admin bootstrap follows the restricted, audited process in PROJECT_SPEC section 19.
