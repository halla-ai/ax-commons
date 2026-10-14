# Install and use AX Commons

Version 0.2 adds optional contribution sharing and approved aggregate synchronization. Activity logging stays on your device. Configuring access codes never sends data automatically. Actual native installation and the five-minute installation target have not been measured; the owner will test after deployment.

## Claude Desktop extension

- Download `ax-commons.mcpb` from the [release](https://github.com/halla-ai/ax-commons/releases/latest).
- Use Claude Desktop's extension installation flow to open the file. The extension requires Node >=22.13; development and source tests require Node >=22.18.
- Read the extension description and optional configuration notice. Activity records contain fixed categories, human-review and reuse flags, an optional time estimate, and an approved skill ID. Conversation text is never captured by the logger.
- Leave the optional access codes empty for local-only use. To share, use the operator-supplied service URL, program pseudonym and separate measurement/contribution codes. Never enter a name or email as the program code.
- Run `consent_status` to inspect local records, configured routes, scoped contributions, expiry and transmission history. Native screen presentation remains unverified until the owner's post-deployment check.

## Start with a task

- Choose a [skill pack](../commons/skills/). Follow its Korean or English instructions and review the result before use.
- `declare_intent` accepts a fixed work category and reason category, rather than a free-text description.
- End the task with `log_task`: task category, whether a person checked it, whether it was reused, optional minutes and optional approved `skill_id`.
- Use `report_issue` for a fixed failure category and correction category. It does not store the conversation or a narrative of the failure.

## Optional sharing

- `submit_contribution` with `action: preview` accepts only the material you explicitly selected to contribute. It shows the exact public content and its hash; the draft remains in local memory for at most 15 minutes.
- After reviewing it, use `action: submit` with the preview ID, matching hash, `approved: true`, public scope and an expiry within 90 days. Reviewers-only scope is unavailable and is rejected.
- The client saves a random receipt ID and withdrawal credential locally before sending. If a response is lost, the result stays `publication-uncertain`; use `action: status` with that ID to reconcile. Do not blindly create another preview and submit again.
- Submissions create a review PR. `submitted` means received for review, not approved or merged. Sharing is optional and declining it has no effect on support.
- `sync_metrics` requires an approved calendar month and `approved: true`. It sends only program-keyed aggregate counts; cells below five are absent. Current/previous-month acceptance and immutable public releases are described in [the API](api.md).
- Run `revoke` for a contribution ID or metrics period. Metrics revocation permanently disables that source's period and blocks delayed uploads. Contribution removal remains pending until actual repository readback confirms it. Existing public copies and Git history cannot be recalled.

## Without local MCP

- Use the packs as plain instructions in your AI app. Omit the logging call when the server is unavailable.
- Follow the [support matrix](support-matrix.md) for app-specific capabilities. Do not infer local stdio support from a remote-connector feature.
- Use the [web contribution form](https://ax-commons.halla.ai/contribute/) with an operator-issued participation code. Its preview stays in the browser until a separate approval click.
- Download the submission record when offered. It contains the withdrawal credential; keep it private. The browser does not save it in local storage. Restore that record to check status or request withdrawal after a lost response.

## Export or delete local data

- Download the standalone `ax-commons-cli.mjs` release asset, or install the released npm tarball. Run `node ax-commons-cli.mjs path` to locate the local ledger.
- Export with `node ax-commons-cli.mjs export --out ./ledger-export.json`. Choose a destination different from the ledger and its SQLite sidecars. The export includes sanitized consent metadata and excludes withdrawal credentials.
- Revoke remote sharing first when needed, then delete with `node ax-commons-cli.mjs delete --confirm`. Local deletion does not withdraw remote contributions or erase private storage history, exported files or backups.
- Deleting the whole application data folder also removes SQLite sidecars. Removing an extension by itself does not delete local data.
- Deleting local withdrawal credentials before remote withdrawal can remove your ability to authenticate a later request. Keep the private submission record if you still need that control.

## Operator references

- [Deployment and quotas](deployment.md), [API](api.md), [schema](schema.md), [handover](handover/operator-guide.md).
- Installation success, logging/contribution rates, partner approval and outside-reader review remain unmeasured. Build and automated-test evidence is reported separately in the release record.
