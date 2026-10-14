import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { LEDGER_TABLES, type LedgerTable } from "../src/ledger.ts";

export function tempLedgerPath(): { dir: string; ledgerPath: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ax-commons-test-"));
  const ledgerPath = path.join(dir, "ledger.db");
  return {
    dir,
    ledgerPath,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

export function readAllRows(ledgerPath: string): Record<LedgerTable, Record<string, unknown>[]> {
  const db = new DatabaseSync(ledgerPath, { readOnly: true });
  try {
    const out = {} as Record<LedgerTable, Record<string, unknown>[]>;
    for (const table of LEDGER_TABLES) {
      out[table] = db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
    }
    return out;
  } finally {
    db.close();
  }
}

export function ledgerContains(ledgerPath: string, needle: string): boolean {
  const rows = readAllRows(ledgerPath);
  return JSON.stringify(rows).includes(needle);
}
