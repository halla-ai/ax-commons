# Review rules

Every pull request to ax-commons goes through automated CI and human review. This document defines the passes, who reviews, and what blocks a merge.

## Review passes

Each PR is reviewed in four passes. A reviewer may combine passes on a small change, but each must be explicitly addressed in the review.

1. **Bugs** — correctness, error handling, broken links, schema conformance of SKILL.md files and manifests.
2. **Security** — secrets, unsafe instructions, dependency or supply-chain issues, anything that executes or fetches remote code.
3. **Privacy** — personal data, conversation text, identifiers, or anything that violates the principle that conversation text never leaves the user's device.
4. **Spec conformance** — the change must match [docs/specs/2026-10-14-ax-commons-design.md](docs/specs/2026-10-14-ax-commons-design.md). Deviations require a spec amendment in the same PR or a linked issue.

## Reviewer assignment

Domain reviewers are assigned through CODEOWNERS: each content area (`skills/`, `commons/`, `packages/`, `web/`, `docs/`) has an owning reviewer or team. A PR touching multiple areas needs an approval from each affected owner.

## Blocking conditions

A PR must not merge while any of the following is present:

- **PII** — phone numbers, email addresses, national ID numbers, card numbers, or any other personal data (CI blocks the known patterns; reviewers catch the rest).
- **Secrets** — API keys, tokens, passwords, private keys.
- **Prompt-injection or remote-execution instructions** — text designed to make an AI agent ignore its instructions, exfiltrate data, or fetch and run remote code without the user's explicit action.
- **Schema failures** — a SKILL.md, manifest, or metrics payload that fails its schema check in CI.

Blocking CI checks cannot be overridden by reviewers; fix the content instead.

## After review

Approved PRs are merged by a maintainer. Changes requested must be resolved or explicitly answered before merge; no PR merges with an open unresolved comment.
