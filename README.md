# Camp Platform

An online, responsive web platform that supports an onsite camp.

The current confirmed delivery is intentionally limited to the registration and document-review flow. The website is online; the camp itself is onsite.

## Current scope

- **Sprint 0:** project foundation and scope freeze
- **Sprint 1:** Participant registration with required document upload
- **Sprint 2:** Staff Web for application and document review
- **Target capacity:** approximately 200 concurrent users
- **Deployment model:** one camp in one year; no multi-event support
- **Roles:** Participant, Staff, and Admin
- **Authentication:** Google login for all roles; Staff/Admin permissions are granted separately by the camp
- **No Leader role**

QR/check-in, missions, evaluation, buddy/group automation, and spin-wheel rewards are future scope. The QR flow is currently TBA.

## Authoritative documentation

| Document | Purpose |
|---|---|
| [PROJECT_SPEC.md](PROJECT_SPEC.md) | Product scope, requirements, sprint plan, architecture, technology, and repository structure |
| [API_SPEC.md](API_SPEC.md) | REST API contract for Sprint 1–2 |
| [CAMP_DATABASE_SCHEMA.md](CAMP_DATABASE_SCHEMA.md) | 3NF logical database schema and integrity rules |
| [DBDIAGRAM_SCHEMA.dbml](DBDIAGRAM_SCHEMA.dbml) | DBML import file for dbdiagram.io, limited to Sprint 0–2 |
| [TEST_SPEC.md](TEST_SPEC.md) | Test levels, scenarios, security, responsive, and performance tests |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Formatting, coding, testing, and pull-request rules |

PROJECT_SPEC owns product behavior and decision status; API_SPEC owns the wire contract; CAMP_DATABASE_SCHEMA and DBML must agree on persistence; TEST_SPEC maps behavior to acceptance tests. Resolve conflicts by updating all affected documents together. PROJECT_SPEC sections 16–18 contain lifecycle rules, edge cases, and unresolved launch decisions.

This folder currently contains specifications only, not a runnable application. Commands and tests below are implementation requirements, not commands already available or test results. The 20 September 2026 revision adds explicit deadline, retry, concurrency, upload recovery, capacity, and permission rules with 20 edge-case requirement groups. Organizer-dependent settings remain visibly unapproved until recorded in the decision register.

## Team

The project is designed for two Developers. Work may be split between Web/UX and Backend/Data, but both Developers review the API contract, permissions, and end-to-end flow together.

## Development commands

The root workspace should provide:

```text
npm run format
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before adding code.
