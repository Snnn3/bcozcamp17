# Prisma migrations

Generate migrations only against a PostgreSQL database that matches the local
environment configuration:

```text
npm run db:migrate
npm run db:seed
```

The schema is kept in `prisma/schema.prisma`. The committed
`20260921000000_initial` migration is the reproducible Sprint 0 baseline and
must be applied before seeding. Its PostgreSQL checks and deferred triggers are
reviewed with the database contract documents, especially the lifecycle,
ownership, retry, choice-membership, and immutable document-version rules.

To verify a clean checkout, use an empty PostgreSQL database and run `npm ci`, `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed` in order. The seed creates synthetic identities, roles, permissions, one draft application, and a logical document requirement; it does not create real applicant data or upload bytes.

The seed command is synthetic-only: it requires `BCOZ_SEED_MODE=synthetic` and
`NODE_ENV=development` or `test`, and refuses production. It creates a
synthetic Admin for local verification only. First real-Admin provisioning is a
separate restricted, audited deployment process described in
`docs/PROJECT_SPEC.md` section 19.

```text
npm run db:migrate
npm run db:seed
```

Do not replace the baseline migration with a locally authored schema or edit it
after it has been applied to a shared environment. Add a new append-only
migration for later schema changes. To create a new development migration after
changing schema.prisma, run Prisma's migration authoring command directly, for
example npx prisma migrate dev --schema packages/db/prisma/schema.prisma
--name describe-the-change, then review the generated SQL before committing it.
