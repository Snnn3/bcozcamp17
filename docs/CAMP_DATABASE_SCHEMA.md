# Camp Platform Database Schema

## 1. Purpose and scope

This document defines the logical PostgreSQL schema for one online responsive website supporting one onsite camp held in one year.

This is a single-camp system. It is not designed to store multiple camp events or future yearly events.

The confirmed flow is:

~~~text
Registration -> Required Documents -> Staff Review
             -> Applicant Feedback -> Replacement Upload
~~~

This is a logical design, not executable DDL. The implementation should use Prisma migrations and preserve the constraints described here.

### Included in Sprint 0–2

- One-camp configuration
- Users, roles, and permissions
- Participant profiles
- Registration fields and answers
- Applications and application status history
- Required document configuration
- Private document uploads and immutable versions
- Per-document Staff review and applicant feedback
- In-app notifications
- Audit logs

### Not included

QR/check-in, missions, evaluation, buddy/group assignment, and spin-wheel rewards are future modules and must not be included in the Sprint 0–2 migration set.

There is no Leader role.

## 2. Database conventions

- PostgreSQL
- UUID primary keys
- timestamptz for timestamps; store UTC values
- snake_case table and column names
- Foreign keys for concrete relationships; polymorphic audit/result references require explicit service integrity checks
- Private object storage for uploaded files; file contents are not stored in PostgreSQL
- Authentication-provider account/session tables may be managed outside this schema
- Repeating and multi-value business data uses child or junction tables, not comma-separated values or JSONB
- Previous document versions and review decisions are retained
- camp_settings contains exactly one row, enforced by the seed/migration and application startup check
- There is no event_id column because the database has only one camp

## 3. Third Normal Form rules

The schema targets Third Normal Form (3NF):

1. Every table has a primary key.
2. Every non-key attribute depends on the whole key.
3. No non-key attribute determines another non-key attribute.
4. Repeating values are moved into child tables.
5. Many-to-many relationships use junction tables.
6. Lookup values such as roles, permissions, form options, and MIME types use separate tables.
7. Derived values such as the latest upload are calculated from normalized rows rather than duplicated.

application_documents.status and application_documents.applicant_message are intentional current-state projections. They must be updated atomically with their history records.

## 4. Entity relationship overview

~~~mermaid
erDiagram
    USERS ||--o| PARTICIPANT_PROFILES : owns
    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : assigns
    ROLES ||--o{ ROLE_PERMISSIONS : grants
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : contains
    USERS ||--o{ USER_PERMISSIONS : receives
    PERMISSIONS ||--o{ USER_PERMISSIONS : grants
    APPLICATION_FIELDS ||--o{ APPLICATION_FIELD_OPTIONS : has
    APPLICATIONS ||--o{ APPLICATION_ANSWERS : has
    APPLICATION_FIELDS ||--o{ APPLICATION_ANSWERS : receives
    APPLICATION_ANSWERS ||--o{ APPLICATION_ANSWER_OPTIONS : selects
    APPLICATION_FIELD_OPTIONS ||--o{ APPLICATION_ANSWER_OPTIONS : selected
    PARTICIPANT_PROFILES ||--o{ APPLICATIONS : submits
    APPLICATIONS ||--o{ APPLICATION_STATUS_HISTORY : records
    APPLICATIONS ||--o{ APPLICATION_DOCUMENTS : requires
    DOCUMENT_TYPES ||--o{ APPLICATION_DOCUMENTS : defines
    DOCUMENT_TYPES ||--o{ DOCUMENT_TYPE_MIME_TYPES : accepts
    MIME_TYPES ||--o{ DOCUMENT_TYPE_MIME_TYPES : allows
    APPLICATION_DOCUMENTS ||--o{ DOCUMENT_SUBMISSIONS : versions
    APPLICATION_DOCUMENTS ||--o{ DOCUMENT_REVIEW_HISTORY : reviews
    USERS ||--o{ IN_APP_NOTIFICATIONS : receives
    IN_APP_NOTIFICATIONS ||--o{ NOTIFICATION_APPLICATIONS : references
    IN_APP_NOTIFICATIONS ||--o{ NOTIFICATION_DOCUMENTS : references
    USERS ||--o{ AUDIT_LOGS : creates
    AUDIT_LOGS ||--o{ AUDIT_LOG_VALUES : changes
~~~

camp_settings is a singleton configuration table and is intentionally not repeated as a foreign key on every table.

## 5. Status values

### Camp status

~~~text
draft
registration_open
registration_closed
archived
~~~

### User status

~~~text
active
disabled
~~~

### Application status

~~~text
draft
submitted
reviewing
action_required
resubmitted
accepted
rejected
waitlisted
withdrawn
~~~

### Document status

~~~text
not_uploaded
pending
approved
correction_required
rejected
~~~

correction_required normally allows a replacement. rejected may be final when replacement is not allowed by policy.

## 6. Camp configuration and access tables

### camp_settings

Stores the configuration for the one camp. The database must contain exactly one row.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key; exactly one seeded row |
| name | varchar(255) | Required |
| status | varchar(30) | Required camp status |
| timezone | varchar(64) | Required IANA timezone |
| capacity | integer | Required, positive |
| registration_opens_at | timestamptz | Required |
| registration_closes_at | timestamptz | Required, after opening |
| correction_closes_at | timestamptz | Optional |
| starts_at | timestamptz | Required |
| ends_at | timestamptz | Required, after start |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |

### users

Stores local identities authenticated by Google. Sessions and provider-account bookkeeping use the selected auth library's migrations; there are no local password credentials.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| google_subject | varchar(255) | Required unique Google sub; immutable identity key, never email |
| email | varchar(320) | Required normalized verified Google email; unique; collisions fail safely, never auto-link |
| status | varchar(30) | Required user status |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |

### roles

Stores the three supported roles.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| code | varchar(30) | Required, unique; participant, staff, or admin |
| name | varchar(100) | Required display name |

### user_roles

Assigns roles globally because there is only one camp.

| Column | Type | Rules |
|---|---|---|
| user_id | uuid | FK to users |
| role_id | uuid | FK to roles |
| created_at | timestamptz | Required |

Primary key:

~~~sql
PRIMARY KEY (user_id, role_id)
~~~

### permissions

Defines named actions such as application_read, document_review, application_final_decision, and export_applications.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| code | varchar(100) | Required, unique |
| name | varchar(150) | Required |

### role_permissions

Defines baseline permissions for each role.

| Column | Type | Rules |
|---|---|---|
| role_id | uuid | FK to roles |
| permission_id | uuid | FK to permissions |

Primary key:

~~~sql
PRIMARY KEY (role_id, permission_id)
~~~

### user_permissions

Stores explicit user-level grants or denials.

| Column | Type | Rules |
|---|---|---|
| user_id | uuid | FK to users |
| permission_id | uuid | FK to permissions |
| effect | varchar(20) | allow or deny |
| granted_by | uuid | FK to users |
| created_at | timestamptz | Required |

Primary key:

~~~sql
PRIMARY KEY (user_id, permission_id)
~~~

### participant_profiles

Stores participant information separately from login identity.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK to users, unique |
| full_name | varchar(255) | Nullable in draft; required at submission |
| contact_email | varchar(320) | Nullable in draft; required at submission |
| phone | varchar(50) | Nullable in draft; required at submission |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |

## 7. Registration and application tables

### application_fields

Defines configurable registration fields for the one camp.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| field_code | varchar(100) | Required, unique |
| label | varchar(255) | Required |
| data_type | varchar(30) | text, number, date, boolean, single_choice, or multi_choice |
| is_required | boolean | Required |
| is_active | boolean | Required |
| display_order | integer | Required, nonnegative |

### application_field_options

Defines options for choice fields.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| field_id | uuid | FK to application_fields |
| option_code | varchar(100) | Required |
| label | varchar(255) | Required |
| display_order | integer | Required, nonnegative |

Constraint:

~~~sql
UNIQUE (field_id, option_code)
~~~

### applications

Stores one application per participant.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| participant_id | uuid | FK to participant_profiles |
| application_code | varchar(100) | Required after final submission, globally unique |
| status | varchar(30) | Required application status |
| version | integer | Required, starts at 1 |
| submitted_at | timestamptz | Optional until submission |
| correction_deadline | timestamptz | Optional; if null, inherit camp_settings |
| privacy_notice_version | varchar(50) | Required before final submission |
| privacy_acknowledged_at | timestamptz | Required before final submission |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |

Constraints:

~~~sql
UNIQUE (participant_id)
UNIQUE (application_code)
~~~

### application_answers

Stores one scalar answer for one application field. Multi-choice values use application_answer_options.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| application_id | uuid | FK to applications |
| field_id | uuid | FK to application_fields |
| answer_text | text | Optional when using choice junction rows |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |

Constraint:

~~~sql
UNIQUE (application_id, field_id)
~~~

### application_answer_options

Stores selected options for single_choice and multi_choice fields.

| Column | Type | Rules |
|---|---|---|
| answer_id | uuid | FK to application_answers |
| option_id | uuid | FK to application_field_options |

Primary key:

~~~sql
PRIMARY KEY (answer_id, option_id)
~~~

The service or database constraint must ensure that an option belongs to the field used by the answer.

### application_status_history

Stores every overall application status change.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| application_id | uuid | FK to applications |
| from_status | varchar(30) | Nullable for initial status |
| to_status | varchar(30) | Required |
| reason | text | Optional unless policy requires it |
| changed_by | uuid | FK to users |
| created_at | timestamptz | Required |

## 8. Document configuration and review tables

### document_types

Defines the documents required by the one camp.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| code | varchar(100) | Required, unique |
| name | varchar(255) | Required |
| is_required | boolean | Required |
| max_size_bytes | bigint | Required, positive |
| max_count | integer | Required; CHECK = 1 for this release; versions are not simultaneous file count |
| replacement_allowed | boolean | Required |
| is_active | boolean | Required |
| display_order | integer | Required, nonnegative |

### mime_types

Stores allowed file content types.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| code | varchar(100) | Required, unique MIME type |
| description | varchar(255) | Required |

### document_type_mime_types

Junction table for allowed MIME types.

| Column | Type | Rules |
|---|---|---|
| document_type_id | uuid | FK to document_types |
| mime_type_id | uuid | FK to mime_types |

Primary key:

~~~sql
PRIMARY KEY (document_type_id, mime_type_id)
~~~

### application_documents

Represents one logical required document for one application and stores its current applicant-visible state.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| application_id | uuid | FK to applications |
| document_type_id | uuid | FK to document_types |
| status | varchar(30) | Required document status |
| applicant_message | text | Nullable; visible to applicant when action is required |
| replacement_allowed | boolean | Required |
| current_submission_id | uuid | Nullable FK to document_submissions |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |

Constraint:

~~~sql
UNIQUE (application_id, document_type_id)
~~~

### document_submissions

Stores every uploaded document version. Existing versions are never overwritten.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| application_document_id | uuid | FK to application_documents |
| version_number | integer | Required, positive |
| storage_key | varchar(500) | Required, unique and private |
| original_filename | varchar(255) | Required |
| mime_type | varchar(100) | Required, detected server-side |
| size_bytes | bigint | Required, positive |
| checksum | varchar(128) | Required server-computed SHA-256 |
| uploaded_by | uuid | FK to users |
| uploaded_at | timestamptz | Required |

Constraint:

~~~sql
UNIQUE (application_document_id, version_number)
~~~

### document_review_history

Stores every Staff/Admin decision for a document version.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| application_document_id | uuid | FK to application_documents |
| submission_id | uuid | FK to document_submissions |
| reviewer_id | uuid | FK to users |
| status | varchar(30) | approved, correction_required, or rejected |
| applicant_message | text | Required for failed statuses |
| internal_note | text | Optional; Staff/Admin only |
| created_at | timestamptz | Required |

Rules:

1. A review must reference the document version that was actually reviewed.
2. correction_required and rejected require a nonblank applicant_message.
3. internal_note must never be returned by applicant-facing APIs.
4. A stale review must return a conflict instead of overwriting a newer version.

## 9. Notifications and audit tables

### in_app_notifications

Stores messages shown inside the website.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| type | varchar(50) | Required notification type |
| title | varchar(255) | Required |
| message | text | Required |
| is_read | boolean | Required |
| created_at | timestamptz | Required |
| read_at | timestamptz | Nullable |

### notification_applications

Links a notification to an application.

| Column | Type | Rules |
|---|---|---|
| notification_id | uuid | FK to in_app_notifications |
| application_id | uuid | FK to applications |

Primary key:

~~~sql
PRIMARY KEY (notification_id, application_id)
~~~

### notification_documents

Links a notification to a reviewed document.

| Column | Type | Rules |
|---|---|---|
| notification_id | uuid | FK to in_app_notifications |
| application_document_id | uuid | FK to application_documents |

Primary key:

~~~sql
PRIMARY KEY (notification_id, application_document_id)
~~~

Recommended notification types:

~~~text
application_submitted
document_action_required
document_reviewed
replacement_received
application_status_changed
~~~

### audit_logs

Stores important user and system actions.

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| actor_id | uuid | Nullable FK to users for system actions |
| action | varchar(100) | Required |
| entity_type | varchar(100) | Required |
| entity_id | uuid | Required |
| created_at | timestamptz | Required |

### audit_log_values

Stores scalar changes without putting a JSON object inside audit_logs.

| Column | Type | Rules |
|---|---|---|
| audit_log_id | uuid | FK to audit_logs |
| attribute_name | varchar(100) | Required |
| old_value_text | text | Nullable |
| new_value_text | text | Nullable |

Primary key:

~~~sql
PRIMARY KEY (audit_log_id, attribute_name)
~~~

Do not store passwords, access tokens, raw document contents, or private storage credentials in audit logs.

## 10. Required constraints and indexes

### Required constraints

- One application per participant.
- One application code globally.
- One logical document record per application and document type.
- One upload version number per logical document.
- A current document submission must belong to its logical document.
- A selected option must belong to the answer's field.
- Review history must reference the reviewed document version.
- Required statuses must use the allowed status values.
- Camp closing timestamps must be after opening timestamps.
- File sizes, counts, capacities, versions, and display orders must be positive or nonnegative as appropriate.
- Exactly one camp_settings row must exist.

### Recommended indexes

~~~text
applications (status)
applications (application_code)
applications (participant_id)
application_fields (display_order)
application_answers (application_id, field_id)
application_documents (application_id, status)
document_submissions (application_document_id, version_number)
document_review_history (application_document_id, created_at)
in_app_notifications (user_id, is_read, created_at)
notification_applications (application_id, notification_id)
notification_documents (application_document_id, notification_id)
audit_logs (entity_type, entity_id, created_at)
~~~

## 11. Integrity and transaction rules

### Ownership and permission scope

- Participants can read and modify only their own application.
- Staff/Admin access is controlled by global role and permission checks.
- Application answers must reference fields that exist in the single camp configuration.
- Document requirements must reference document types from the single camp configuration.
- Selected options must belong to the answer's field.
- Notification links must refer to records visible to the recipient.

### Final submission transaction

1. Acquire actor authorization and camp/application locks in the order defined in section 15.
2. Verify registration is open in camp_settings.
3. Verify the application is editable.
4. Verify all required answers and validated required uploads exist.
5. Record the privacy-notice version and acknowledgement.
6. Set status to submitted, create the application code, and insert status history.
7. Create an audit record.
8. Commit before returning the result.

A retry of the same final submission must return the existing submitted application and must not create a duplicate.

### Upload completion transaction

1. Verify the upload belongs to the participant and application.
2. Prepare and validate immutable private storage content, size, detected MIME type, and checksum outside DB locks; then acquire section 15 locks and recheck intent, revision, deadline, and eligibility.
3. Create a new document_submissions row with the next version number.
4. Update application_documents.current_submission_id and set status to pending.
5. Clear only the current applicant message; preserve review history.
6. Increment document/application revisions and applicable replacement count; recalculate application status, then write history, audit, completed intent, and retry receipt atomically.

Failed or abandoned uploads must not replace the previous valid version.

### Document review transaction

1. Acquire actor authorization, camp, application, then logical document locks in the section 15 order.
2. Verify Staff/Admin permission, expected application version, current submission ID, and logical document revision (including same-file concurrent reviews).
3. Reject the request with a stale-version conflict if a newer version exists.
4. Update current document status and applicant message.
5. Insert document_review_history and audit_logs rows.
6. Recalculate the application state using PROJECT_SPEC section 16, increment document/application revisions, and record any status transition.
7. Create an in-app notification in the same transaction.
8. Commit before returning the review result.

A document review must not silently change a final application decision.

## 12. Applicant status page projection

The applicant-safe query should return:

~~~text
application
├── application_code
├── overall_status
├── correction_deadline
└── documents[]
    ├── document_type
    ├── status
    ├── applicant_message
    ├── replacement_allowed
    └── latest_submission_metadata
~~~

It must not return internal notes, raw storage keys, private URLs, unrelated applicants, or reviewer-only data.

## 13. Implementation order

### Sprint 0

1. Create the single camp_settings row.
2. Create users, roles, permissions, user_roles, user_permissions, and participant_profiles.
3. Create the Prisma schema and clean-database migration.
4. Seed the three roles and the minimum permissions.
5. Add ownership and status constraints.

### Sprint 1

1. Add application fields and field options.
2. Add applications, answers, answer options, and application status history.
3. Add document types, MIME types, document requirements, submissions, and private-storage integration.
4. Add submission transaction and idempotency tests.

### Sprint 2

1. Add document review history and applicant feedback.
2. Add in-app notifications.
3. Extend the audit foundation delivered in Sprint 1 with review transaction safeguards.
4. Verify permission isolation, stale-review conflicts, replacement versions, and applicant-safe queries.

## 14. 3NF validation examples

| Relation | Functional dependency | Reason |
|---|---|---|
| applications | application_id -> participant_id, status, application_code | Application attributes depend on the application key |
| application_answers | answer_id -> application_id, field_id, answer_text | One answer stores one field value |
| application_documents | application_document_id -> application_id, document_type_id, status | Current document state belongs to one logical requirement |
| document_submissions | submission_id -> application_document_id, version_number, storage_key, file_metadata | Each upload version belongs to one logical document |
| document_type_mime_types | (document_type_id, mime_type_id) -> no non-key attributes | Pure many-to-many junction |
| application_answer_options | (answer_id, option_id) -> no non-key attributes | Pure many-to-many junction |
| document_review_history | review_id -> document, submission, reviewer, decision, feedback | Each review is one historical event |
| audit_log_values | (audit_log_id, attribute_name) -> old_value, new_value | One row stores one changed attribute |

The schema avoids common denormalization problems:

- MIME types are stored in a junction table, not a comma-separated column.
- Choice selections are stored in option tables, not JSON arrays.
- Document history is stored as version rows, not overwritten columns.
- Notification references use junction tables.
- Audit changes use one scalar attribute per row.

## 15. Persistence required by lifecycle and retry contracts

This section and the matching DBML complete the earlier logical model. DBML documents shape; migration SQL and integration tests must enforce checks/triggers that DBML cannot express. PROJECT_SPEC sections 16–18 define product semantics; API_SPEC section 11 defines wire behavior.

### Additional columns

| Table | Columns | Constraint / purpose |
|---|---|---|
| camp_settings | singleton_key smallint, version integer, privacy_notice_version varchar(50), privacy_notice_url text | singleton_key defaults to 1, UNIQUE and CHECK =1; version positive and incremented on operational changes; published notice required before opening |
| document_types | max_replacements integer | Required nonnegative post-submission completion allowance per document |
| application_documents | version integer, replacement_count integer | Required defaults 1 and 0; positive revision, nonnegative count; atomic updates under lock |
| document_review_history | document_version integer, replacement_allowed boolean | Required resulting logical revision (unique per document) and reviewer flag at that decision |

The published form/file policy is frozen while applications exist. This avoids an unimplemented per-application configuration snapshot system. Operational version changes invalidate stale new requests; committed receipts still replay. Archive the published configuration and notice in the deployment records without personal data.

### upload_intents

| Column | Type | Constraint / purpose |
|---|---|---|
| id | uuid | PK; unguessability does not replace authorization |
| application_document_id | uuid | Required FK |
| uploaded_by | uuid | Required FK users |
| base_document_version | integer | Positive document revision captured when intent issued |
| configuration_version | integer | Positive configuration revision at issuance |
| staging_key | varchar(500) | Required unique private object key |
| immutable_key | varchar(500) | Nullable unique prepared object key, server-only writes |
| original_filename | varchar(255) | Required sanitized display name |
| declared_mime_type | varchar(100) | Required; not trusted as detected type |
| declared_size_bytes | bigint | Required positive; actual validation still required |
| status | varchar(20) | issued, validating, completed, failed, expired |
| failure_code | varchar(100) | Nullable safe code, never raw storage/parser error |
| result_submission_id | uuid | Nullable FK document_submissions, unique; required iff completed |
| created_at, expires_at | timestamptz | Required; expiry after creation |
| lease_expires_at | timestamptz | Nullable processing lease for crash recovery |
| completed_at | timestamptz | Required iff completed |

Index `(status, expires_at)` for reconciliation and `(uploaded_by, status)` for quotas. Check that result submission belongs to the intent document and uploader. Capture authoritative checksum/detected MIME/actual size in the immutable submission, never trust declared values. Enforce one completed result per intent regardless of retry key. A lease permits only one validator to publish a result; reclaimed workers must verify lease ownership before commit.

### idempotency_records

| Column | Type | Constraint / purpose |
|---|---|---|
| id | uuid | PK |
| actor_id | uuid | Required FK users |
| operation_scope | varchar(255) | Required canonical method + route + resource |
| key | varchar(128) | Required request key |
| request_hash | varchar(64) | Required SHA-256 canonical request hash |
| result_type | varchar(50) | Required allowlisted operation type |
| result_id | uuid | Required reference to durable operation result |
| result_application_version | integer | Nullable positive revision in the original receipt |
| result_document_version | integer | Nullable positive revision in the original receipt |
| http_status | integer | Required original success status |
| created_at, expires_at | timestamptz | Required; expiry follows receipt retention policy |

Unique `(actor_id, operation_scope, key)`; index expires_at. Record only committed success receipts in the same transaction as the mutation. Use transaction-level serialization for in-flight duplicate keys; a durable partially committed receipt is prohibited. `result_type/result_id` is an explicitly polymorphic service-enforced reference, not a claimed database FK; integration tests must verify targets exist. Results identify submission/status-history/review rows as appropriate. Do not store response JSON, signed URLs, internal notes, or complete form bodies here. Construct replay receipts from immutable result metadata and current authorization.

### Constraints and locking not captured by simple foreign keys

1. At most one camp row is enforced by the singleton key. Seed creates exactly one; readiness fails if absent; the runtime DB role cannot delete it. A UNIQUE constraint alone cannot ensure at least one row.
2. Use composite foreign keys or constraint triggers to ensure current submission and reviewed submission belong to the specified logical document. The existing simple FKs only prove existence. Preserve the circular current-pointer relationship by creating a document with null pointer, then inserting a submission, then updating the pointer in one transaction.
3. Enforce `not_uploaded` iff current pointer is null. All other document statuses require a pointer. Failed statuses require trimmed messages. Positive submission size/version, unique per-document file version, and unique review revision are mandatory. Authoritative checksum is required for new submissions.
4. Answer choice/field membership and single-choice cardinality need a deferred constraint trigger or normalized composite keys plus a transactionally enforced cardinality check. Non-choice answers cannot have option rows; choice answers cannot also store scalar text. Services validate type/length/domain values on every write. Historical referenced fields/options cannot be deleted.
5. Submitted applications require code, submitted_at, notice version, and server acknowledgement timestamp. Drafts have no code or submission timestamp. Nullable profile values are permitted only until final validation. All versions are positive; counts are nonnegative. `max_count=1` is a CHECK, not merely a UI limit.
6. Serialize mutations in order: authorization locks for affected actors (sorted by ID), camp_settings row, application row, document rows sorted by ID, upload intent row; lock only the rows needed, but never invert the order. Permission changes and mutations share the actor authorization lock so revocation cannot race a subsequent commit. Last-admin changes additionally serialize on the camp row and recheck the active manager count. No external calls inside these locks. This simple camp lock is acceptable only if the load test passes; later lock refinement must retain the invariants.
7. Acceptance counts accepted rows while holding the camp lock; release/accept/capacity changes use that same lock. Increment application/document versions with conditional writes and assert affected row count. Generate application codes using a unique sequence/random identifier with collision retry, never `COUNT(*)+1`.
8. Audit, status history, review history, counters, notification rows when applicable, current pointers, and success receipts commit atomically. A failed history/audit insert rolls back the business write. Audit exists from Sprint 1.
9. Runtime roles cannot mutate/delete histories directly. Foreign keys restrict deletion of referenced history/configuration. Approved retention cleanup is a separate privileged, audited process with a retryable deletion manifest; privacy deletion is not permanently prohibited by append-only history requirements.
10. Audit scalar values are allowlisted metadata only: status, revisions, policy changes, and opaque IDs. Do not copy private answers, contact details, notes, tokens, or document text into audit values. A grant's reason belongs in controlled audit metadata.

The selected provider integration is Google's `google-auth-library`; it verifies
provider tokens but does not own local application sessions. The application
therefore owns the append-only Prisma migration for `auth_sessions` and
`auth_oauth_transactions`, which are intentionally outside this domain DBML.
Those migrations must be applied and verified alongside the domain migration.
Do not build a second password/session system merely because these tables are
absent from this diagram.

Google is the confirmed provider. `users.google_subject` is required and unique; simultaneous callbacks must resolve one local user. If the library also stores provider/account rows, bind `(provider = google, providerAccountId = sub)` uniquely to that same user in one transaction. Do not allow those rows and the domain subject to disagree. Sessions reference local users and support server-side expiry/revocation. Persist only minimal verified identity metadata; optional Google photos are not required application data.

A subject's email change updates login metadata only and never changes participant ID, permissions, or submitted contact answers. If the new email collides with another subject, deny that sign-in for operator investigation without merging, moving applications, or partially updating records. Roles are assigned by the camp, never copied from Google claims. Provider-account linking to other subjects/providers and local password records are disabled in this release.

Required restore rehearsal includes immutable objects as well as PostgreSQL: detect broken pointers, reconcile intents/orphans, replay the retention deletion manifest, and verify authorization before opening writes. An object filename or DB backup alone is not a complete recovery plan.
