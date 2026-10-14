# Hosted contribution service

`createHostedService({store, transport, contributionToken, cronToken, reserveSubmission, now, crypto})` in `service.mjs` returns an async Fetch handler. The operator issues a 64-character lowercase hexadecimal participation bearer token; the cron credential has the same format and must differ. This service does not expose unrestricted public submission.

| Route | Method | Bearer credential | Result |
| --- | --- | --- | --- |
| `/v1/contributions` | POST | Participation token | Exact-approved publication, or pending publication with a withdrawal credential |
| `/v1/contributions/<uuid>` | GET | That contribution's revocation token | Safe metadata and current state |
| `/v1/contributions/<uuid>` | POST or DELETE | That contribution's revocation token | Request withdrawal; pending until removal readback |
| `/v1/expire` | GET | Cron token | Reconcile expired, requested, uncertain and orphaned publications; counts only |

Submission requires exactly `{candidate, hash, approved, scope, expiresAt}` as JSON. Use `preparePreview` from the contributions package in the browser and show its rendered content and notice before approval. The server validates again before touching storage or transport. Only `public` is supported; expiry must be future and within 90 days. The body has a streamed 64 KiB byte limit and a five-second read deadline.

Optional `reserveSubmission()` runs after all contribution/approval checks and before consent persistence or publication. It returns `{stopped, warning}` from the operator's durable quota. A stopped quota returns HTTP 503 with `budget_limit_reached`, without a consent or receipt; accepted responses add `x-budget-warning: true` near the configured limit. Status, revocation and expiry recovery bypass this quota so control remains available. Invalid or declined submissions do not consume quota.

The initial response contains a newly generated contribution ID and revocation token. Save that token privately on the submitting device; it is not recoverable from status responses. The private store retains only validated metadata, a content hash, safe repository receipt fields and the revocation token's SHA-256 hash. Content is forwarded only to the contribution transport after exact approval, never retained in consent state. Hosting layers must disable request-body logging.

Status `submitted` means the trusted transport returned a complete contribution PR receipt, not that a maintainer merged it. `publication-uncertain` means the network operation may have partially succeeded. `withdrawal-pending` means removal is not yet confirmed. `withdrawn` requires `transport.isRemoved` readback. Merged public content can require a maintainer to merge a removal PR; withdrawal does not recall licensed copies or ordinary Git history.

Store adapters provide `getJson(path) -> {value, sha} | null`, `putJson(path, value, {createOnly, expectedSha})` and `listConsents() -> metadata[]`. Consent paths are `consents/<uuid-without-hyphens>.json`. Updates retry compare-and-swap conflicts at most four times. The transport provides `publish`, `revoke` and `isRemoved`, using deterministic contribution branches for uncertain publication recovery.

Cron gives rows marked `publishing` a two-minute lease from their persisted `submitted_at` time, then conservatively withdraws them as potentially orphaned. The hosting function's maximum duration must remain below that lease. During the lease, expiry or explicit revocation sets a durable request flag; the publisher re-reads it and performs withdrawal before reporting success. `publication-uncertain` is reconciled immediately. Keep pending records until actual remote readback; do not delete them merely because expiry passed.

Run the mocked targeted checks with `npm test --workspace @ax-commons/hosted`; syntax-check with `npm run build --workspace @ax-commons/hosted`. These checks do not establish browser or real-user outcomes, which the owner deferred until deployment.
