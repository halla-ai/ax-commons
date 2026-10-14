# Review rules

Review every pull request through the configured workflows in `.github/workflows/` and the four passes below. Inspect content beyond the patterns enforced by automation.

## Review passes

Each PR is reviewed in four passes. A reviewer may combine passes on a small change, but each must be explicitly addressed in the review.

1. **Bugs**: correctness, error handling, broken links, schema conformance of SKILL.md files and manifests.
2. **Security**: secrets, unsafe instructions, dependency or supply-chain issues, anything that executes or fetches remote code.
3. **Privacy**: personal data, conversation text, identifiers, or anything that violates the principle that conversation text never leaves the user's device.
4. **Spec conformance**: the change must match [docs/specs/2026-10-14-ax-commons-design.md](docs/specs/2026-10-14-ax-commons-design.md). Deviations require a spec amendment in the same PR or a linked issue.

## Reviewer assignment

Use the root [CODEOWNERS](CODEOWNERS) for interim reviewer assignment. A PR touching multiple areas needs review for each affected area. Before adoption, the operator appoints domain reviewers for the content used.

## Blocking conditions

A PR must not merge while any of the following is present:

- **PII**: phone numbers, email addresses, national ID numbers, card numbers, or any other personal data (Contribution safety checks known patterns in changed contributions; reviewers inspect the remaining context).
- **Secrets**: API keys, tokens, passwords, private keys.
- **Prompt-injection or remote-execution instructions**: text designed to make an AI agent ignore its instructions, exfiltrate data, or fetch and run remote code without the user's explicit action.
- **Schema failures**: a SKILL.md, manifest, or metrics payload that fails its schema check (the configured workflows validate contribution, skill and metrics contracts).

Do not override failed blocking checks; fix the content instead.

## After review

Approved PRs are merged by a maintainer. Changes requested must be resolved or explicitly answered before merge; no PR merges with an open unresolved comment.
