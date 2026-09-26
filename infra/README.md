# Local infrastructure

The Compose stack provides the local services required by the API:

| Service | Local address | Purpose |
|---|---|---|
| PostgreSQL | `localhost:55432` | Prisma database; container port is `5432` |
| MinIO API | `http://localhost:9000` | Private S3-compatible object storage |
| MinIO console | `http://localhost:9001` | Local administration only |

Prerequisites are Docker Desktop with Compose, Node.js 24, and npm. From the
repository root, start the stack and verify its health:

```powershell
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps
docker compose -f infra/docker-compose.yml exec -T postgres pg_isready -U bcoz -d bcozcamp17
curl.exe -fsS http://localhost:9000/minio/health/live
```

On macOS/Linux, use `curl` instead of `curl.exe`. PostgreSQL reports healthy
only after it accepts connections. MinIO reports healthy through its live
endpoint, and the one-shot `minio-init` service waits for that health status
before creating the private `bcoz-private` bucket. The initializer also disables
anonymous access.

The root `.env` must contain the matching development values:

```text
DATABASE_URL=postgresql://bcoz:bcoz_dev_password@localhost:55432/bcozcamp17?schema=public
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_BUCKET=bcoz-private
STORAGE_ACCESS_KEY_ID=bcoz_dev_access
STORAGE_SECRET_ACCESS_KEY=bcoz_dev_secret
STORAGE_FORCE_PATH_STYLE=true
```

Keep these values server-side. Browser applications must not receive database
URLs, session secrets, storage credentials, or signed URL signing inputs.

After the services are healthy, initialize the schema with the tracked Prisma
migrations and synthetic fixtures:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
```

Seeding requires `NODE_ENV=development` or `test` and
`BCOZ_SEED_MODE=synthetic`. It is safe for local synthetic fixtures only; never
seed real participant information or documents.

`docker compose ... down` stops the services and preserves named volumes.
`docker compose ... down -v` removes the local PostgreSQL and MinIO volumes and
is a destructive reset. After a reset, run `up -d`, the health checks, and the
migration/seed commands again.

For common failures, check `docker compose -f infra/docker-compose.yml logs
minio minio-init`. A Prisma `P1000` error usually means `.env` does not match
the Compose username/password or uses port `5432` instead of the default host
mapping `55432`; a missing relation means migrations have not run against the
database named by `DATABASE_URL`. Do not reset volumes until local data may be
discarded.

Production should use a separate private S3-compatible bucket and credentials.
Set `STORAGE_FORCE_PATH_STYLE=false` for Cloudflare R2 or virtual-hosted S3
endpoints, and keep all storage credentials in the server deployment secret
store. Do not reuse these development credentials in production. PostgreSQL
should not be exposed publicly in any deployment shape.
