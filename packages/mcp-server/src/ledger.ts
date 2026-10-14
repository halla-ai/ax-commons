import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const LEDGER_SCHEMA_VERSION = 1;

// Structured value domains. These are the only strings the ledger accepts;
// free-text conversation content has no column to land in.
export const TASK_TYPES = ["document-summary", "translation", "writing", "coding", "data", "other"] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export const ERROR_TYPES = ["wrong-facts", "unhelpful", "refused", "format", "other"] as const;
export type ErrorType = (typeof ERROR_TYPES)[number];
export const CORRECTION_TYPES = ["manual-fix", "retry", "abandoned", "other"] as const;
export type CorrectionType = (typeof CORRECTION_TYPES)[number];

export const MAX_SHORT_TEXT = 200;
export const MAX_MINUTES = 24 * 60;

export const LEDGER_TABLES = ["intents", "task_logs", "issue_reports", "consent_records", "transmissions"] as const;
export type LedgerTable = (typeof LEDGER_TABLES)[number];

const PROGRAM_TERMS_ITEM = "aggregate-measurement";
const PROGRAM_TERMS_DETAIL =
  "Minimal aggregate counts (task type, human-review flag, reuse flag) are part of the program terms. " +
  "This version transmits nothing; any future transmission is listed in the transmission history.";

const MIGRATIONS: readonly string[][] = [
  [
    `CREATE TABLE intents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      work_summary TEXT NOT NULL CHECK (length(work_summary) <= ${MAX_SHORT_TEXT}),
      reason TEXT NOT NULL CHECK (length(reason) <= ${MAX_SHORT_TEXT})
    )`,
    `CREATE TABLE task_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      task_type TEXT NOT NULL CHECK (task_type IN (${TASK_TYPES.map((t) => `'${t}'`).join(", ")})),
      human_reviewed INTEGER NOT NULL CHECK (human_reviewed IN (0, 1)),
      reused INTEGER NOT NULL CHECK (reused IN (0, 1)),
      minutes INTEGER CHECK (minutes IS NULL OR (minutes >= 0 AND minutes <= ${MAX_MINUTES}))
    )`,
    `CREATE TABLE issue_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      error_type TEXT NOT NULL CHECK (error_type IN (${ERROR_TYPES.map((t) => `'${t}'`).join(", ")})),
      correction_type TEXT NOT NULL CHECK (correction_type IN (${CORRECTION_TYPES.map((t) => `'${t}'`).join(", ")}))
    )`,
    `CREATE TABLE consent_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL,
      item TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('program-terms', 'opt-in')),
      granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
      scope TEXT,
      period TEXT,
      detail TEXT
    )`,
    `CREATE TABLE transmissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sent_at TEXT NOT NULL,
      kind TEXT NOT NULL,
      detail TEXT
    )`,
    `INSERT INTO consent_records (recorded_at, item, kind, granted, scope, period, detail)
     VALUES (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), '${PROGRAM_TERMS_ITEM}', 'program-terms', 1, 'program', NULL, '${PROGRAM_TERMS_DETAIL.replaceAll("'", "''")}')`,
  ],
];

export interface ConsentItem {
  item: string;
  kind: "program-terms" | "opt-in";
  granted: boolean;
  scope: string | null;
  period: string | null;
  detail: string | null;
}

export interface ConsentStatus {
  items: ConsentItem[];
  transmissionHistory: { sent_at: string; kind: string; detail: string | null }[];
  ledgerPath: string;
  note: string;
}

export class Ledger {
  readonly path: string;
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    this.path = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(this.path), { recursive: true });
    this.db = new DatabaseSync(this.path);
    // Two clients (e.g. Claude Desktop and another app) may run the server at once;
    // wait for the other writer instead of failing a log with SQLITE_BUSY.
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.migrate();
  }

  private migrate(): void {
    const row = this.db.prepare("PRAGMA user_version").get() as { user_version: number };
    let version = row.user_version;
    while (version < MIGRATIONS.length) {
      // One transaction per step, so a failed migration leaves no half-built schema.
      this.db.exec("BEGIN");
      try {
        for (const statement of MIGRATIONS[version] ?? []) {
          this.db.exec(statement);
        }
        this.db.exec(`PRAGMA user_version = ${version + 1}`);
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
      version += 1;
    }
  }

  declareIntent(workSummary: string, reason: string): number {
    const result = this.db
      .prepare("INSERT INTO intents (created_at, work_summary, reason) VALUES (?, ?, ?)")
      .run(new Date().toISOString(), workSummary, reason);
    return Number(result.lastInsertRowid);
  }

  logTask(taskType: TaskType, humanReviewed: boolean, reused: boolean, minutes?: number): number {
    const result = this.db
      .prepare("INSERT INTO task_logs (created_at, task_type, human_reviewed, reused, minutes) VALUES (?, ?, ?, ?, ?)")
      .run(new Date().toISOString(), taskType, humanReviewed ? 1 : 0, reused ? 1 : 0, minutes ?? null);
    return Number(result.lastInsertRowid);
  }

  reportIssue(errorType: ErrorType, correctionType: CorrectionType): number {
    const result = this.db
      .prepare("INSERT INTO issue_reports (created_at, error_type, correction_type) VALUES (?, ?, ?)")
      .run(new Date().toISOString(), errorType, correctionType);
    return Number(result.lastInsertRowid);
  }

  consentStatus(): ConsentStatus {
    const records = this.db
      .prepare("SELECT item, kind, granted, scope, period, detail FROM consent_records ORDER BY id")
      .all() as unknown as { item: string; kind: "program-terms" | "opt-in"; granted: number; scope: string | null; period: string | null; detail: string | null }[];
    const items: ConsentItem[] = records.map((r) => ({
      item: r.item,
      kind: r.kind,
      granted: r.granted === 1,
      scope: r.scope,
      period: r.period,
      detail: r.detail,
    }));
    items.push({
      item: "contribution-sharing",
      kind: "opt-in",
      granted: false,
      scope: null,
      period: null,
      detail:
        "Sharing prompts, skills or cases is a separate opt-in contribution with a chosen scope and period. " +
        "It is not available in this version and declining it has no effect on program support.",
    });
    const transmissions = this.db
      .prepare("SELECT sent_at, kind, detail FROM transmissions ORDER BY id")
      .all() as unknown as { sent_at: string; kind: string; detail: string | null }[];
    return {
      items,
      transmissionHistory: transmissions,
      ledgerPath: this.path,
      note: "Nothing has been transmitted from this ledger. Export and delete are under your control at any time.",
    };
  }

  exportTo(outPath: string): { outPath: string; counts: Record<LedgerTable, number> } {
    const resolved = path.resolve(outPath);
    const data: Record<string, unknown> = {
      format: "ax-commons-ledger-export",
      schemaVersion: LEDGER_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      sourcePath: this.path,
    };
    const counts = {} as Record<LedgerTable, number>;
    for (const table of LEDGER_TABLES) {
      const rows = this.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
      data[table] = rows;
      counts[table] = rows.length;
    }
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(data, null, 2) + "\n", "utf8");
    return { outPath: resolved, counts };
  }

  close(): void {
    this.db.close();
  }
}

export function exportLedger(ledgerPath: string, outPath: string): { outPath: string; counts: Record<LedgerTable, number> } {
  const resolved = path.resolve(ledgerPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Ledger not found: ${resolved}`);
  }
  const ledger = new Ledger(resolved);
  try {
    return ledger.exportTo(outPath);
  } finally {
    ledger.close();
  }
}

export function deleteLedger(ledgerPath: string): boolean {
  const resolved = path.resolve(ledgerPath);
  let removed = false;
  for (const suffix of ["", "-wal", "-shm"]) {
    const candidate = resolved + suffix;
    if (fs.existsSync(candidate)) {
      fs.rmSync(candidate);
      removed = true;
    }
  }
  return removed;
}
