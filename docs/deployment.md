# Prototype deployment

Human installation, task logging, contribution exercises and pilot evaluation are deferred until after deployment. Deployment evidence must identify the exact source commit and live version. It does not establish user adoption.

## Existing Vercel deployment

- Host: the owner-selected existing STAIx Vercel environment, with no additional paid service. No new database or Blob subscription is created.
- Portable Node Fetch adapter: `packages/receiver/src/vercel.mjs`. Browser assets: `packages/dashboard/public`. The root Node API entry converts the provider request to a Web Request and writes the Web Response.
- Durable aggregate storage: an operator-provisioned private GitHub repository, through `packages/receiver/src/github-store.mjs`. Repository visibility is checked before every adapter instance's first content operation. Refuse a public repository.
- Runtime secrets supply the private repository token and repository name, plus `METRICS_CREDENTIALS`, a JSON map from SHA-256 hashes of random 64-character hexadecimal bearer credentials to approved program pseudonyms. Issue a separate random credential per device. Never derive credentials or pseudonyms from personal data.
- Private source keys are derived from transport credentials; they never appear in outbound aggregate JSON or public reports.
- `MONTHLY_REQUEST_LIMIT` is 1,000 authenticated POST attempts per UTC month, enforced through optimistic compare-and-swap in the private repository. A limit rejection prevents further ingestion; at 80%, `x-budget-warning` signals operators. Invalid authenticated submissions consume a slot to bound work.
- Public fixed-month reads, authenticated revocation and authenticated `GET /v1/budget` remain available after the ingestion limit. Budget status is private. Never log request bodies or credentials.
- Snapshot replacement retries bounded write conflicts. Released months are create-once files: concurrent release creation returns the stored winning release. Months already past the cutoff cannot receive new uploads.

## Costs and stop conditions

- The application ceiling bounds accepted ingestion attempts; it is not a provider monetary ceiling. Rejected requests, public reads, static delivery and storage operations can still consume provider resources and GitHub API quotas.
- The owner chose the existing STAIx account with no additional cost. Confirm that deployment uses the existing plan and does not provision billable add-ons; report account-plan restrictions and provider limits from live readback.
- An API quota or persistent-storage failure returns a generic unavailable response, never silently falls back to ephemeral storage or fabricated results.
- Rotate or remove a credential to stop one source's ingestion. Revoke current snapshots first; removing authorization does not itself remove stored state.

## Revocation and retention

- Revocation deletes the current private snapshot file; previously published anonymous releases remain unchanged to prevent deletion differencing.
- GitHub retains earlier file contents in private commit history. Revocation does not erase private historical versions or backups. The operator must disclose this retention and define a history/backup retirement policy before collecting real-user metrics. Do not promise physical erasure from a current-file deletion.
- The private storage repository contains structured counts and transport-derived source keys, never conversation text or personal identity mappings. Approved contribution consent state uses a separate restricted namespace.

## Release and rollback

- Run automated checks on the exact final head and complete independent review before publishing.
- Supply credentials out of band. Record provider version and endpoint, then read live version metadata for the exact deployed source commit. Deployment readback is not a human workflow test.
- Roll back code only when compatible with the persisted state schema. Preserve frozen publications and withdrawal decisions; never restore withdrawn snapshots from history.
- Report actual hosting and persistence readback separately from the deferred real-user exercises.
