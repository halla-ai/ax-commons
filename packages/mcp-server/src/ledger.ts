import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const LEDGER_SCHEMA_VERSION = 2;

// Structured value domains. These are the only strings the ledger accepts;
// free-text conversation content has no column to land in.
export const TASK_TYPES = ["document-summary", "translation", "writing", "coding", "data", "other"] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export const SKILL_IDS = ["general/summary-with-evidence", "general/bilingual-translation", "general/general-documents", "small-business/promotion-and-replies", "career/job-documents", "hospitality/multilingual-replies", "agriculture/work-logs-and-settlements"] as const;
export type SkillId = (typeof SKILL_IDS)[number];
export const ERROR_TYPES = ["wrong-facts", "unhelpful", "refused", "format", "other"] as const;
export type ErrorType = (typeof ERROR_TYPES)[number];
export const CORRECTION_TYPES = ["manual-fix", "retry", "abandoned", "other"] as const;
export type CorrectionType = (typeof CORRECTION_TYPES)[number];

export const INTENT_REASONS = ["save-time", "improve-quality", "reduce-errors", "learn-skill", "other"] as const;
export type IntentReason = (typeof INTENT_REASONS)[number];
export const MAX_MINUTES = 24 * 60;

export const LEDGER_TABLES = ["intents", "task_logs", "issue_reports", "consent_records", "transmissions"] as const;
export type LedgerTable = (typeof LEDGER_TABLES)[number];

const PROGRAM_TERMS_ITEM = "aggregate-measurement";
const PROGRAM_TERMS_DETAIL =
  "Minimal aggregate counts (task type, human-review flag, reuse flag) are part of the program terms. " +
  "Only configured, explicitly approved monthly counts may be sent; small cells below five are suppressed. Contribution sharing is a separate optional approval. Transmission history records completed sends.";

const MIGRATIONS: readonly string[][] = [
  [
    `CREATE TABLE intents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      work_type TEXT NOT NULL CHECK (work_type IN (${TASK_TYPES.map((t) => `'${t}'`).join(", ")})),
      reason TEXT NOT NULL CHECK (reason IN (${INTENT_REASONS.map((t) => `'${t}'`).join(", ")}))
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
  ],
  [
    `ALTER TABLE task_logs ADD COLUMN skill_id TEXT CHECK (skill_id IS NULL OR skill_id IN (${SKILL_IDS.map((id) => `'${id}'`).join(", ")}))`,
    `CREATE TABLE IF NOT EXISTS bridge_contributions (id TEXT PRIMARY KEY, hash TEXT NOT NULL, scope TEXT NOT NULL, expires_at TEXT NOT NULL, submitted_at TEXT NOT NULL, status TEXT NOT NULL, revoke_token TEXT, pr_url TEXT)`,
    `CREATE TABLE IF NOT EXISTS bridge_metrics (period TEXT PRIMARY KEY, enabled INTEGER NOT NULL, status TEXT NOT NULL)`,
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
  private db!: DatabaseSync;
  private ino = 0;

  constructor(dbPath: string) {
    this.path = path.resolve(dbPath);
    this.open();
  }

  private open(): void {
    // User-only permissions: the ledger is personal. SQLite gives its journal
    // files the same mode as the database file.
    fs.mkdirSync(path.dirname(this.path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(this.path);
    fs.chmodSync(this.path, 0o600);
    this.ino = fs.statSync(this.path).ino;
    // Two clients (e.g. Claude Desktop and another app) may run the server at once;
    // wait for the other writer instead of failing a log with SQLITE_BUSY.
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.migrate();
  }

  // The user may delete the ledger file while the server runs, and another
  // server may already have recreated it. Reopen whenever the path no longer
  // names the file we hold, instead of writing into the deleted file.
  private live(): DatabaseSync {
    let ino: number | undefined;
    try {
      ino = fs.statSync(this.path).ino;
    } catch {
      ino = undefined;
    }
    if (ino !== this.ino) {
      this.db.close();
      this.open();
    }
    return this.db;
  }

  private migrate(): void {
    // One transaction per step, so a failed migration leaves no half-built schema.
    // BEGIN IMMEDIATE takes the write lock before reading user_version, so two
    // servers starting on a fresh ledger cannot both run the same step.
    for (;;) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const { user_version: version } = this.db.prepare("PRAGMA user_version").get() as { user_version: number };
        if (version >= MIGRATIONS.length) {
          this.db.exec("COMMIT");
          return;
        }
        for (const statement of MIGRATIONS[version] ?? []) {
          this.db.exec(statement);
        }
        if (version === 0) {
          // Seed the program-terms consent record with bound parameters;
          // never interpolate text into migration SQL.
          this.db
            .prepare("INSERT INTO consent_records (recorded_at, item, kind, granted, scope, period, detail) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(new Date().toISOString(), PROGRAM_TERMS_ITEM, "program-terms", 1, "program", null, PROGRAM_TERMS_DETAIL);
        }
        this.db.exec(`PRAGMA user_version = ${version + 1}`);
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
  }

  declareIntent(workType: TaskType, reason: IntentReason): number {
    const result = this.live()
      .prepare("INSERT INTO intents (created_at, work_type, reason) VALUES (?, ?, ?)")
      .run(new Date().toISOString(), workType, reason);
    return Number(result.lastInsertRowid);
  }

  logTask(taskType: TaskType, humanReviewed: boolean, reused: boolean, minutes?: number, skillId?: SkillId): number {
    const result = this.live()
      .prepare("INSERT INTO task_logs (created_at, task_type, human_reviewed, reused, minutes, skill_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run(new Date().toISOString(), taskType, humanReviewed ? 1 : 0, reused ? 1 : 0, minutes ?? null, skillId ?? null);
    return Number(result.lastInsertRowid);
  }

  reportIssue(errorType: ErrorType, correctionType: CorrectionType): number {
    const result = this.live()
      .prepare("INSERT INTO issue_reports (created_at, error_type, correction_type) VALUES (?, ?, ?)")
      .run(new Date().toISOString(), errorType, correctionType);
    return Number(result.lastInsertRowid);
  }

  consentStatus(): ConsentStatus {
    const records = this.live()
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
        "Nothing is shared before exact-content preview and approval. Declining has no effect on program support.",
    });
    const transmissions = this.db
      .prepare("SELECT sent_at, kind, detail FROM transmissions ORDER BY id")
      .all() as unknown as { sent_at: string; kind: string; detail: string | null }[];
    return {
      items,
      transmissionHistory: transmissions,
      ledgerPath: this.path,
      note: "Transmission history lists completed sends. Export and delete are under your control; remote withdrawal is separate from local deletion.",
    };
  }

  exportTo(outPath: string): { outPath: string; counts: Record<LedgerTable, number> } {
    const resolved = path.resolve(outPath);
    if (isLedgerFile(resolved, this.path)) {
      throw new Error("Export path must not be the ledger file or its journal; choose another file.");
    }
    const data: Record<string, unknown> = {
      format: "ax-commons-ledger-export",
      schemaVersion: LEDGER_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      sourcePath: this.path,
    };
    const counts = {} as Record<LedgerTable, number>;
    for (const table of LEDGER_TABLES) {
      const rows = this.live().prepare(`SELECT * FROM ${table} ORDER BY id`).all();
      data[table] = rows;
      counts[table] = rows.length;
    }
    data.bridge_contributions = this.live().prepare("SELECT id, hash, scope, expires_at, submitted_at, status, pr_url FROM bridge_contributions ORDER BY submitted_at").all();
    data.bridge_metrics = this.live().prepare("SELECT period, enabled, status FROM bridge_metrics ORDER BY period").all();
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(data, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    return { outPath: resolved, counts };
  }

  close(): void {
    this.db.close();
  }
}

// Writing the export over the ledger (or its SQLite sidecars) would destroy it.
// Compare resolved real paths, so symlinks are caught, and inodes, so hard links
// and case-insensitive file names are caught.
function isLedgerFile(target: string, ledgerPath: string): boolean {
  const real = (p: string): string => {
    try {
      return fs.realpathSync(p);
    } catch {
      try {
        return path.join(fs.realpathSync(path.dirname(p)), path.basename(p));
      } catch {
        return p;
      }
    }
  };
  const targetReal = real(target);
  const ledgerReal = real(ledgerPath);
  const ledgerFiles = ["", "-wal", "-shm", "-journal"].map((suffix) => ledgerReal + suffix);
  if (ledgerFiles.includes(targetReal)) return true;
  if (!fs.existsSync(targetReal)) return false;
  const { dev, ino } = fs.statSync(targetReal);
  return ledgerFiles.some((file) => {
    if (!fs.existsSync(file)) return false;
    const other = fs.statSync(file);
    return other.dev === dev && other.ino === ino;
  });
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
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const candidate = resolved + suffix;
    if (fs.existsSync(candidate)) {
      fs.rmSync(candidate);
      removed = true;
    }
  }
  return removed;
}
