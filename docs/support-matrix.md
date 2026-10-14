# AI-app support matrix

Measured on 2026-10-14 against official documentation where available. This matrix decides which AI apps the ax-commons local MCP server and SKILL.md packs can target first.

Marks: `verified` means an official document from the vendor confirms the cell; `inferred` means no official confirmation was found and the entry is our reading of the current state (follow-up verification needed).

Columns:

- **Local MCP (stdio)** — the app can run a local MCP server as a child process.
- **Remote MCP** — the app can connect to a remote (HTTP) MCP server.
- **Desktop extension (.dxt / MCPB)** — the app supports the one-click desktop extension package format.
- **Agent Skills (SKILL.md)** — the app loads Agent Skills in the SKILL.md format.

## General assistants

| App | Local MCP (stdio) | Remote MCP | Desktop extension | Agent Skills (SKILL.md) |
| --- | --- | --- | --- | --- |
| ChatGPT (web/desktop) | not supported (inferred) — developer mode connects remote MCP apps only; no official local stdio path found. [source](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) | supported (verified) — developer mode with full MCP (incl. write actions) rolling out in beta to Business, Enterprise, Edu plans; custom connectors on other paid tiers. [source](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) | not supported (inferred) — no package format documented. [source](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) | supported (verified) — Skills are SKILL.md packages usable in ChatGPT and Codex. [source](https://help.openai.com/en/articles/20001066-skills-in-chatgpt) |
| Claude (desktop/web) | supported (verified) — Claude Desktop runs local stdio MCP servers, all plans. [source](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) | supported (verified) — custom connectors (remote MCP) on web/desktop/mobile, plan-dependent limits; Team/Enterprise admin controls. [source](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) | supported (verified) — one-click desktop extensions (.dxt, renamed .mcpb); directory plus private installs; Team/Enterprise allowlists. [source](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) | supported (verified) — Skills on Free, Pro, Max, Team, Enterprise; org provisioning for Team/Enterprise. [source](https://support.claude.com/en/articles/12512176-what-are-skills) |
| Google Gemini (web/desktop/mobile app) | not supported (inferred) — Gemini apps integrate via connected apps/extensions, not MCP; no official MCP client support found for the consumer app. [source](https://support.google.com/gemini/answer/13695031) | not supported (inferred) — as above; MCP support exists in Gemini CLI and Gemini Enterprise, not confirmed for the Gemini app. [source](https://support.google.com/gemini/answer/13695031) | not supported (inferred) — no extension package format documented for the Gemini app. [source](https://support.google.com/gemini/answer/13695031) | not supported (inferred) — SKILL.md support is documented for Gemini CLI via its skills/extension layer, not for the Gemini app. [source](https://support.google.com/gemini/answer/13695031) |

## Developer tools

| App | Local MCP (stdio) | Remote MCP | Desktop extension | Agent Skills (SKILL.md) |
| --- | --- | --- | --- | --- |
| Claude Code | supported (verified) — stdio servers via `claude mcp add` / `.mcp.json`. [source](https://code.claude.com/docs/en/mcp) | supported (verified) — HTTP/SSE remote servers in the same config. [source](https://code.claude.com/docs/en/mcp) | not supported (inferred) — distribution goes through plugin marketplaces instead of .dxt/MCPB. [source](https://code.claude.com/docs/en/plugins) | supported (verified) — SKILL.md skills under `.claude/skills/`, invocable as slash commands. [source](https://code.claude.com/docs/en/skills) |
| Cursor | supported (verified) — stdio servers via `mcp.json`. [source](https://cursor.com/docs/mcp) | supported (verified) — Streamable HTTP remote servers with OAuth. [source](https://cursor.com/docs/mcp) | partial (inferred) — one-click MCP install deeplinks and a plugin marketplace exist, but not the .dxt/MCPB format. [source](https://cursor.com/docs/plugins) | supported (verified) — project skills at `.cursor/skills/<name>/SKILL.md`, auto-discovered by Agent. [source](https://cursor.com/docs/skills) |
| VS Code + GitHub Copilot | supported (verified) — stdio servers via "MCP: Add Server" / `mcp.json`; MCP may require org admin enablement for Copilot Business/Enterprise. [source](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) | supported (verified) — remote (HTTP) servers in the same configuration. [source](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) | partial (inferred) — VS Code extensions can bundle MCP servers and `mcp:` install links exist, but there is no .dxt/MCPB support. [source](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) | supported (verified) — Agent Skills (open standard) work with Copilot in VS Code from `.github/skills/`, `.claude/skills/` or `.agents/skills/`. [source](https://code.visualstudio.com/docs/agent-customization/agent-skills) |

## Inferred cells (follow-up verification needed)

- ChatGPT — local MCP (stdio): no official local stdio path found; developer mode documents remote MCP apps only.
- ChatGPT — desktop extension: no package format documented.
- Google Gemini app — all four columns: MCP and SKILL.md support are documented for Gemini CLI and Gemini Enterprise but not for the consumer Gemini app.
- Claude Code — desktop extension: plugin marketplaces are the distribution path; no .dxt/MCPB support documented.
- Cursor — desktop extension: deeplinks and plugin marketplace exist; not the .dxt/MCPB format.
- VS Code + GitHub Copilot — desktop extension: VS Code extension bundling exists; not the .dxt/MCPB format.

## Reading for the project

- Claude Desktop is the strongest first target: all four mechanisms verified, and the one-click desktop extension matches the planned install experience for non-developers.
- Claude Code, Cursor and VS Code cover the developer audience with full MCP and SKILL.md support.
- ChatGPT supports skills and (plan-gated) remote MCP; a local on-device server path is not confirmed.
- The Gemini app currently has no confirmed MCP or SKILL.md path; users on Gemini fall back to the web form described in the design spec.
