# Operator guide

This package supports technical handover. It does not establish successful participant adoption or approval by a data-protection officer. The owner has deferred real-user testing until after deployment.

## Read first

- [Approved design](../specs/2026-10-14-ax-commons-design.md): boundaries and intended data flows.
- [Contribution rules](../../CONTRIBUTING.md): approval, licenses and withdrawal.
- [Review rules](../../REVIEW.md): blocking checks and human review.
- [Privacy review](privacy-review.md): adoption questions and technical checks.
- [Mirroring and withdrawal](mirroring-withdrawal.md): operator procedures.
- [Evidence summary](evidence-summary.md): what has and has not been established.

## Release inventory

Planned release: `0.2.0`. Intended production endpoint: `https://ax-commons.halla.ai`. Production deployment and live version readback are pending; this address is not evidence that the release is live. Automated full CI and final independent review are also pending on the final integrated commit.

Before deployment or handover, record the exact release tag and commit, artifact hashes, installed package version, hosting account, endpoint and responsible operator in the operator's own deployment record. Keep credentials outside the repository. A deployed endpoint alone does not prove the full workflow works.

| Component | Handover dependency |
| --- | --- |
| Local MCP server and desktop extension | Source implemented; [installation guide](../install.md), ledger tests and desktop package; human five-minute installation remains NOT MEASURED |
| Approved contribution flow and commons checks | Source implemented; [contribution boundary](../../packages/contributions/README.md), [hosted protocol](../../packages/hosted/README.md), [MCP bridge](../../packages/mcp-bridge/README.md); final release CI pending |
| Aggregation receiver and dashboard | Source implemented; [API](../api.md), [schema](../schema.md), [deployment](../deployment.md); production deployment/readback pending |
| Five domain skill packs and pilot materials | Available in [commons skills](../../commons/skills/) and [pilot guide](../pilot/facilitator-guide.md); domain approval and participant testing remain pending |

Use the linked implementation documents for endpoint paths, authentication, configuration and local export/delete commands. Reconcile their wording against the final release before distributing participant instructions. Source documentation alone does not prove deployment or participant use.

## Prepare an operator deployment

- Assign an operations owner, domain reviewers and a private incident/withdrawal contact. Document service ownership, hosting region, approved budget, retention and deletion schedule.
- Select supported app routes using the [support matrix](../support-matrix.md). Distinguish local MCP support from skills used as plain instructions.
- Use the [installation](../install.md) and [deployment](../deployment.md) instructions for the selected release. Preserve a previous known release for rollback; do not restore revoked content or stale consent when rolling back.
- Fill the [participation notice](../pilot/consent-notice.md) with the program, dates, responsible contact, retention period and recipients before measuring participants. Its preparation wording must match the released feature set before use.
- Offer the standalone skill route when MCP is unavailable. Record that route separately. Declining optional sharing must not affect access to training or support.
- The implemented contribution flow requires exact-content preview, explicit approval, public scope and expiry. Keep sharing disabled until operator credentials and the released endpoint are configured. The client saves its UUID and withdrawal key before HTTP; retain these to recover from a lost response. Identical retries do not publish twice. See the [hosted contract](../../packages/hosted/README.md).
- Accept `reviewers-only` only when the release has a private review intake. Never route this scope to a public repository, mirror or public form.

## Routine operations

- Observe service availability, rejection categories and aggregate health without recording request bodies, contribution previews or conversations in logs. Disable body capture in hosting, error reporting and analytics layers as well as application code.
- Keep source/schema validation and privacy checks mandatory in the release process. Test failures block publication; human review remains necessary for identifying context that pattern checks miss.
- Use fixed monthly aggregates keyed by random pseudonymous program IDs. The receiver derives source keys privately from authorization; no device/source identifier appears in wire payloads or public reports. Cells below five are omitted, with no alternate totals or rankings. Monthly public releases are frozen. See the [API](../api.md) and [schema](../schema.md) for the limits of activity-count suppression.
- Follow the released export/delete procedure for each local ledger. Exports and backups need separate deletion. Uninstalling an extension is not proof of record deletion.
- Track pending withdrawal and expiry work through the [withdrawal procedure](mirroring-withdrawal.md), including each operator-controlled mirror. Hosted publication has a two-minute recovery lease; hourly cron reconciles expired/requested/uncertain work. Already merged public content remains pending until a maintainer merges its removal PR and readback confirms absence.

## Cost controls

- Use the existing Vercel account and private GitHub state repository; provision no paid database or add-ons. The [deployment guide](../deployment.md) records configuration requirements.
- Durable shared application quota limits approved contribution attempts and authenticated metrics attempts to 1,000 per UTC month; responses warn at 80%. Status, withdrawal and expiry recovery remain available after ingestion stops. Invalid or unapproved contributions do not consume contribution quota.
- App quota is not a Vercel Pro billing ceiling: public/static traffic, rejected requests and GitHub operations can still consume resources. Provider billing-monitor source is being added; its live configuration and observed behavior remain pending. Do not promise zero overage from the app quota or absence of new paid services.

## Incident and rollback

- If personal data, a secret or conversation text appears in an outbound artifact, suspend the affected sharing or publication route and restrict access. Preserve only the minimum incident evidence in private storage.
- Notify the responsible operator and data-protection contact through their approved private route. Do not paste the payload into a public issue, CI log or support message.
- Rotate exposed credentials when needed. Remove affected current content and request host/cache takedown; Git history handling is an exceptional PII/legal process under the contribution rules.
- Roll back application code to the recorded prior release while preserving withdrawal/expiry decisions. Check schema compatibility first; do not overwrite a ledger or receiver database with an older schema.
- Record the fix and its automated checks at the exact replacement commit. Participant testing remains deferred to the owner's post-deployment test.

## Handover completion

- Provide the release/deployment record, applicable API/schema documents, check results and unresolved limitations alongside these documents.
- The owner chooses an outside operator reader and data-protection reviewer. Record their questions and the document changes that answer them without retaining participant data.
- Issue #7 AC1 remains pending until that outside review occurs. Preparing this guide alone does not satisfy it.
