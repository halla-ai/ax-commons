# Mirroring and withdrawal procedure

Mirroring to a public-sector Git host depends on the operator's chosen platform and account. No mirror is provisioned by this document. These steps preserve the [contribution rules](../../CONTRIBUTING.md), including their public-license and Git-history limits.

## Establish a mirror

- Name the source of truth, target repository, visibility, mirror owner and private takedown contact in the operator's deployment record.
- Confirm that the target accepts MIT code and CC BY 4.0 content; retain both license files, attribution and the [README license map](../../README.md#license).
- Inventory the exact source release and its content before publishing. A history mirror includes historic contributions, not only the current tree. Do not publish local ledgers, exports, aggregate raw data, credentials or private-intake content.
- Review contribution approval scope and expiry against the target. Public mirror hosting does not make `reviewers-only` content eligible. Identify prior withdrawal/PII incidents before copying history.
- Configure platform-native synchronization with a dedicated scoped credential held outside the repository. Verify the destination and branch mapping before the first push. Do not use a force push or deletion propagation without the operator's specific policy.
- Record source/target commit IDs and sync results. A successful push is source synchronization evidence; it is not a deployment or participant-use result.
- Keep issue/PR attachments, release artifacts and hosted site content in the inventory. Repository synchronization does not automatically synchronize their withdrawals.

## Receive withdrawal or expiry

- Use the existing public issue convention `withdraw: <contribution-id>` only when safe to disclose that ID. Route identifying details, secrets and sensitive proof of authority to the operator's private contact.
- Verify authority and identify the specific contribution, scope and approved period using minimum necessary information. Do not publish identity evidence.
- Record whether the trigger is contributor withdrawal or expiry. Suspend future project use/publication of that item and stop any queued synchronization of it.
- Local revocation is not proof of remote removal. The [MCP bridge](../../packages/mcp-bridge/README.md) and [hosted service](../../packages/hosted/README.md) retain withdrawal controls before publishing: client UUID/key, safe server metadata, idempotent same-ID replay and durable tombstones. Preserve the local credential until remote withdrawal completes; it is not included in safe status/export output. An unknown-ID DELETE also needs participation authorization and creates a tombstone that blocks a late POST.

## Remove controlled copies

- Open a reviewed change removing or retiring the affected current content according to the contribution terms. Recompute generated indexes/recognition listings where they expose the removed item.
- Merge the reviewed removal and record the resulting commit. Apply it to all operator-controlled mirrors, sites and release artifacts that contain the item; request platform cache removal where available.
- Check each current source tree, mirror and published page for the contribution ID and content. Record per-target success, pending requests and inaccessible targets. Do not report all copies removed from a single local result.
- Confirm completion to the requester through the agreed channel. Explain that previously obtained CC BY 4.0 copies remain licensed and routine Git history is retained.
- Keep only a minimal private withdrawal receipt and the non-sensitive repository change needed to prevent accidental republication. Do not restore removed content during rollback or regeneration.

## PII or legal takedown

- Escalate privately, restrict publication immediately and coordinate with host/mirror owners. Avoid spreading the affected data while reporting the incident.
- Ordinary withdrawal does not rewrite history. A PII or legal takedown may require exceptional history/cache/artifact removal with the appropriate operator authorization and host procedure.
- Check forks, clones and unmanaged caches as separate external targets. Request their removal where appropriate, but never promise deletion from copies the operator does not control.

## Receipt fields

- Contribution ID, trigger, request/expiry date and responsible operator.
- Current source removal commit and per-mirror propagation commits.
- Site/artifact/cache status, unresolved targets and next action.
- Requester acknowledgement status and retained evidence location.

Do not place personal verification material in the public receipt. Hourly hosted cron reconciles expiry, requested withdrawal and uncertain publications; `publishing` records have a two-minute recovery lease. Merged public content can need a maintainer-merged removal PR; retain `withdrawal-pending` until actual readback. Target-specific mirror setup and removal remain operator dependencies.

Metric withdrawal follows the separate [API](../api.md): private monthly source tombstones block late uploads, current stored counts are removed, frozen public aggregates remain immutable. [Private Git retention](../deployment.md) means earlier commit versions and backups can remain; do not promise complete erasure from a current-state deletion.
