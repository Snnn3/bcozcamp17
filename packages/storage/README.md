# Private storage package

This package is server-only. Authorized application services issue
`StorageObjectReference` values for staging uploads and immutable document
versions. The adapter accepts only those references, verifies the owner scope,
and creates short-lived signed URLs (five minutes for uploads and one minute
for downloads by default and maximum). Browser applications must never receive
permanent storage credentials or raw storage keys.
