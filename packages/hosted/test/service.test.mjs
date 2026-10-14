import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createHostedService} from '../service.mjs';
import {preparePreview, contentHash} from '../../contributions/core.mjs';

const participation = 'a'.repeat(64), cron = 'b'.repeat(64);
const keys = new Map();
const withdrawalKey = id => keys.get(id);
const clock = Date.parse('2026-10-14T12:00:00Z');
const candidate = {type: 'prompt', slug: 'safe-example', purpose: 'Draft a fictional checklist', sources: ['https://example.org/reference'], reviewer: 'domain-reviewer', version: '1.0.0', sunset: 'full', issuePath: 'https://github.com/halla-ai/ax-commons/issues', content: 'Use fictional quantities and mark missing facts.', contributor: 'sample-writer'};
class StorageConflict extends Error {}
function memoryStore() {
  const rows = new Map(); let sequence = 0;
  return {
    rows, calls: [],
    async getJson(path) { this.calls.push('get'); return structuredClone(rows.get(path) ?? null); },
    async putJson(path, value, options = {}) {
      this.calls.push('put'); const existing = rows.get(path);
      if (options.createOnly && existing) return structuredClone(existing);
      if (!options.createOnly && options.expectedSha !== existing?.sha) throw new StorageConflict();
      const result = {value: structuredClone(value), sha: String(++sequence)};
      rows.set(path, result); return structuredClone(result);
    },
    async listConsents() { return [...rows.values()].map(row => structuredClone(row.value)); },
  };
}
function transport() {
  return {
    calls: [], removed: false,
    async publish({metadata}) { this.calls.push('publish'); return {branch: `contribution/${metadata.id}`, pr: 21, url: 'https://github.com/halla-ai/ax-commons/pull/21', fileSha: 'c'.repeat(40)}; },
    async revoke(record) { this.calls.push(['revoke', record.id]); return {status: 'withdrawal-pending', removalPr: 22}; },
    async isRemoved() { this.calls.push('isRemoved'); return this.removed; },
  };
}
function handler(store, adapter, time = () => clock) { return createHostedService({store, transport: adapter, contributionToken: participation, cronToken: cron, now: time, crypto: webcrypto}); }
function request(path, token, method = 'GET', body) { return new Request(`https://service.invalid${path}`, {method, headers: {authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(body?.id ? {'x-ax-withdrawal-token': withdrawalKey(body.id)} : {})}, ...(body === undefined ? {} : {body: JSON.stringify(body)})}); }
async function submission(overrides = {}) { const preview = await preparePreview(candidate, {crypto: webcrypto}); const id = overrides.id ?? webcrypto.randomUUID(); if (!keys.has(id)) keys.set(id, await contentHash(id, webcrypto)); return {id, candidate, hash: preview.hash, approved: true, scope: 'public', expiresAt: '2026-10-15T12:00:00Z', ...overrides}; }

test('exact approval and safety gate run before storage or transmission', async () => {
  for (const overrides of [{approved: false}, {hash: 'd'.repeat(64)}, {scope: 'reviewers-only'}, {expiresAt: '2026-10-13'}, {candidate: {...candidate, content: 'contact person@example.org'}}, {candidate: {...candidate, conversation: 'private'}}]) {
    const store = memoryStore(), adapter = transport();
    const response = await handler(store, adapter)(request('/v1/contributions', participation, 'POST', await submission(overrides)));
    assert.equal(response.status, 400); assert.deepEqual(store.calls, []); assert.deepEqual(adapter.calls, []);
    assert.ok(!(await response.text()).includes('person@example.org'));
  }
});

test('participation authorization rejects public submissions before touching state', async () => {
  const store = memoryStore(), adapter = transport();
  assert.equal((await handler(store, adapter)(request('/v1/contributions', 'c'.repeat(64), 'POST', await submission()))).status, 401);
  assert.deepEqual(store.calls, []); assert.deepEqual(adapter.calls, []);
});

test('successful receipt stores no content or bearer secrets; per-contribution auth isolates records', async () => {
  const store = memoryStore(), adapter = transport(), fetch = handler(store, adapter);
  const response = await fetch(request('/v1/contributions', participation, 'POST', await submission()));
  assert.equal(response.status, 201); const result = await response.json();
  assert.ok(!('revocationToken' in result));
  const saved = JSON.stringify([...store.rows.values()]);
  assert.ok(!saved.includes(candidate.content)); assert.ok(!saved.includes(withdrawalKey(result.id))); assert.ok(!saved.includes(participation));
  const other = await (await fetch(request('/v1/contributions', participation, 'POST', await submission()))).json();
  assert.equal((await fetch(request(`/v1/contributions/${result.id}`, withdrawalKey(other.id)))).status, 401);
  const status = await (await fetch(request(`/v1/contributions/${result.id}`, withdrawalKey(result.id)))).json();
  assert.equal(status.status, 'submitted'); assert.ok(!('revokeTokenHash' in status)); assert.ok(!('revocationToken' in status));
});

test('revocation during delayed publication survives CAS and removes only after readback', async () => {
  const store = memoryStore(), adapter = transport(); let release, entered;
  const blocked = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const original = adapter.publish;
  adapter.publish = async function(args) { entered(args.metadata.id); await blocked; return original.call(this, args); };
  const fetch = handler(store, adapter);
  const submitting = fetch(request('/v1/contributions', participation, 'POST', await submission()));
  const id = await started;
  // Test knows a token chosen by deterministic random bytes; client normally receives it on completion.
  const revokeToken = withdrawalKey(id);
  const path = `consents/${id.replaceAll('-', '')}.json`;
  const row = store.rows.get(path); row.value.revokeTokenHash = await contentHash(revokeToken, webcrypto);
  const revoking = await fetch(request(`/v1/contributions/${id}`, revokeToken, 'DELETE'));
  assert.equal(revoking.status, 202); assert.equal(store.rows.get(path).value.revocationRequested, true);
  adapter.removed = true; release();
  const final = await (await submitting).json(); assert.equal(final.status, 'withdrawn');
  assert.ok(adapter.calls.some(call => Array.isArray(call) && call[0] === 'revoke'));
  assert.equal(store.rows.get(path).value.revocationRequested, true);
});

test('network failure preserves uncertain metadata and a withdrawal credential across restart', async () => {
  const store = memoryStore(), adapter = transport(); adapter.publish = async () => { throw new Error('secret upstream body'); };
  const response = await handler(store, adapter)(request('/v1/contributions', participation, 'POST', await submission()));
  assert.equal(response.status, 202); const result = await response.json(); assert.equal(result.status, 'publication-uncertain'); assert.equal(result.pending, true);
  assert.ok(!JSON.stringify(result).includes('secret upstream'));
  adapter.removed = false;
  let restarted = handler(store, adapter);
  const pending = await (await restarted(request('/v1/expire', cron))).json(); assert.deepEqual(pending, {processed: 1, pending: 1});
  assert.equal((await (await restarted(request(`/v1/contributions/${result.id}`, withdrawalKey(result.id)))).json()).status, 'withdrawal-pending');
  adapter.removed = true; restarted = handler(store, adapter);
  assert.deepEqual(await (await restarted(request('/v1/expire', cron))).json(), {processed: 1, pending: 0});
});

test('expiry sweep requires cron auth and persists pending removal until maintainer merge readback', async () => {
  const store = memoryStore(), adapter = transport();
  const submitted = await (await handler(store, adapter)(request('/v1/contributions', participation, 'POST', await submission()))).json();
  const fetch = handler(store, adapter, () => clock + 2 * 86400000);
  assert.equal((await fetch(request('/v1/expire', participation))).status, 401);
  assert.deepEqual(await (await fetch(request('/v1/expire', cron))).json(), {processed: 1, pending: 1});
  assert.equal((await (await fetch(request(`/v1/contributions/${submitted.id}`, withdrawalKey(submitted.id)))).json()).status, 'withdrawal-pending');
  adapter.removed = true;
  assert.deepEqual(await (await fetch(request('/v1/expire', cron))).json(), {processed: 1, pending: 0});
});

test('post-publish expiry invokes withdrawal instead of reporting submitted', async () => {
  const store = memoryStore(), adapter = transport(); let time = clock;
  const original = adapter.publish;
  adapter.publish = async function(args) { const result = await original.call(this, args); time += 2 * 86400000; return result; };
  adapter.removed = false;
  const result = await (await handler(store, adapter, () => time)(request('/v1/contributions', participation, 'POST', await submission()))).json();
  assert.equal(result.status, 'withdrawal-pending'); assert.equal(result.pending, true);
});

test('CAS conflict retries merge a concurrent revocation rather than overwriting it', async () => {
  const store = memoryStore(), adapter = transport(); const original = store.putJson;
  let inject = true;
  store.putJson = async function(path, value, options) {
    if (!options.createOnly && inject) {
      inject = false; const current = this.rows.get(path);
      current.value.revocationRequested = true; current.sha = 'concurrent'; throw new StorageConflict();
    }
    return original.call(this, path, value, options);
  };
  adapter.removed = true;
  const result = await (await handler(store, adapter)(request('/v1/contributions', participation, 'POST', await submission()))).json();
  assert.equal(result.status, 'withdrawn');
  assert.equal([...store.rows.values()][0].value.revocationRequested, true);
});

test('body byte bound and unknown fields are rejected before adapters', async () => {
  const store = memoryStore(), adapter = transport(), fetch = handler(store, adapter);
  assert.equal((await fetch(request('/v1/contributions', participation, 'POST', {text: 'z'.repeat(65537)}))).status, 400);
  assert.equal((await fetch(request('/v1/contributions', participation, 'POST', await submission({extra: 'forbidden'})))).status, 400);
  assert.deepEqual(store.calls, []); assert.deepEqual(adapter.calls, []);
});

test('restart recovers an orphaned unexpired publishing row by deterministic withdrawal', async () => {
  const store = memoryStore(), adapter = transport();
  const id = webcrypto.randomUUID(), revokeToken = 'f'.repeat(64);
  const preview = await preparePreview(candidate, {crypto: webcrypto});
  await store.putJson(`consents/${id.replaceAll('-', '')}.json`, {
    id, hash: preview.hash, path: preview.path, type: candidate.type, contributor: candidate.contributor,
    scope: 'public', expiresAt: '2026-10-15T12:00:00Z', submitted_at: new Date(clock).toISOString(), status: 'publishing',
    revocationRequested: false, revokeTokenHash: await contentHash(revokeToken, webcrypto),
  }, {createOnly: true});
  adapter.removed = true;
  const active = handler(store, adapter);
  assert.deepEqual(await (await active(request('/v1/expire', cron))).json(), {processed: 0, pending: 0});
  assert.deepEqual(adapter.calls, []);
  const restarted = handler(store, adapter, () => clock + 120001);
  assert.deepEqual(await (await restarted(request('/v1/expire', cron))).json(), {processed: 1, pending: 0});
  assert.deepEqual(adapter.calls[0], ['revoke', id]);
  assert.equal((await (await restarted(request(`/v1/contributions/${id}`, revokeToken))).json()).status, 'withdrawn');
});

test('streamed body cannot evade byte bounds without content-length', async () => {
  const store = memoryStore(), adapter = transport();
  const stream = new ReadableStream({start(controller) { controller.enqueue(new Uint8Array(40000)); controller.enqueue(new Uint8Array(40000)); controller.close(); }});
  const req = new Request('https://service.invalid/v1/contributions', {method: 'POST', headers: {authorization: `Bearer ${participation}`, 'content-type': 'application/json'}, body: stream, duplex: 'half'});
  assert.equal((await handler(store, adapter)(req)).status, 400);
  assert.deepEqual(store.calls, []); assert.deepEqual(adapter.calls, []);
});

test('unsafe or incomplete transport receipt is not persisted or reported submitted', async () => {
  for (const result of [{status: 'submitted'}, {url: 'https://evil.invalid/token', content: candidate.content}]) {
    const store = memoryStore(), adapter = transport(); adapter.publish = async () => result;
    const response = await handler(store, adapter)(request('/v1/contributions', participation, 'POST', await submission()));
    assert.equal(response.status, 202); assert.equal((await response.json()).status, 'publication-uncertain');
    assert.ok(!JSON.stringify([...store.rows.values()]).includes('evil.invalid'));
    assert.ok(!JSON.stringify([...store.rows.values()]).includes(candidate.content));
  }
});

test('cron expiry within an active publishing lease sets a flag and publisher owns cleanup', async () => {
  const store = memoryStore(), adapter = transport(); let release, entered, time = clock;
  const blocked = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const original = adapter.publish;
  adapter.publish = async function(args) { entered(); await blocked; return original.call(this, args); };
  const fetch = handler(store, adapter, () => time);
  const pending = fetch(request('/v1/contributions', participation, 'POST', await submission({expiresAt: new Date(clock + 1000).toISOString()})));
  await started; time += 1001;
  assert.deepEqual(await (await fetch(request('/v1/expire', cron))).json(), {processed: 1, pending: 1});
  assert.equal([...store.rows.values()][0].value.revocationRequested, true);
  assert.deepEqual(adapter.calls, []);
  adapter.removed = true; release();
  assert.equal((await (await pending).json()).status, 'withdrawn');
});

test('durable submission budget runs only after safety and exact approval', async () => {
  const store = memoryStore(), adapter = transport(); let reservations = 0, stopped = false;
  const fetch = createHostedService({store, transport: adapter, contributionToken: participation, cronToken: cron, now: () => clock, crypto: webcrypto,
    reserveSubmission: async () => { reservations++; return {stopped, warning: true}; }});
  for (const overrides of [{approved: false}, {candidate: {...candidate, content: 'contact person@example.org'}}, {hash: 'f'.repeat(64)}, {scope: 'reviewers-only'}, {expiresAt: '2026-10-13'}]) {
    assert.equal((await fetch(request('/v1/contributions', participation, 'POST', await submission(overrides)))).status, 400);
  }
  assert.equal(reservations, 0); assert.deepEqual(store.calls, []); assert.deepEqual(adapter.calls, []);
  const accepted = await fetch(request('/v1/contributions', participation, 'POST', await submission()));
  assert.equal(accepted.status, 201); assert.equal(accepted.headers.get('x-budget-warning'), 'true'); assert.equal(reservations, 1);
  const record = await accepted.json();
  stopped = true;
  const oldCalls = store.calls.length, oldTransport = adapter.calls.length;
  const rejected = await fetch(request('/v1/contributions', participation, 'POST', await submission()));
  assert.equal(rejected.status, 503); assert.deepEqual(await rejected.json(), {error: 'budget_limit_reached'});
  assert.equal(reservations, 2); assert.equal(store.calls.length, oldCalls + 1); assert.equal(adapter.calls.length, oldTransport); assert.equal(store.rows.size, 1);
  assert.equal((await fetch(request(`/v1/contributions/${record.id}`, withdrawalKey(record.id)))).status, 200);
  assert.equal((await fetch(request(`/v1/contributions/${record.id}`, withdrawalKey(record.id), 'DELETE'))).status, 202);
  assert.equal((await fetch(request('/v1/expire', cron))).status, 200);
  assert.equal(reservations, 2);
});

test('lost initial response can be retried with the saved ID/key without quota or republication', async () => {
  const store = memoryStore(), adapter = transport(); let reservations = 0;
  const fetch = createHostedService({store, transport: adapter, contributionToken: participation, cronToken: cron, now: () => clock, crypto: webcrypto,
    reserveSubmission: async () => { reservations++; return {stopped: false, warning: false}; }});
  const input = await submission();
  await fetch(request('/v1/contributions', participation, 'POST', input)); // Simulate a response lost by the caller.
  const retry = await fetch(request('/v1/contributions', participation, 'POST', input));
  assert.equal(retry.status, 200); const status = await retry.json();
  assert.equal(status.id, input.id); assert.equal(status.status, 'submitted');
  assert.ok(!JSON.stringify(status).includes(withdrawalKey(input.id))); assert.ok(!('revocationToken' in status));
  assert.equal(reservations, 1); assert.equal(adapter.calls.filter(value => value === 'publish').length, 1);
  assert.equal((await fetch(request(`/v1/contributions/${input.id}`, withdrawalKey(input.id)))).status, 200);
  const changed = await fetch(request('/v1/contributions', participation, 'POST', {...input, expiresAt: '2026-10-16T12:00:00Z'}));
  assert.equal(changed.status, 409); assert.equal(reservations, 1);
  const wrong = request('/v1/contributions', participation, 'POST', input); wrong.headers.set('x-ax-withdrawal-token', 'f'.repeat(64));
  assert.equal((await fetch(wrong)).status, 403); assert.equal(reservations, 1);
});

test('two service instances with the same id have exactly one atomic publication winner', async () => {
  const store = memoryStore(), adapter = transport();
  const originalGet = store.getJson, originalPut = store.putJson;
  let arrivals = 0, release, createAttempts = 0;
  const barrier = new Promise(resolve => { release = resolve; });
  store.getJson = async function(path) {
    const result = await originalGet.call(this, path);
    if (arrivals < 2) { arrivals++; if (arrivals === 2) release(); await barrier; }
    return result;
  };
  store.putJson = async function(path, value, options) { if (options.createOnly) createAttempts++; return originalPut.call(this, path, value, options); };
  const first = handler(store, adapter), second = handler(store, adapter);
  const input = await submission();
  const results = await Promise.all([first(request('/v1/contributions', participation, 'POST', input)), second(request('/v1/contributions', participation, 'POST', input))]);
  assert.ok(results.every(result => [200, 201, 202].includes(result.status)));
  assert.equal(createAttempts, 2);
  assert.equal(store.rows.size, 1); assert.equal(adapter.calls.filter(value => value === 'publish').length, 1);
  assert.equal([...store.rows.values()][0].value.status, 'submitted');
});

test('participation-authorized preemptive withdrawal tombstone blocks late submission', async () => {
  const store = memoryStore(), adapter = transport(), fetch = handler(store, adapter), input = await submission();
  const unknown = request(`/v1/contributions/${input.id}`, withdrawalKey(input.id), 'DELETE');
  assert.equal((await fetch(unknown)).status, 401); assert.equal(store.rows.size, 0);
  const authorized = request(`/v1/contributions/${input.id}`, withdrawalKey(input.id), 'DELETE');
  authorized.headers.set('x-ax-participation-token', participation);
  const tombstone = await fetch(authorized); assert.equal(tombstone.status, 200); assert.equal((await tombstone.json()).status, 'withdrawn');
  const saved = [...store.rows.values()][0].value;
  assert.deepEqual(Object.keys(saved).sort(), ['id', 'revokeTokenHash', 'revocationRequested', 'status'].sort());
  assert.ok(!JSON.stringify(saved).includes(withdrawalKey(input.id)));
  const late = await fetch(request('/v1/contributions', participation, 'POST', input));
  assert.equal(late.status, 200); assert.equal((await late.json()).status, 'withdrawn'); assert.deepEqual(adapter.calls, []);
  const badKey = request(`/v1/contributions/${input.id}`, 'f'.repeat(64));
  assert.equal((await fetch(badKey)).status, 401);
});

test('missing or invalid client identity fails before state and publication', async () => {
  const store = memoryStore(), adapter = transport(), fetch = handler(store, adapter);
  const input = await submission();
  const absentKey = request('/v1/contributions', participation, 'POST', input); absentKey.headers.delete('x-ax-withdrawal-token');
  assert.equal((await fetch(absentKey)).status, 400);
  assert.equal((await fetch(request('/v1/contributions', participation, 'POST', {...input, id: '../not-a-uuid'}))).status, 400);
  assert.deepEqual(store.calls, []); assert.deepEqual(adapter.calls, []);
});
