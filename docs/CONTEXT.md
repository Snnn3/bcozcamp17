# Camp Registration

This context manages participant applications, required documents, and Staff review for one onsite camp in one year. The website supports registration and document review; QR/check-in and other onsite activities remain future scope.

## Language

**Camp**:
The single onsite camp supported by this deployment. Its configuration defines registration dates, required information, document rules, and accepted-participant capacity.
*Avoid*: Competition, multi-event workspace

**Participant**:
A user who can own one Application through their Participant Profile, submit required information and documents, and view their own results. The Participant role does not mean the Application has been accepted.
*Avoid*: Team Owner, Team member, accepted participant when referring to every account

**Participant Profile**:
The identity and contact information associated with a Participant's local user account. Google login identity and applicant-confirmed contact information have separate purposes.
*Avoid*: Google profile, Team profile

**Staff**:
A user who can inspect applications and review documents when granted the required camp-wide permissions. Staff access does not automatically include final decisions, internal notes, or exports.
*Avoid*: Registration Operator, Leader, Admin when referring to a reviewer

**Admin**:
A user with the administrative role who manages configuration and access when authorized. Admin actions still obey effective permissions and explicit denials.
*Avoid*: Superuser, unrestricted administrator

**Application**:
One Participant's registration entry for the Camp, owned through exactly one Participant Profile. A Participant may have zero or one Application. Application status is distinct from each Document Status.
*Avoid*: Team, registration account, document submission when referring to the whole application

**Draft**:
An Application that has not been submitted. It owns initial uploads and may contain incomplete answers. A Draft has no public Application Code and is not part of Staff review intake.
*Avoid*: Submitted Application, temporary browser form

**Application Code**:
The public reference assigned on the first successful Application submission. It is distinct from the internal Application ID and is not an access credential.
*Avoid*: Login code, QR credential

**Application Document**:
The logical document record for one Application and one Document Type. It tracks current status and the current Document Submission while retaining earlier versions.
*Avoid*: File when referring to the logical record, attachment list

**Document Type**:
A configured category of supporting document with its requiredness, allowed file rules, and replacement policy. The release baseline permits one current file per type, with historical versions.
*Avoid*: MIME type, file extension when referring to the document requirement

**Document Submission**:
An immutable, validated uploaded file version belonging to an Application Document. A replacement creates a new Document Submission rather than overwriting the previous file.
*Avoid*: Application submission, mutable attachment

**Document Review**:
An authorized Staff or Admin assessment of the current Document Submission after the Application has been submitted. Each review records its outcome and preserves history. A replacement returns the current document to pending review; the earlier review remains historical.
*Avoid*: Team Registration Review, automatic acceptance, permanent approval across replacements

**Document Status**:
The current review state of an Application Document: `not_uploaded`, `pending`, `approved`, `correction_required`, or `rejected`. Approval of a document does not accept the Application.
*Avoid*: Application Status, admission result

**Applicant-facing Reason**:
The nonblank explanation shown to the Participant when a document requires correction or is rejected. It describes the failed document without exposing Internal Notes.
*Avoid*: Internal Note, private finding, Review Issue

**Internal Note**:
Private review information available only to Staff or Admin users with the appropriate note permission. It is excluded from applicant-facing responses.
*Avoid*: Applicant-facing Reason, public feedback

**Document Replacement**:
A new Document Submission for an eligible failed document after Application submission. Permission depends on current state, replacement rules, remaining allowance, and an unexpired Correction Deadline.
*Avoid*: Overwrite, unrestricted re-upload, editing submitted answers

**Correction Deadline**:
The last instant before which an eligible replacement may complete, using the Application override or otherwise the Camp deadline. At the deadline correction is closed; without either deadline correction is disabled.
*Avoid*: Registration Deadline, grace period, unlimited correction

**Final Application Decision**:
An explicitly authorized application-level outcome, such as acceptance, rejection, or waitlisting, following the allowed transitions. Document approval alone never makes this decision.
*Avoid*: Document Review, automatic admission

**Camp Capacity**:
The maximum number of accepted Participants. Acceptance consumes a seat; submission and waitlisting do not. This is separate from the target of approximately 200 concurrent website users.
*Avoid*: Concurrent-user limit, application count, registration count

**Effective Permission**:
The authority resolved from account status, explicit user permissions, and role grants. Disabled accounts are denied; an explicit user deny overrides an allow. Ownership and self-review restrictions still apply.
*Avoid*: Role name alone, Staff URL access, Google account privilege

**Privacy Notice Acknowledgement**:
The Participant's acknowledgement of the configured camp Privacy Notice required for submission. Google login does not provide this acknowledgement.
*Avoid*: Google consent, login agreement, organizer legal approval
