# Install guide (non-developers)

This guide installs the AX Commons extension in Claude Desktop. It takes about five minutes. No programming knowledge is needed.

## What you are installing

The AX Commons extension is a small program that runs only on your computer. It keeps a local log (a single file called the ledger) of:

- the one kind of work you want to change with AI and why (your intent, chosen from fixed categories),
- task records: the type of task, whether a person checked the result, whether you reused it, and optionally how long it took,
- problem reports: what went wrong and how you corrected it,
- your consent items.

**Your conversations are not recorded.** Every record holds only fixed categories, yes/no answers and an optional number of minutes; there is no place for text. This version sends nothing anywhere.

## Step 1: install the extension in Claude Desktop

1. Download `ax-commons.mcpb` from the latest release at https://github.com/halla-ai/ax-commons/releases/latest (or use the copy your program operator gave you).
2. Open Claude Desktop.
3. Either drag the `.mcpb` file onto the Claude Desktop window, or go to **Settings > Extensions**, choose **Install from file**, and pick the `.mcpb` file.
4. Confirm the install dialog. Done. No other software is needed: Claude Desktop runs the extension with its own built-in Node.js runtime.

## Step 2: what you are agreeing to

The extension keeps two consent items on your device. The install dialog does not list them; ask Claude "show my ax-commons consent status" at any time to see them. They mean:

- **Aggregate measurement (program terms)**: counting tasks by type, review, and reuse is part of the program you joined. In this version the counts stay on your device; a later version sends only counts, never text, and only after the program tells you. Every send is listed in the extension's transmission history.
- **Contribution sharing (separate opt-in, not yet active)**: sharing a prompt, skill, or case with the commons is your choice, item by item, with a preview, a scope, and a time limit. It arrives in a later version. Saying no changes nothing about the support you receive.

The same request also shows the transmission history, which is empty in this version.

## Step 3: use it

Ask Claude to do a task, for example a summary. When it is done, say: "Log this task in ax-commons." Claude asks permission to use the extension the first time; choose **Allow**. Claude then confirms the task was recorded. If you use one of the AX Commons skills, it asks to log the task at the end by itself. Nothing else changes about how you use the AI.

## Your ledger: where it is, how to export, how to delete

The ledger is one file on your computer:

- macOS: `~/Library/Application Support/ax-commons/ledger.db`
- Windows: `%APPDATA%\ax-commons\ledger.db`
- Linux: `~/.local/share/ax-commons/ledger.db`

**To delete everything**, quit Claude Desktop first, then delete that file (on macOS: in Finder, choose Go > Go to Folder and paste the path; delete `ledger.db`). That is the whole delete operation; nothing is stored elsewhere. Removing the extension from Claude Desktop stops further logging but does not delete the ledger.

**To export a readable copy** (JSON, opens in any text editor), you need Node.js 22.13 or newer installed on your computer (download from https://nodejs.org). Claude Desktop's built-in runtime cannot be used from Terminal.

1. Download `ax-commons-cli.mjs` from the same release page as the extension.
2. Open Terminal (macOS: Applications > Utilities > Terminal; Windows: PowerShell).
3. Run, using the folder you downloaded the file to:

```sh
node ~/Downloads/ax-commons-cli.mjs export --out ~/Desktop/ax-commons-export.json
```

The same file also deletes the ledger (quit Claude Desktop first): `node ~/Downloads/ax-commons-cli.mjs delete`. An exported file is a separate copy; delete it yourself when you no longer need it.

## If you use ChatGPT instead of Claude

ChatGPT does not load this desktop extension. The AX Commons skills still work: paste the skill text (from `commons/skills/`) into your chat or saved instructions and follow it as plain instructions; the logging step at the end is skipped automatically when the extension is not present. A web form for contributions arrives in a later phase (P2), so ChatGPT users can contribute with the same preview and approval steps.

## Problems

Report problems at https://github.com/halla-ai/ax-commons/issues.
