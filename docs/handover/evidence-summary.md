# Handover evidence summary

Verified release snapshot (2026-10-15 audit): [v0.2.1](https://github.com/halla-ai/ax-commons/releases/tag/v0.2.1), commit `bc95f371845256203ce7f5e2d24593f6b8fe42c1`. On 2026-10-15, fresh reads of `https://ax-commons.halla.ai/health` and `/release.json` returned this commit; release metadata also reported version `0.2.1`. [Full release checks](https://github.com/halla-ai/ax-commons/actions/runs/38592300731) and [release/deployment](https://github.com/halla-ai/ax-commons/actions/runs/38592372547) succeeded at that commit. The owner directed implementation/deployment first and real-user testing afterward. No participant or outside-reader test is claimed here.

The links below identify implementation and automated test contracts included in that release. The release checks certify automated validation at the linked commit; live version reads establish the served source identity only. A build or mocked test does not establish user installation time, adoption, service legality or observed participant privacy behavior.

## Source and implementation evidence

| Claim | Source or automated test contract | Evidence limit |
| --- | --- | --- |
| Local logging uses fixed categories; ledger/export/delete controls exist | [Tools](../../packages/mcp-server/src/tools.ts), [privacy tests](../../packages/mcp-server/test/privacy.test.ts), [export/delete tests](../../packages/mcp-server/test/export-delete.test.ts), [installation](../install.md) | Release CI passed; five-minute participant installation NOT MEASURED |
| Exact preview, public approval, bounded expiry and known safety gates exist | [Contribution core](../../packages/contributions/core.mjs), [boundary](../../packages/contributions/README.md), [core tests](../../packages/contributions/core.test.mjs), [safety fixtures](../../packages/contributions/check.test.mjs) | Source/test contracts; scanners do not prove arbitrary content safe |
| Hosted submissions use client-preallocated UUID/key, safe metadata, exact-term replay and withdrawal tombstones | [Hosted protocol](../../packages/hosted/README.md), [service](../../packages/hosted/service.mjs), [mocked tests](../../packages/hosted/test/service.test.mjs) | Release CI passed with mocked protocol checks; production publication/withdrawal behavior remains untested |
| Local receipts retain withdrawal control before HTTP and preserve uncertain state | [MCP bridge](../../packages/mcp-bridge/README.md), [bridge tests](../../packages/mcp-bridge/test/bridge.test.mjs), [web model tests](../../web/contribute/model.test.mjs) | Source/test contracts; real app/browser outcomes NOT MEASURED |
| Remote withdrawal requires actual removal readback; merged public content needs a removal PR | [Repository adapter](../../packages/contributions/github.mjs), [adapter tests](../../packages/contributions/github.test.mjs), [withdrawal procedure](mirroring-withdrawal.md) | Existing copies and ordinary Git history are not recalled |
| Aggregate wire has no device/source ID; source identity is authorization-derived privately | [API](../api.md), [schema](../schema.md), [receiver tests](../../packages/receiver/test/core.test.mjs) | Protocol/source evidence; no claim of participant anonymity |
| Private withdrawal tombstones reject late metric uploads; monthly public reports are suppressed and frozen | [Private store](../../packages/receiver/src/github-store.mjs), [store tests](../../packages/receiver/test/github.test.mjs), [API](../api.md) | Release CI passed; fresh production persistence mutation/readback was not performed in this audit |
| Deployment uses private Git state and shared monthly app quota, with controls available after the stop | [Deployment](../deployment.md), [host wrapper](../../api/service.js), [API wrapper tests](../../test/hosted-api.test.mjs) | Released to the existing-account environment; no new paid DB/add-ons; app quota is not a platform monetary guarantee |
| Sharing is optional and withdrawal/license limits are stated | [Contribution rules](../../CONTRIBUTING.md), [privacy checklist](privacy-review.md) | Policy/review material; no legal compliance conclusion |
| Five domain packs and pilot materials exist | [Commons skills](../../commons/skills/), [facilitator guide](../pilot/facilitator-guide.md), [fictional exercises](../pilot/fictional-exercises.md) | Preparation material; operator domain approval remains pending |

The [provider billing monitor](../../scripts/hosting-budget.mjs) is implemented. Its [scheduled run](https://github.com/halla-ai/ax-commons/actions/runs/38620787257) succeeded at the release commit. A successful monitor run does not prove a future pause or guarantee timely billing data. Vercel Pro overage cannot be ruled out by the application's 1,000-attempt monthly ceiling or 80% warning; public/static/rejected traffic and provider operations remain separate cost exposure. See the [deployment limits](../deployment.md).

## Human pilot and acceptance outcomes

All outcomes below are **NOT MEASURED**. No zero counts, success rates, consent records or adoption estimates follow from implementation or deployment.

| Outcome | Definition/source | Next evidence needed |
| --- | --- | --- |
| Installation failure and first local task log within 300 seconds | [Measurement plan](../pilot/measurement-plan.md) | Non-developer observer timing and local confirmation |
| MCP logging rate and standalone completion | [Measurement plan](../pilot/measurement-plan.md) | Route-specific attempts and confirmed local logs/manual tally |
| Approved contribution rate | [Measurement plan](../pilot/measurement-plan.md) | Functioning released flow and verified submission receipt |
| Partner approval, notice before measurement and no disadvantage from refusal | [Report template](../pilot/report-template.md), [notice](../pilot/consent-notice.md) | Partner/operator confirmation and participant observation |
| Domain review of pilot packs | [Pilot guide](../pilot/facilitator-guide.md) | Operator-appointed domain reviewers' decisions |
| Outside reader can review the package without the authors, issue #7 AC1 | [Operator guide](operator-guide.md) | Owner-selected reader, questions and documented answers |

Issue #7 AC2 is addressed by linking factual implementation claims to source/test contracts and marking pending evidence explicitly. The owner must record final document review before closing it. No effectiveness estimate or legal conclusion is supplied.

## Final release record

- Tag and source: [v0.2.1](https://github.com/halla-ai/ax-commons/releases/tag/v0.2.1), `bc95f371845256203ce7f5e2d24593f6b8fe42c1`; [SHA256SUMS](https://github.com/halla-ai/ax-commons/releases/download/v0.2.1/SHA256SUMS) accompanies the CLI, npm tarball and desktop extension.
- Immutable automated checks: [Full release checks](https://github.com/halla-ai/ax-commons/actions/runs/38592300731). Implementation review and merge records: [PR #16](https://github.com/halla-ai/ax-commons/pull/16), [PR #17](https://github.com/halla-ai/ax-commons/pull/17).
- Production source identity: fresh `/health` and `/release.json` reads on 2026-10-15 matched the release commit and version; [deployment workflow](https://github.com/halla-ai/ax-commons/actions/runs/38592372547) succeeded. These reads do not exercise submission, withdrawal or storage.
- Scheduled billing monitor: [successful run](https://github.com/halla-ai/ax-commons/actions/runs/38620787257). Private storage visibility, retention, credentials and expiry configuration require operator verification before real participant collection; this audit made no private-state mutation.
- Human pilot/outside-reader questions and answered document revisions: NOT MEASURED.

## Post-deployment reporting

- Record the actual deployed commit/version and route in a copy of the [report template](../pilot/report-template.md).
- Use the [measurement definitions](../pilot/measurement-plan.md). Missing observations are `unknown`, unobserved outcomes `not measured`, and zero denominators `not applicable`.
- Keep raw and participant-level observations local. Apply minimum-cell and complementary suppression before publishing, including sample sizes and rates.
- Report immutable technical check results separately from pilot outcomes. Source files, a health endpoint or a deployed version are not a human test result.
