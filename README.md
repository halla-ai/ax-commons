# ax-commons

Open contribution loop for public AI-adoption programs.

Using an AI tool should be enough to measure progress and to contribute back. ax-commons combines a local MCP server, bilingual task skills, a consented contribution flow and an aggregate-only metrics receiver, so that:

- the activity logger never captures conversation text,
- only small-cell-suppressed counts and user-approved contributions are shared,
- failures count as contributions, and contributors are recognized.

Version 0.2 implements the local MCP logger, explicit public contribution approval and withdrawal, suppressed monthly metrics, and a bilingual web form/dashboard. Real-user installation, pilot measurements, partner approval and outside-reader review remain deferred. See the [design](docs/specs/2026-10-14-ax-commons-design.md), [installation guide](docs/install.md), and [operator handover](docs/handover/operator-guide.md).

- [Dashboard](https://ax-commons.halla.ai/) and [contribution form](https://ax-commons.halla.ai/contribute/).
- [Desktop extension and CLI release](https://github.com/halla-ai/ax-commons/releases/tag/v0.2.0).
- [API](docs/api.md), [schema](docs/schema.md), [deployment](docs/deployment.md).

No sharing occurs merely because a server is configured. Preview and approve each contribution; approve each monthly metrics upload. Public copies and Git history cannot be recalled, and a merged contribution withdrawal remains pending until the removal PR is merged and verified.

## License

This repository uses two licenses, split by content type:

- **Code** under the [MIT License](LICENSE): `packages/`, `web/`, `scripts/`, CI configuration, and any other source code.
- **Text and content** under [CC BY 4.0](LICENSE-CONTENT): `commons/` (skills, prompts, cases, issue reports), `docs/`, and other prose.

If a file's license is unclear from its location, the notice in the file wins. Contributions are accepted under the license of the directory they land in; see [CONTRIBUTING.md](CONTRIBUTING.md).
