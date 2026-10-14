# Aggregate receiver API

- Runtime: portable Fetch API core; persistent storage adapter provided by deployment. Local SQLite requires Node >= 22.13.
- No conversation text, names, addresses, free-text identifiers, task notes, device identifiers or exact timestamps are accepted. Invalid payload errors never echo input. Hosting request/body logging must be disabled.
- Ingestion authorization maps a bearer credential to one approved pseudonymous program and a private source key derived from a random per-device credential. The receiver rejects a different `program_id`. Operators issue a separate random credential per participating device; neither credentials nor program IDs may be derived from personal data.
- Body maximum: 65,536 bytes. JSON only. Unknown properties and unknown enum values are rejected.

## Upload

`POST /v1/metrics`, authenticated, `Content-Type: application/json`.

```json
{
  "version": 1,
  "program_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "period": "2026-10",
  "cells": [
    {"task_type": "writing", "human_reviewed": true, "reused": true, "skill_id": "general/general-documents", "count": 5}
  ],
  "contribution_count": 0
}
```

- A snapshot replaces the same program/authenticated-source/month, including removal of previously uploaded cells. Retrying never increases counts.
- Send complete locally suppressed monthly snapshots, not incremental batches. Cells with counts below 5 must be absent; contribution count is 0 or at least 5. An empty cells array is permitted.
- UTC current month is accepted. Previous month is accepted until the following month day 7 inclusive. Older months are closed; future months are rejected.
- Success: `200 {"accepted":true}`. Authentication: 401; program mismatch: 403; invalid payload: 400; closed period: 409; body too large: 413; unsupported media: 415. Store failures return generic 503.

## Revocation

`DELETE /v1/metrics`, authenticated, JSON body containing exactly `program_id`, `period`.

- Atomically removes the authenticated source snapshot for that month and persists a private program/source/month withdrawal tombstone. Successful repeated revocations are harmless. A delayed upload from another process using the same credential is rejected with 409; the withdrawn source/month cannot silently resume sharing. No source key or tombstone is added to the wire payload or public response.
- Response: `200 {"revoked":true,"published_release_immutable":false}`. A true immutable flag means the closed public aggregate had already been released.
- Revocation stops future synchronization locally and removes server snapshots. Previously published anonymous aggregate cells remain immutable, so deletion cannot expose an individual's contribution through before/after comparison. It does not remove approved commons contributions; those have a separate consent workflow.

## Public release

`GET /v1/public?period=YYYY-MM`, unauthenticated.

- Exactly one fixed calendar month, no other query parameters, program filters, rolling intervals or date ranges.
- Available from the following month day 8 UTC. The first request freezes the month's release in persistent storage. Subsequent reads return the exact same aggregate data.
- Response contains `version`, `period`, `minimum_cell_size:5`, and `programs:[{program_id,cells:[...]}]`. Private source keys and contribution totals are never public.
- Each cell is a disjoint task-type/review/reuse/skill combination with count >=5. No grand totals, marginal breakdowns or alternate cross-program sums are published. Reuse recognition reads these same cells with `reused:true`; it does not create a second summation view.
- Empty `programs` means no publishable cells, not proof of zero activity. No pilot measurements are fabricated.
- Small-cell suppression protects activity counts; it does not establish participant k-anonymity, unique-user counts, measured impact, fraud resistance or differential privacy. Counts depend on trusted participating devices.

`GET /health` returns `{"status":"ok"}`. It is a process check, not evidence of database writes or real-user success.

## Deployment adapter contract

- `createReceiver({store, authenticate, now})` returns a Fetch request handler. `authenticate(request)` returns `{program_id,source_id}` or null, with `source_id` a server-side SHA-256 hex digest of the random credential, never supplied in the JSON payload. `now()` defaults to the actual current date.
- Store methods are async: `upsert({...snapshot,source_id})`, `revoke({...identity,source_id})`, `listSnapshots(period)`, `getRelease(period)`, `putRelease(period,release)`.
- Hosted expiry can call `listConsents()` on the GitHub adapter to enumerate persisted consent metadata from the private `consents/<32-64hex>.json` namespace. The tree and each record read verify private visibility. Truncated trees, more than 10,000 tree entries or more than 1,000 consent records fail closed with an unavailable error rather than returning an incomplete sweep. Metadata values are returned; contribution content must never be stored in this namespace. Operators must retire retained consent metadata under the documented retention policy before reaching the bound.
- `putRelease` must insert only if absent and return the persisted release, including an already existing release. Never overwrite a release.
- The SQLite adapter uses immediate write transactions to coordinate independent connections. The GitHub adapter keeps snapshots and the frozen release together in one monthly file; every mutation uses atomic contents SHA compare-and-swap with bounded retries. Upload eligibility, frozen state and durable withdrawal tombstones are rechecked during each retry, and publication recomputes from the latest snapshots. An upload racing publication must either commit before the winning release or fail; it cannot successfully write a snapshot omitted by an already frozen release. Revocation concurrent with first publication may be included or excluded, but the winning release remains immutable.
- Configure authorization, storage binding, request quotas, budget alerts and automatic ingestion stop before production deployment. Host setup and live deployment receipt are recorded separately in the operations guide.
- Budget limits must be positive safe integers from 1 to 100,000; both admission and status fail before storage access on invalid configuration. The deployment authenticated-upload attempt cap and near-limit warning are operational guardrails, not a provider monetary ceiling. Provider request charges, storage and requests rejected after the cap can still incur costs. Revocation must remain available after ingestion stops.

Real-user installation, logging and contribution exercises are deferred until after deployment, as requested by the owner.
