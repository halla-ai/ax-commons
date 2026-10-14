import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Ledger, LEDGER_SCHEMA_VERSION } from "../src/ledger.ts";
import { readAllRows, tempLedgerPath } from "./helpers.ts";

test("creates the ledger file and all tables on first open", () => {
  const { ledgerPath, cleanup } = tempLedgerPath();
  try {
    const ledger = new Ledger(ledgerPath);
    ledger.close();
    assert.ok(fs.existsSync(ledgerPath));
    const rows = readAllRows(ledgerPath);
    for (const table of Object.keys(rows)) {
      assert.ok(Array.isArray(rows[table as keyof typeof rows]));
    }
  } finally {
    cleanup();
  }
});

test("migration is idempotent and sets the schema version", () => {
  const { ledgerPath, cleanup } = tempLedgerPath();
  try {
    new Ledger(ledgerPath).close();
    new Ledger(ledgerPath).close();
    const db = new DatabaseSync(ledgerPath, { readOnly: true });
    const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
    db.close();
    assert.equal(row.user_version, LEDGER_SCHEMA_VERSION);
  } finally {
    cleanup();
  }
});

test("declareIntent, logTask and reportIssue persist structured rows", () => {
  const { ledgerPath, cleanup } = tempLedgerPath();
  try {
    const ledger = new Ledger(ledgerPath);
    const intentId = ledger.declareIntent("data", "save-time");
    const taskLogId = ledger.logTask("document-summary", true, false, 25);
    const issueId = ledger.reportIssue("wrong-facts", "manual-fix");
    ledger.close();

    assert.ok(intentId >= 1 && taskLogId >= 1 && issueId >= 1);
    const rows = readAllRows(ledgerPath);
    assert.equal(rows.intents.length, 1);
    assert.equal(rows.intents[0]?.work_type, "data");
    assert.equal(rows.intents[0]?.reason, "save-time");
    assert.equal(rows.task_logs.length, 1);
    assert.equal(rows.task_logs[0]?.task_type, "document-summary");
    assert.equal(rows.task_logs[0]?.human_reviewed, 1);
    assert.equal(rows.task_logs[0]?.reused, 0);
    assert.equal(rows.task_logs[0]?.minutes, 25);
    assert.equal(rows.issue_reports.length, 1);
    assert.equal(rows.issue_reports[0]?.error_type, "wrong-facts");
    assert.equal(rows.issue_reports[0]?.correction_type, "manual-fix");
  } finally {
    cleanup();
  }
});

test("logTask accepts omitted minutes", () => {
  const { ledgerPath, cleanup } = tempLedgerPath();
  try {
    const ledger = new Ledger(ledgerPath);
    ledger.logTask("coding", false, true);
    ledger.close();
    const rows = readAllRows(ledgerPath);
    assert.equal(rows.task_logs[0]?.minutes, null);
  } finally {
    cleanup();
  }
});

test("consentStatus shows program-terms aggregate item, opt-in sharing, and empty transmission history", () => {
  const { ledgerPath, cleanup } = tempLedgerPath();
  try {
    const ledger = new Ledger(ledgerPath);
    const status = ledger.consentStatus();
    ledger.close();

    const aggregate = status.items.find((i) => i.item === "aggregate-measurement");
    assert.ok(aggregate);
    assert.equal(aggregate.kind, "program-terms");
    assert.equal(aggregate.granted, true);
    const sharing = status.items.find((i) => i.item === "contribution-sharing");
    assert.ok(sharing);
    assert.equal(sharing.kind, "opt-in");
    assert.equal(sharing.granted, false);
    assert.deepEqual(status.transmissionHistory, []);
  } finally {
    cleanup();
  }
});
