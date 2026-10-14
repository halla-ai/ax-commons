import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deleteLedger, exportLedger, Ledger, LEDGER_TABLES } from "../src/ledger.ts";
import { readAllRows, tempLedgerPath } from "./helpers.ts";

const CLI_PATH = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

test("AC3: exportLedger writes a readable JSON file with every table", () => {
  const { ledgerPath, dir, cleanup } = tempLedgerPath();
  try {
    const ledger = new Ledger(ledgerPath);
    ledger.declareIntent("writing", "improve-quality");
    ledger.logTask("document-summary", true, true, 15);
    ledger.reportIssue("unhelpful", "retry");
    ledger.close();

    const outPath = path.join(dir, "export.json");
    const result = exportLedger(ledgerPath, outPath);
    assert.equal(result.outPath, outPath);
    assert.equal(result.counts.intents, 1);
    assert.equal(result.counts.task_logs, 1);
    assert.equal(result.counts.issue_reports, 1);

    const parsed = JSON.parse(fs.readFileSync(outPath, "utf8")) as Record<string, unknown>;
    assert.equal(parsed.format, "ax-commons-ledger-export");
    for (const table of LEDGER_TABLES) {
      assert.ok(Array.isArray(parsed[table]), `export must include ${table}`);
    }
    const intents = parsed.intents as { work_type: string }[];
    assert.equal(intents[0]?.work_type, "writing");
  } finally {
    cleanup();
  }
});

test("AC3: deleteLedger removes the ledger file and reports whether anything existed", () => {
  const { ledgerPath, cleanup } = tempLedgerPath();
  try {
    const ledger = new Ledger(ledgerPath);
    ledger.logTask("data", false, false);
    ledger.close();
    assert.ok(fs.existsSync(ledgerPath));

    assert.equal(deleteLedger(ledgerPath), true);
    assert.ok(!fs.existsSync(ledgerPath));
    assert.equal(deleteLedger(ledgerPath), false);
  } finally {
    cleanup();
  }
});

test("AC3: export fails with a clear error when the ledger does not exist", () => {
  const { dir, cleanup } = tempLedgerPath();
  try {
    assert.throws(
      () => exportLedger(path.join(dir, "missing.db"), path.join(dir, "out.json")),
      /Ledger not found/,
    );
  } finally {
    cleanup();
  }
});

test("AC3: the CLI export and delete subcommands work end to end", () => {
  const { ledgerPath, dir, cleanup } = tempLedgerPath();
  try {
    const ledger = new Ledger(ledgerPath);
    ledger.declareIntent("other", "save-time");
    ledger.close();

    const env = { ...process.env, AX_COMMONS_LEDGER: ledgerPath };
    const outPath = path.join(dir, "cli-export.json");
    const exportOut = execFileSync(process.execPath, [CLI_PATH, "export", "--out", outPath], { env, encoding: "utf8" });
    assert.match(exportOut, /Exported ledger to/);
    const parsed = JSON.parse(fs.readFileSync(outPath, "utf8")) as { intents: unknown[] };
    assert.equal(parsed.intents.length, 1);

    const deleteOut = execFileSync(process.execPath, [CLI_PATH, "delete"], { env, encoding: "utf8" });
    assert.match(deleteOut, /Deleted ledger/);
    assert.ok(!fs.existsSync(ledgerPath));

    const deleteAgain = execFileSync(process.execPath, [CLI_PATH, "delete"], { env, encoding: "utf8" });
    assert.match(deleteAgain, /No ledger found/);
  } finally {
    cleanup();
  }
});

test("CLI prints help and the ledger path without touching the ledger", () => {
  const { ledgerPath, cleanup } = tempLedgerPath();
  try {
    const env = { ...process.env, AX_COMMONS_LEDGER: ledgerPath };
    const help = execFileSync(process.execPath, [CLI_PATH, "help"], { env, encoding: "utf8" });
    assert.match(help, /export/);
    assert.match(help, /delete/);
    const shownPath = execFileSync(process.execPath, [CLI_PATH, "path"], { env, encoding: "utf8" }).trim();
    assert.equal(shownPath, ledgerPath);
    assert.ok(!fs.existsSync(ledgerPath));
  } finally {
    cleanup();
  }
});
