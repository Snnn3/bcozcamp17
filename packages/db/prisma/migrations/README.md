# Prisma migrations

Generate migrations only against a PostgreSQL database that matches the local
environment configuration:

```text
npm run db:migrate
npm run db:seed
```

The schema is kept in `prisma/schema.prisma`. Migration files must be generated
and reviewed with the database contract documents, especially the lifecycle,
ownership, retry, and immutable document-version rules.
