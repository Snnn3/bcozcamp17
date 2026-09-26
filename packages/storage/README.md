# Private storage package

This package is server-only and provider-agnostic. It uses the AWS S3 client
interface for local MinIO and production-compatible providers such as
Cloudflare R2 or Amazon S3.

StorageObjectReference values are issued by server-side services for staging
uploads and immutable document versions. Staging keys are scoped to the owner
and upload intent. Immutable keys include the owner, logical document,
submission, and version number; they must never be overwritten after
validation.

The adapter accepts only server-issued references, verifies the owner scope,
validates the declared file name, MIME type, extension, and size against a
document policy, and creates short-lived signed URLs. Upload URLs are capped at
ten minutes and download URLs at one minute by default and maximum, matching the
API contract.

The adapter does not decide application ownership or Staff permissions. The
server policy/service layer must authorize the principal before calling it.
The dedicated access response contains only downloadUrl and expiresAt;
browser applications must never receive permanent storage credentials or raw
storage keys.
