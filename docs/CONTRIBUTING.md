# Contribution and Coding Standards

## 1. Purpose

All Developers must follow the same formatting, naming, architecture, and review rules. Automated tools are the source of truth for formatting and linting; code should not be formatted manually in different styles.

These rules apply to the Participant Web, Staff Web, API Server, shared packages, database code, and tests.

---

## 2. Required Quality Checks

The repository must define these scripts in the root `package.json` during Sprint 0:

```text
npm run format        # Format supported source files
npm run format:check  # Fail if formatting is required
npm run lint          # Run the selected provider and project lint rules
npm run typecheck     # Run TypeScript checks
npm test              # Run unit and integration tests
npm run build         # Build all deployable applications
npm run check         # Run all required checks together
```

Every pull request must pass at least:

1. Format check
2. Lint check
3. Type check
4. Unit and integration tests
5. Build check for changed applications

The CI pipeline is the final gate. A Developer must not merge code by bypassing a failed check unless the failure is documented and approved.

Recommended tools from the project stack:

- TypeScript with strict type checking
- Node.js LTS and npm for scripts and package management
- `oxfmt` for formatting
- `oxlint` for linting
- Ultracite or the agreed shared configuration for quality rules
- Vitest and Testing Library for unit and component tests

The team must choose and configure the exact tool versions in Sprint 0 and commit the configuration files to the repository.

---

## 3. Formatting Rules

- Run the formatter before committing.
- Do not commit formatting-only differences created by different local editor settings.
- Use the repository formatter configuration as the source of truth.
- Use UTF-8 and LF line endings.
- Use two spaces for indentation unless the formatter enforces another value.
- Keep lines readable; do not disable formatting for convenience.
- Add an `.editorconfig` file and enable format-on-save in the recommended editor settings.
- Keep generated files out of manual formatting where the generator owns the format.

Example `.editorconfig` requirements:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
```

---

## 4. TypeScript Rules

- Enable `strict` mode.
- Do not use `any` in application code. Use a real type or `unknown` with validation.
- Validate all external input at the boundary with the shared validation package.
- Do not trust browser validation; the server is authoritative.
- Use explicit return types for exported functions and public service methods.
- Prefer narrow union types for statuses and actions instead of arbitrary strings.
- Do not use non-null assertions (`!`) unless the reason is documented and the value is guaranteed by an invariant.
- Avoid unsafe type assertions. Parse or validate the value instead.
- Keep environment variables typed and validated in one environment package.
- Do not expose server-only types, secrets, or database clients in browser bundles.

---

## 5. Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Variables and functions | `camelCase` | `applicationStatus` |
| Types, interfaces, classes | `PascalCase` | `ApplicationReview` |
| React components | `PascalCase` | `DocumentReviewPanel` |
| React component files | `PascalCase.tsx` | `DocumentReviewPanel.tsx` |
| Route and feature files | `kebab-case` or the framework convention | `document-review.tsx` |
| Constants | `UPPER_SNAKE_CASE` only for true constants | `MAX_FILE_SIZE_BYTES` |
| Database tables and columns | `snake_case` | `document_review_history` |
| API fields | `camelCase` unless generated from the database contract | `applicationId` |
| Test files | Match the unit plus `.test` or `.spec` | `document-review.spec.ts` |
| Environment variables | `UPPER_SNAKE_CASE` | `DATABASE_URL` |

Names should describe domain meaning. Avoid vague names such as `data`, `item`, `thing`, or `process()` when a more precise name is available.

---

## 6. Import and Module Rules

Use this import order, enforced by linting where possible:

1. Node.js built-ins
2. External packages
3. Workspace packages
4. Absolute application imports
5. Relative imports
6. Styles or side-effect imports

Additional rules:

- Use the configured path aliases instead of long relative paths.
- Do not create circular dependencies between feature modules.
- Export only the public API of a package from its entry point.
- Keep feature-specific code inside its feature directory.
- Do not import server-only modules into `apps/web` or `apps/staff`.
- Do not import database internals into browser applications.

---

## 7. Architecture Rules

### Participant Web and Staff Web

```text
route -> feature UI -> shared API client -> API Server
```

- UI components handle presentation and user interaction.
- Feature code coordinates page-specific behavior.
- Business decisions are enforced by the API Server.
- Applicant and Staff views must use different safe response shapes when their data visibility differs.

### API Server

```text
router -> policy/authentication -> service -> repository -> database/external adapter
```

- Routers translate HTTP/API requests and responses.
- Policies verify identity, effective permissions, and record ownership for the single camp.
- Services contain business rules and transaction boundaries.
- Repositories contain database access and normalized queries.
- Adapters isolate storage, email, and other external services.

Do not put database queries in route handlers or business rules in React components.

---

## 8. API and Error Conventions

- Use one shared API contract package for request and response schemas.
- Validate request bodies, query parameters, path parameters, and uploaded file metadata.
- Return stable machine-readable error codes plus safe human-readable messages.
- Do not return internal notes, storage keys, stack traces, SQL errors, or sensitive fields to applicants.
- Use idempotency for operations that may be retried, such as final application submission and document replacement.
- Include the expected version when Staff reviews or updates a document.
- Keep status transitions in the service layer and validate the allowed current state.

Example safe error shape:

```ts
type ApiError = {
  code: string;
  message: string;
  field?: string;
};
```

---

## 9. Database and File Rules

- Database table and column names follow the 3NF schema and use `snake_case`.
- Database migrations are append-only and must be reviewed before merge.
- Do not change a migration that has already been applied to a shared environment.
- Do not store uploaded applicant documents in the Git repository or application container filesystem.
- Store documents in private object storage with immutable version keys.
- Do not log passwords, access tokens, raw document contents, or raw QR credentials.
- Add an audit record for important review and status changes.
- Test participant ownership and effective Staff permissions for every sensitive endpoint, including explicit denials.

---

## 10. Testing Rules

Every feature must include tests appropriate to its risk:

- Validation tests for required fields and file rules
- Service tests for business rules and status transitions
- Permission tests for Participant, Staff, and Admin access
- Repository/integration tests for database constraints
- Component tests for important loading, error, empty, and success states
- E2E tests for the complete user journey

The confirmed Sprint 1-2 E2E flow is:

```text
Register -> upload required documents -> submit
-> Staff review -> correction reason
-> applicant sees failed document -> replacement upload
-> Staff reviews the new version
```

Tests must use fake or synthetic data only.

---

## 11. Git and Pull Request Rules

- Use one feature branch per task or feature.
- Keep pull requests small enough to review safely.
- Each Developer reviews the other Developer's pull request.
- Describe the user-visible change, database change, permission impact, and test evidence.
- Do not merge with unresolved review comments on security, data ownership, or migrations.
- Keep `main` deployable.
- Use clear commit messages, for example:

```text
feat(registration): add required document upload
fix(review): reject stale document review update
test(permissions): cover staff application isolation
docs(repo): define coding standards
```

---

## 12. Definition of Done for Code

Code is ready to merge only when:

- It is formatted by the repository formatter.
- Lint, type check, tests, and the required build pass.
- The implementation follows the repository boundaries.
- Input validation and authorization are tested.
- Loading, error, empty, and success states are handled where applicable.
- No secrets or real personal data are included.
- API, database, permission, or operational documentation is updated when affected.
- The pull request has been reviewed by the other Developer.
