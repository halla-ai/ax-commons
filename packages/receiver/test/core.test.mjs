import test from 'node:test';
import assert from 'node:assert/strict';
import {createReceiver, validateSnapshot, suppressSnapshots} from '../src/core.mjs';
import {SqliteStore} from '../src/sqlite.mjs';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import path from 'node:path';
const program = 'a'.repeat(32), device = 'b'.repeat(32);
const cell = {task_type: 'writing', human_reviewed: true, reused: true, skill_id: 'general/general-documents', count: 5};
const snapshot = {version: 1, program_id: program, period: '2026-10', cells: [cell], contribution_count: 0};
function request(method, body) { return new Request('https://example.test/v1/metrics', {method, headers: {'content-type': 'application/json'}, body: JSON.stringify(body)}); }
test('schema rejects small cells, conversation text, PII and arbitrary skill IDs', () => {
  for (const value of [{...snapshot, device_id: device}, {...snapshot, source_id: device}, {...snapshot, conversation: 'PRIVATE CONVERSATION SENTINEL'}, {...snapshot, cells: [{...cell, count: 4}]}, {...snapshot, program_id: 'person@example.test'}, {...snapshot, cells: [{...cell, skill_id: 'person-name'}]}, {...snapshot, cells: [cell, cell]}, {...snapshot, contribution_count: 2}]) assert.throws(() => validateSnapshot(value));
  assert.deepEqual(validateSnapshot(snapshot), snapshot);
});
test('public cells are disjoint counts only, with no device or totals', () => {
  const release = suppressSnapshots([{...snapshot, source_id: device}], '2026-10');
  assert.equal(release.programs[0].cells[0].count, 5);
  assert.equal(JSON.stringify(release).includes(device), false);
  assert.equal('total' in release, false);
});
test('persistent snapshot replacement is idempotent; frozen publication and revocation', async () => {
  const store = new SqliteStore(':memory:'); let date = new Date('2026-10-20T00:00:00Z');
  const handler = createReceiver({store, authenticate: async () => ({program_id: program, source_id: device}), now: () => date});
  try {
    assert.equal((await handler(request('POST', snapshot))).status, 200);
    assert.equal((await handler(request('POST', snapshot))).status, 200);
    assert.equal((await store.listSnapshots('2026-10')).length, 1);
    assert.equal((await handler(new Request('https://example.test/v1/public?period=2026-10'))).status, 409);
    date = new Date('2026-11-08T00:00:00Z');
    const first = await (await handler(new Request('https://example.test/v1/public?period=2026-10'))).json();
    assert.equal(first.programs[0].cells[0].count, 5);
    assert.equal((await handler(request('POST', {...snapshot, cells: [{...cell, count: 9}]}))).status, 409);
    assert.equal((await handler(request('DELETE', {program_id: program, period: '2026-10'}))).status, 200);
    assert.equal((await store.listSnapshots('2026-10')).length, 0);
    assert.deepEqual(await (await handler(new Request('https://example.test/v1/public?period=2026-10'))).json(), first);
    assert.equal((await handler(new Request('https://example.test/v1/public?period=2026-10&program_id=x'))).status, 400);
  } finally { store.close(); }
});
test('unauthenticated and mismatched program submissions fail without storing', async () => {
  const store = new SqliteStore(':memory:');
  try {
    assert.equal((await createReceiver({store, authenticate: async () => null})(request('POST', snapshot))).status, 401);
    assert.equal((await createReceiver({store, authenticate: async () => ({program_id: 'c'.repeat(32), source_id: device})})(request('POST', snapshot))).status, 403);
    assert.equal((await store.listSnapshots('2026-10')).length, 0);
  } finally { store.close(); }
});
test('SQLite survives reopen and never persists rejected conversation sentinel', async () => {
  const directory = mkdtempSync(path.join(process.cwd(), '.receiver-test-'));
  const filename = path.join(directory, 'ledger.sqlite');
  let store = new SqliteStore(filename);
  try {
    const handler = createReceiver({store, authenticate: async () => ({program_id: program, source_id: device}), now: () => new Date('2026-10-20T00:00:00Z')});
    assert.equal((await handler(request('POST', {...snapshot, conversation: 'PRIVATE CONVERSATION SENTINEL'}))).status, 400);
    assert.equal((await handler(request('POST', snapshot))).status, 200);
    store.close(); store = new SqliteStore(filename);
    assert.deepEqual(await store.listSnapshots('2026-10'), [{...snapshot, source_id: device}]);
    assert.equal(readFileSync(filename).includes(Buffer.from('PRIVATE CONVERSATION SENTINEL')), false);
  } finally { store.close(); rmSync(directory, {recursive: true}); }
});
test('grace window closes at UTC day eight; no future or history uploads', async () => {
  const store = new SqliteStore(':memory:');
  try {
    let date = new Date('2026-11-07T23:59:59Z');
    const handler = createReceiver({store, authenticate: async () => ({program_id: program, source_id: device}), now: () => date});
    assert.equal((await handler(request('POST', snapshot))).status, 200);
    date = new Date('2026-11-08T00:00:00Z');
    assert.equal((await handler(request('POST', snapshot))).status, 409);
    assert.equal((await handler(request('POST', {...snapshot, period: '2026-12'}))).status, 409);
    assert.equal((await handler(request('POST', {...snapshot, period: '2025-10'}))).status, 409);
    assert.throws(() => validateSnapshot({...snapshot, program_id: 12345678901234567890123456789012}));
  } finally { store.close(); }
});
