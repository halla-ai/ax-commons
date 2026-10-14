# ax-commons

Open contribution loop for public AI-adoption programs.

Using an AI tool should be enough to measure progress and to contribute back. ax-commons combines a local MCP server, bilingual task skills, a consented contribution flow and an aggregate-only metrics receiver, so that:

- conversation text never leaves the user's device,
- only small-cell-suppressed counts and user-approved contributions are shared,
- failures count as contributions, and contributors are recognized.

Status: P0 ground rules (license, contribution rules, review rules, AI-app support matrix) are in place; implementation is underway (phases tracked as GitHub issues #2-#7). See [docs/specs/2026-10-14-ax-commons-design.md](docs/specs/2026-10-14-ax-commons-design.md).

## License

This repository uses two licenses, split by content type:

- **Code** under the [MIT License](LICENSE): `packages/`, `web/`, `scripts/`, CI configuration, and any other source code.
- **Text and content** under [CC BY 4.0](LICENSE-CONTENT): `skills/`, `commons/` (prompts, cases, issue reports), `docs/`, prompts, and cases.

If a file's license is unclear from its location, the notice in the file wins. Contributions are accepted under the license of the directory they land in; see [CONTRIBUTING.md](CONTRIBUTING.md).
