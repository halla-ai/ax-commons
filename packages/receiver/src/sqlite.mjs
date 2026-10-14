import {DatabaseSync} from 'node:sqlite';
export const SQL_SCHEMA = `
CREATE TABLE IF NOT EXISTS snapshots (
  program_id TEXT NOT NULL, source_id TEXT NOT NULL, period TEXT NOT NULL,
  payload TEXT NOT NULL, PRIMARY KEY (program_id, source_id, period)
);
CREATE TABLE IF NOT EXISTS releases (period TEXT PRIMARY KEY, payload TEXT NOT NULL);
`;
// One serialized receiver instance must own each store. Deployment adapters must
// serialize complete requests, including the read/build/freeze release sequence.
export class SqliteStore {
  constructor(filename) {
    this.db = new DatabaseSync(filename);
    this.db.exec(SQL_SCHEMA);
  }
  async upsert(value) {
    this.db.prepare('INSERT INTO snapshots VALUES (?, ?, ?, ?) ON CONFLICT(program_id, source_id, period) DO UPDATE SET payload=excluded.payload').run(value.program_id, value.source_id, value.period, JSON.stringify(value));
  }
  async revoke(value) {
    this.db.prepare('DELETE FROM snapshots WHERE program_id=? AND source_id=? AND period=?').run(value.program_id, value.source_id, value.period);
  }
  async listSnapshots(period) {
    return this.db.prepare('SELECT payload FROM snapshots WHERE period=?').all(period).map(row => JSON.parse(row.payload));
  }
  async getRelease(period) {
    const row = this.db.prepare('SELECT payload FROM releases WHERE period=?').get(period);
    return row ? JSON.parse(row.payload) : null;
  }
  async putRelease(period, value) {
    this.db.prepare('INSERT OR IGNORE INTO releases VALUES (?, ?)').run(period, JSON.stringify(value));
    return this.getRelease(period);
  }
  close() { this.db.close(); }
}
