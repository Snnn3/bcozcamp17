# Local infrastructure

The local stack mirrors the application boundary with PostgreSQL and a private
S3-compatible MinIO service:

```text
docker compose -f infra/docker-compose.yml up -d
npm run db:migrate
npm run db:seed
```

The Compose stack uses the official Quay.io MinIO images and runs a one-shot
initializer that creates the private
bcoz-private bucket and explicitly disables anonymous access. The application
uses STORAGE_FORCE_PATH_STYLE=true for MinIO. Keep these values in the
server-only root .env; browser applications must never receive them.

Production should use a separate private S3-compatible bucket and credentials.
Set STORAGE_FORCE_PATH_STYLE=false for Cloudflare R2 or virtual-hosted S3
endpoints, and keep all storage credentials in the server deployment secret
store.

Do not reuse these development credentials in production. PostgreSQL should not
be exposed publicly in any deployment shape.
