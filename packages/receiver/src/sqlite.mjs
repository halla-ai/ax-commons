import {DatabaseSync} from 'node:sqlite';
import {PeriodClosedError, suppressSnapshots} from './core.mjs';
export const SQL_SCHEMA = `
CREATE TABLE IF NOT EXISTS snapshots (
  program_id TEXT NOT NULL, source_id TEXT NOT NULL, period TEXT NOT NULL,
  payload TEXT NOT NULL, PRIMARY KEY (program_id, source_id, period)
);
CREATE TABLE IF NOT EXISTS releases (period TEXT PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS withdrawals (
  program_id TEXT NOT NULL, source_id TEXT NOT NULL, period TEXT NOT NULL,
  PRIMARY KEY (program_id, source_id, period)
);
`;
// Immediate write transactions coordinate independent connections for
// withdrawals, snapshot replacement and immutable release creation.
export class SqliteStore {
  constructor(filename) {
    this.db = new DatabaseSync(filename);
    this.db.exec(SQL_SCHEMA);
    this.db.exec('PRAGMA busy_timeout=5000');
  }
  transaction(action) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = action(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  async upsert(value) {
    return this.transaction(() => {
      if (this.db.prepare('SELECT 1 FROM withdrawals WHERE program_id=? AND source_id=? AND period=?').get(value.program_id, value.source_id, value.period) || this.db.prepare('SELECT 1 FROM releases WHERE period=?').get(value.period)) throw new PeriodClosedError();
      this.db.prepare('INSERT INTO snapshots VALUES (?, ?, ?, ?) ON CONFLICT(program_id, source_id, period) DO UPDATE SET payload=excluded.payload').run(value.program_id, value.source_id, value.period, JSON.stringify(value));
    });
  }
  async revoke(value) {
    return this.transaction(() => {
      this.db.prepare('INSERT OR IGNORE INTO withdrawals VALUES (?,?,?)').run(value.program_id, value.source_id, value.period);
      this.db.prepare('DELETE FROM snapshots WHERE program_id=? AND source_id=? AND period=?').run(value.program_id, value.source_id, value.period);
    });
  }
  async listSnapshots(period) {
    return this.db.prepare('SELECT payload FROM snapshots WHERE period=?').all(period).map(row => JSON.parse(row.payload));
  }
  async getRelease(period) {
    const row = this.db.prepare('SELECT payload FROM releases WHERE period=?').get(period);
    return row ? JSON.parse(row.payload) : null;
  }
  async putRelease(period) {
    return this.transaction(() => {
      const existing = this.db.prepare('SELECT payload FROM releases WHERE period=?').get(period);
      if (existing) return JSON.parse(existing.payload);
      const snapshots = this.db.prepare('SELECT payload FROM snapshots WHERE period=?').all(period).map(row => JSON.parse(row.payload));
      const value = suppressSnapshots(snapshots, period);
      this.db.prepare('INSERT INTO releases VALUES (?, ?)').run(period, JSON.stringify(value));
      return value;
    });
  }
  close() { this.db.close(); }
}
