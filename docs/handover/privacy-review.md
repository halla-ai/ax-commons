# Consent and privacy review material

This is a technical review checklist for an operator and data-protection officer. It is not a legal opinion, a completed impact assessment or a claim of regulatory compliance. Apply it to the exact deployed release and the operator's actual processing arrangements.

## Data-flow review

The following maps the [approved design](../specs/2026-10-14-ax-commons-design.md) to current integration source. See the [API](../api.md), [schema](../schema.md), [hosted protocol](../../packages/hosted/README.md) and [MCP bridge](../../packages/mcp-bridge/README.md). Release CI and production source identity are recorded in the [evidence summary](evidence-summary.md). These do not establish actual participant approval, operational retention or deployed control effectiveness.

| Flow | Allowed material | Review question |
| --- | --- | --- |
| Local task ledger | Coarse categories, attempts, review/reuse flags, optional duration estimates and local consent records | Do schemas reject conversation text and identifiers, including metadata and error paths? |
| Aggregate synchronization | Period counts with cells below five suppressed, keyed by pseudonymous program IDs | Can totals, complementary rates, repeated uploads or combined views reconstruct a suppressed cell? |
| Contribution submission | Only the exact contribution previewed and approved with scope and expiry | Does approval bind to immutable content, destination and period, with no send before approval? |
| Public commons and mirrors | Reviewed public contributions under the content license | Was public persistence and the inability to recall existing licensed copies explained before approval? |
| Private review intake | Only contributions approved for a supported private scope | Are access controls and deletion supported, with no public fallback? If absent, is the scope rejected? |
| Hosting and support systems | Minimum operational metadata | Do logs, error tracing, analytics, backups and support attachments preserve the same privacy boundary? |

The project's boundary is that conversation text is neither stored by its logging tools nor transmitted. An AI app's own conversation storage is outside this tool's control; the operator must review that service separately. Pattern scanners do not establish that a contribution is free of all identifying context.

## Consent and notice checks

- Separate disclosed minimal program measurement from optional sharing and extra measurement. Have the officer assess the applicable basis, necessity, proportionality and whether each item is actually required.
- Fill the [pilot notice](../pilot/consent-notice.md) before use and reconcile its feature statements with the installed release. Provide a responsible private contact, purposes, fields, destinations, retention and deletion dates.
- Show the exact preview, supported scope, chosen period and public-license consequences before each contribution approval. A facilitator cannot approve for a participant.
- Reject missing, expired or revoked approval and changed payloads. Verify that retry, restart and network-error paths cannot send without valid approval or duplicate an approved receipt silently.
- Explain withdrawal accurately: stop future project publication/use and remove controlled hosted copies; existing licensed copies cannot be recalled. See [contribution terms](../../CONTRIBUTING.md).
- Keep refusal separate from access to program support. Do not rank participants by contribution volume or describe notice delivery as a signed consent record.
- Record any proxy authorization, vulnerable-person safeguards, cross-border arrangements and processor/controller responsibilities that the officer requires for this program. None is assumed by this package.

## Technical evidence checklist

- Local ledger/export tests cover rejected free text, persistence, error paths and complete local deletion. Exported files are removed separately.
- Outbound tests inspect aggregate fields and contributions; no raw ledger or conversation is uploaded, including rejected requests and debug paths.
- Synthetic fixtures for personal data, secrets, malicious instructions and schema failures are rejected by mandatory commons checks. No real personal data is used in fixtures.
- Approval tests cover no approval, payload mutation, expiry, revocation, unsupported scope and private/public destination separation.
- Receiver tests cover small cells, complements, malformed payloads, replay/idempotency and reconstruction risks across published views. Document any remaining risk instead of implying universal anonymity.
- Hosting configuration disables body logging; credentials are scoped and stored outside source control; backups have documented access and retention.
- Withdrawal tests or operator records distinguish local revocation from verified remote removal. Every controlled mirror/cache is tracked separately.

Current source/test paths, immutable release checks and production source-version reads are linked in the [evidence summary](evidence-summary.md). This checklist states what to review and does not claim deployed control effectiveness.

- The contribution client preallocates and saves UUID/withdrawal credentials before HTTP; the hosted service stores only safe metadata and a credential hash. Same-ID/key/approved-term retries return persisted state. Participation-authorized withdrawal tombstones prevent late publication.
- Private authorization-derived source keys coordinate monthly metric withdrawal; durable tombstones reject late uploads from another process. Public monthly aggregates omit cells below five and are immutable after freezing. Suppression is not participant anonymity or a legal compliance finding.
- Private Git current-state deletion does not erase earlier commits or backups. Disclose history retention and its retirement policy, including consent/withdrawal tombstones whose loss could permit replay.
- Hosted expiry uses hourly cron with a two-minute publishing recovery lease. An already merged contribution requires maintainer removal approval and readback; expiry is not a guarantee of immediate disappearance.

## Officer decisions to record

- Accountable operator, technical owner, reviewing officer and private contact.
- Applicable rules, lawful basis, participant groups, processor roles and permitted destinations.
- Minimum fields and program-ID design; linkability to other datasets and authorized access.
- Retention/deletion periods for local records, aggregates, private contributions, logs, exports and backups.
- Public licensing, attribution and withdrawal limits; PII/legal takedown escalation.
- Open risks, mitigations, decision date and conditions for adoption.

Keep decision records private when they contain personal information. This handover publishes no participant-level approval or assessment record. Outside-reader review and real participant behavior remain NOT MEASURED until the owner performs the deferred post-deployment review.
