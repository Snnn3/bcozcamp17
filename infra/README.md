# Local infrastructure

The local stack mirrors the application boundary with PostgreSQL and a private
S3-compatible MinIO service:

```text
docker compose -f infra/docker-compose.yml up -d
npm run db:migrate
npm run db:seed
```

Do not reuse these development credentials in production. PostgreSQL should not
be exposed publicly in any deployment shape.
