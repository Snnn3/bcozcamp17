# Database package

Prisma is the only database access boundary. API repositories should depend on
`createDatabaseClient()` and keep queries out of route handlers and browser apps.

The schema mirrors the normalized entities in `CAMP_DATABASE_SCHEMA.md` and uses
PostgreSQL-specific UUID, timestamp, text, and bigint types where required.
