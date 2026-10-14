# AX Commons: design

Status: approved; implementation in progress (phases tracked as GitHub issues #2-#7)
Date: 2026-10-14

## Problem

Public programs that subsidize paid AI tools for residents and small businesses usually measure results with follow-up surveys and feed lessons back once, in a year-end report. That has three gaps.

- Measurement relies on self-reported surveys, with low response, recall bias and survey cost, in a program whose whole subject is AI use.
- Nothing flows back to the users during the program. Good prompts, working procedures and failure cases stay on individual machines.
- Making "consent to measurement and sharing" a condition of support conflicts with data-protection rules that forbid refusing a service because a person declines optional collection or third-party sharing (for example, Korea's Personal Information Protection Act, Art. 16(3) and Art. 22(5)).

The goal is a loop where **using the AI tool is itself the measurement and the contribution**: minimal aggregate measurement as part of the service contract, and sharing as an opt-in contribution that is recognized.

## Principles

- Conversation text never leaves the user's device.
- Two things may leave the device: (1) aggregate counts with small cells suppressed, (2) contributions the user previewed and approved, with a chosen scope and period.
- Measurement is a contract, sharing is a contribution. Minimal measurement is disclosed up front as part of the program. Everything else is opt-in, revocable, and declining it has no effect on support.
- Failure counts. Reports of wrong or unhelpful AI output are contributions, not noise.
- Evaluate intent and attempts, not only short-term outcomes: each user declares one piece of work they want to change, and the loop records attempts against it.
- Everything is open source and specified, so any operator can run it or replace any part.

## Existing assets

- Model Context Protocol (MCP) for connecting AI apps to local tools (inferred: support differs by AI app and plan; verify in P0).
- Agent Skills format (SKILL.md) for reusable task instructions (inferred: support differs by app; verify in P0).
- Prior art reviewed: aggregate-only usage telemetry with self-reported effect surveys in a large government copilot trial; privacy-preserving aggregate analysis of AI conversations with small-cell suppression; scoped, revocable consent services for public data; volunteer-built open datasets; failure-tolerant public innovation funding. Sources are listed in the project's research notes, not in this repo.

## Design

```text
User device / AI app
 ├─ Task skill packs (SKILL.md, bilingual)
 └─ ax-commons MCP server (local)
     ├─ Local ledger: intent, task log, issue log, consent records (on device)
     ├─ sync_metrics: counts only, small cells suppressed ──▶ Aggregation receiver (operator)
     └─ submit_contribution: preview → scope/period approval → PII check ──▶ Commons repository (CI + human review)
```

### 1. Local MCP server

| Tool | Purpose | Leaves the device |
| --- | --- | --- |
| `declare_intent` | Record the one piece of work the user wants to change with AI, and why | No (only task-type counts via sync) |
| `log_task` | Record task type tag, whether a human reviewed the output, whether the output was reused, optional time estimate. Called at the end of a skill | No |
| `report_issue` | Record a wrong or unhelpful AI result: error type and the correction made | No (shared only through `submit_contribution`) |
| `submit_contribution` | Bundle a prompt, skill, case or issue report; show a preview; ask for scope and period; run PII and secret checks; submit to the commons repository | Approved contributions only |
| `sync_metrics` | Send period aggregates to the receiver; drop cells below the minimum size | Aggregates only |
| `consent_status`, `revoke` | Show consent items, periods and transmission history; revoke | Revocation request |

- Local ledger: a single SQLite file on the device, with export and delete commands.
- Consent model: minimal aggregate items are stated at install as program terms (P1: in the extension description, with the items themselves shown by `consent_status`); contribution sharing and any extra measurement are separate opt-in items with scope and expiry. Before any transmission is enabled (P3), the install-facing notice must be verified in the actual install screen of each supported app.
- Contribution scopes: `public` contributions go to the public commons repository. `reviewers-only` contributions go to a private review intake that is not the public repository, to be designed in P2 (issue #4); until that intake exists, only the `public` scope is accepted.

### 2. Task skill packs

- SKILL.md, bilingual (Korean and English) to start.
- First five packs: hospitality multilingual replies; small-business promotion and customer replies; farm and fishery work logs and settlement documents; job-seeking documents; general documents (summary, translation, evidence marking).
- Required metadata per skill: purpose, reference sources, reviewer, version, sunset rule (full, scope-limited or purpose-limited retirement), issue-report path.
- Each skill ends with a `log_task` call when the MCP server is present, and still works as plain instructions when it is not.

### 3. Commons repository

- Content lives under `commons/`: `commons/skills/`, `commons/prompts/`, `commons/cases/` (successes and failures), `commons/issues/`, plus schemas, and a generated `CONTRIBUTORS` list.
- Licensing: CC BY 4.0 for text (skills, prompts, cases, docs), MIT for code.
- CI checks: SKILL.md schema, PII patterns (phone, email, national ID, card numbers), secrets, prompt-injection and remote-execution instructions, link check.
- Human review per domain via CODEOWNERS, to address malicious or low-quality skills.
- Reviewers-only intake: contributions scoped `reviewers-only` go to a private review intake, not to this public repository; the intake is designed in P2 (issue #4). Until it exists, only the `public` scope is accepted.
- Recognition: generated contributor list and per-skill reuse counts (from aggregates). Any material reward is decided by the program operator, not by this project.
- Mirroring to a public-sector Git platform is a later step that depends on the operator.

### 4. Aggregation receiver

- Accepts period counts by task type, review flag, reuse and contribution count, keyed by a pseudonymous program ID.
- Publishes a dashboard with small cells suppressed.
- The prototype runs on low-cost serverless infrastructure with auto-stop; the API and schema are documented for handover to an operator.
- Uploads are complete monthly snapshots keyed on the wire only by a random program pseudonym. A private source key derived from each device's random authorization credential identifies replacement snapshots per program/source/month, preventing retry inflation. The source key is never in outbound payloads or public reports; credentials are scoped to an approved program and never derived from personal data.
- Current-month snapshots may be uploaded; the previous UTC month has a grace period through day 7. From day 8 its public release is frozen and immutable. The private monthly state stores snapshots and release in one atomic compare-and-swap record, so upload and publication races cannot report a successful upload omitted by the frozen release. Only one fixed month can be queried, with no overlapping periods, arbitrary date ranges or program-filtered marginal totals.
- Public reports contain disjoint task/review/reuse/approved-skill cells of at least 5 activities, grouped by program pseudonym. Private source keys, contribution totals and grand totals are omitted. Recognition uses the existing reused cells without adding an overlapping summation view.
- Aggregate revocation removes the authenticated source's private snapshots and stops future synchronization. Already released anonymous counts remain frozen to prevent before/after deletion differencing. Small-cell suppression concerns activity counts and does not prove participant k-anonymity or measured impact.
- The application authenticated-upload attempt budget stops ingestion at its configured monthly limit and warns at 80%; authenticated revocation remains available after the stop. This guardrail is not a provider monetary ceiling, so account-level limits and the no-additional-cost hosting constraint must also be verified.

### 5. Users without MCP support

- The operator's own records (issue, start, end) and sample surveys fill the gap.
- A web form accepts contributions with the same preview, approval and PII checks.

## Phases

| Phase | Estimate (inferred) | Output | Done when |
| --- | --- | --- | --- |
| P0 Preparation | 1 week | This spec, license and contribution rules draft, measured support table of AI apps for MCP and skills | Owner approves this spec |
| P1 Local logging | 3 weeks | MCP server (`declare_intent`, `log_task`, `report_issue`, `consent_status`), two general skills, one-click desktop install package | A non-developer goes from install to first task log in 5 minutes or less; a test proves the ledger holds no conversation text |
| P2 Contribution flow | 3 weeks | `submit_contribution` with preview, approval and PII checks; commons repository with CI; contributor list | A test contribution containing PII is blocked in CI; zero transmissions without approval in tests |
| P3 Aggregates and recognition | 2 weeks | `sync_metrics`, receiver, suppressed dashboard, reuse-based recognition report | Cells below the minimum size are never published, verified by test |
| P4 Pilot | 4 weeks | Pilot in a partner organization's staff AI training (skill-saving session), five skill packs completed | Measured install failure rate, logging rate and contribution rate reported |
| P5 Handover package | 2 weeks | Operations guide, API and schema spec, mirroring procedure, data-protection impact review material | An operator and a data-protection officer can review the package without us |

## Testing

- Unit tests for each MCP tool, including a test that scans the ledger and outbound payloads for conversation text.
- CI fixture contributions with planted PII, secrets and injection strings must fail.
- Receiver tests for small-cell suppression.
- Pilot measurements reported as verified numbers, with estimates marked inferred.

## Risks

- Uneven MCP and skill support across AI apps bought with vouchers (inferred). Mitigation: measure in P0, pilot on supported apps, keep skills usable without MCP, offer the web form.
- PII leaking into aggregates or contributions. Mitigation: no conversation text, on-device ledger, pre-send checks, suppression, data-protection review before any operator adoption.
- Conflict of interest when people involved in program design also build the tool. Mitigation: free open source, open specification so anyone can build an alternative, no exclusive supplier role, recusal in related decisions.
- Adoption by operators is not guaranteed. Mitigation: produce measured evidence in our own training first, then offer the handover package.

## Out of scope

- Running the voucher program, eligibility checks or payments.
- Any material reward logic; the operator decides rewards.
- Collecting or analyzing conversation content.
- Hosting a central skill marketplace operated by a government body.

## Decisions

- 2026-10-14: Owner selected the existing STAIx Vercel environment with no additional cost. P3 uses private GitHub structured-state persistence instead of a new paid database; current-file revocation does not erase retained private Git history.

- 2026-10-14: Repository is public under the university organization to keep the tool neutral and reduce conflict-of-interest concerns.
- 2026-10-14: First pilot is a partner organization's staff AI training, not the voucher program itself.
- 2026-10-14: Spec only for now; implementation start waits for the owner's go-ahead.
- 2026-10-14: Owner gave the implementation go-ahead; phases tracked as GitHub issues #2-#7.
- 2026-10-14: Pilot AI apps are ChatGPT and Claude.
- 2026-10-14: License is CC BY 4.0 for text (skills, prompts, cases, docs) and MIT for code.
- 2026-10-14: MCP server is TypeScript on the official MCP SDK, shipped as a one-click desktop extension package.
- 2026-10-14: Minimum cell size for published aggregates is 5.
- 2026-10-14: P3 implementation uses authenticated monthly replacement snapshots and immutable closed-month releases; per-source identity is derived privately from random transport credentials, so wire payloads contain only program pseudonyms and enumerated aggregate counts.
- 2026-10-14: P1 states program terms in the extension description and shows consent through `consent_status`. The owner subsequently authorized implementation and deployment before real-user checks. The integration supplies an install-facing notice and optional configuration fields in the manifest; native screen verification and pilot measurements remain deferred until after deployment. Each transmission still requires explicit approval.
