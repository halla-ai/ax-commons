# Contributing to ax-commons

ax-commons is an open contribution loop: the prompts, skills, and cases people share are the commons. This document defines what can be contributed, under what terms, and what happens to it.

## Contribution types

- **Skill**: a SKILL.md task pack (bilingual Korean/English preferred) that guides an AI app through a specific task.
- **Prompt**: a reusable prompt or prompt fragment for a specific task.
- **Success case**: a worked example where AI output was reviewed and reused.
- **Failure case**: a report of wrong or unhelpful AI output, including the error type and the correction made. Failure reports count as contributions, not noise.
- **Issue report**: a bug or problem with a skill, the MCP server, or the flow itself, filed through the issue-report path declared in the skill's metadata.

Content lives under `commons/`: `commons/skills/`, `commons/prompts/`, `commons/cases/` (success and failure), `commons/issues/`, plus schemas and a generated `CONTRIBUTORS` list.

## Required metadata

Every contribution (skill, prompt, or case) must carry:

- **Purpose**: what task it addresses and for whom.
- **Reference sources**: where the procedure or facts come from.
- **Reviewer**: the domain reviewer responsible for it.
- **Version**: semantic version, bumped on every change.
- **Sunset rule**: how the contribution retires: `full` (removed entirely), `scope-limited` (kept but narrowed to a smaller scope), or `purpose-limited` (kept only for a narrower stated purpose).
- **Issue-report path**: where users report problems with this specific contribution.

Contributions missing any of these are returned for completion.

## Personal data rules

Contributions must not contain personal data. Phone numbers, email addresses, national ID numbers, and card numbers are blocked automatically in CI (planned; the checks land in P2), and the pull request fails. Until the CI exists, reviewers enforce the same patterns manually. Beyond those patterns, do not include names, addresses, account numbers, or anything that identifies a person. If real data is needed to explain a case, replace it with placeholders.

## Consent terms

Sharing is a contribution, never a condition:

- Contributing is **opt-in**. Nothing is shared unless you preview and approve it.
- Each contribution is **scoped** by your choice: `public` (visible to everyone) or `reviewers-only` (visible only to the review team). The `reviewers-only` scope applies only to contributions arriving through the MCP server or the web form; contributions submitted as pull requests to this public repository are public by nature.
- Each contribution is **time-limited**: you choose the sharing period at approval time.
- Contributions are **revocable**. You can withdraw any contribution at any time by opening a withdrawal request in this repository (an issue titled `withdraw: <contribution-id>`) or, once it exists, with the `revoke` tool in the MCP server (planned, lands in P2). Withdrawn items are removed from the public commons; copies already incorporated into derived works under the license cannot be recalled, but no new use is published.
- **Declining to share has no effect on program support.** Whether or not you contribute, you receive the same program services and assistance.

## Recognition

Contributors are recognized through a generated contributor list (`CONTRIBUTORS`) and per-skill reuse counts computed from aggregate metrics. There are no material rewards from this project; any material reward is the program operator's decision, not ours.

## License of contributions

By submitting a contribution you license it under the license of the directory it lands in: CC BY 4.0 for content (`commons/`, `docs/`) and MIT for code (`packages/`, `web/`, `scripts/`, CI). See the [README](README.md#license).

## Review

All contributions go through the review process in [REVIEW.md](REVIEW.md): automated CI checks (planned, land in P2), then four review passes (bugs, security, privacy, spec conformance) with a domain reviewer assigned via CODEOWNERS (also planned for P2; until then a maintainer assigns reviewers).
