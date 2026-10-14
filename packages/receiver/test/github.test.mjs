import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GithubStore} from '../src/github-store.mjs';
import {createVercelReceiver} from '../src/vercel.mjs';
import {createReceiver} from '../src/core.mjs';
function github(privateRepo = true) {
  const files = new Map(); let sequence = 0, forceConflict = false, pauseWrite = null, customTree = null;
  const response = (value, status = 200) => new Response(JSON.stringify(value), {status});
  const fetch = async (url, options = {}) => {
    const path = new URL(url).pathname.replace('/repos/test/state', '');
    if (path === '') return response({private: privateRepo});
    if (path === '/git/trees/HEAD') return response(customTree ?? {tree: [...files.keys()].map(path => ({type: 'blob', path})), truncated: false});
    const file = path.replace('/contents/', '');
    if (options.method === 'PUT' && pauseWrite) { const pause = pauseWrite; pauseWrite = null; await pause(); }
    const existing = files.get(file);
    if (!options.method) return existing ? response({...existing, type: 'file', encoding: 'base64'}) : response({}, 404);
    const body = JSON.parse(options.body);
    if (forceConflict) { forceConflict = false; return response({}, 409); }
    if (options.method === 'PUT') {
      if ((existing && body.sha !== existing.sha) || (!existing && body.sha)) return response({}, 409);
      const row = {sha: String(++sequence), content: body.content}; files.set(file, row); return response({content: {sha: row.sha}}, 201);
    }
    if (!existing) return response({}, 404);
    if (body.sha !== existing.sha) return response({}, 409);
    files.delete(file); return response({});
  };
  return {fetch, files, setTree: tree => { customTree = tree; }, makePublic: () => { privateRepo = false; }, pause: fn => { pauseWrite = fn; }, conflict: () => { forceConflict = true; }};
}
const program = 'a'.repeat(32), token = 'b'.repeat(64), source_id = createHash('sha256').update(token).digest('hex');
const cell = {task_type: 'writing', human_reviewed: true, reused: false, skill_id: null, count: 5};
const snapshot = {version: 1, program_id: program, source_id, period: '2026-10', cells: [cell], contribution_count: 0};
test('GitHub storage enforces private repository and scoped paths', async () => {
  const service = github(false), store = new GithubStore({token: 'test-only', repo: 'test/state', fetch: service.fetch, now: () => new Date('2026-10-20T00:00:00Z')});
  await assert.rejects(store.upsert(snapshot));
  await assert.rejects(store.getJson('../arbitrary.json'));
  assert.equal(service.files.size, 0);
});
test('GitHub adapter replacement retries CAS and freezes release across reopen', async () => {
  const service = github(), options = {token: 'test-only', repo: 'test/state', fetch: service.fetch, now: () => new Date('2026-10-20T00:00:00Z')};
  let store = new GithubStore(options);
  await store.upsert(snapshot); service.conflict(); await store.upsert({...snapshot, cells: [{...cell, count: 9}]});
  store = new GithubStore(options);
  assert.equal((await store.listSnapshots('2026-10'))[0].cells[0].count, 9);
  store.now = () => new Date('2026-11-08T00:00:00Z');
  const first = await store.putRelease('2026-10', {period: '2026-10', marker: 'first'});
  assert.deepEqual(await store.putRelease('2026-10', {marker: 'replacement'}), first);
  await store.revoke(snapshot); assert.deepEqual(await store.listSnapshots('2026-10'), []);
});
test('durable GitHub budget counts concurrent requests without duplicate admissions', async () => {
  const service = github(), store = new GithubStore({token: 'test-only', repo: 'test/state', fetch: service.fetch, now: () => new Date('2026-10-20T00:00:00Z')});
  const results = await Promise.all([store.takeBudget('2026-10', 1), store.takeBudget('2026-10', 1)]);
  assert.equal(results.filter(value => !value.stopped).length, 1);
  assert.equal((await store.budget('2026-10', 1)).requests, 1);
});
test('Vercel handler cap survives reconstruction; revoke and private status stay available', async () => {
  const service = github(), options = {token: 'test-only', repo: 'test/state', fetch: service.fetch, now: () => new Date('2026-10-20T00:00:00Z')};
  const configure = () => createVercelReceiver({store: new GithubStore(options), credentials: {[source_id]: program}, requestLimit: 1, now: () => new Date('2026-10-20T00:00:00Z')});
  const request = (method, body, endpoint = '/v1/metrics', auth = true) => new Request(`https://example.test${endpoint}`, {method, headers: {'content-type': 'application/json', ...(auth ? {authorization: `Bearer ${token}`} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
  const {source_id: privateSource, ...wire} = snapshot;
  assert.equal((await configure()(request('POST', wire))).status, 200);
  assert.equal((await configure()(request('POST', wire))).status, 503);
  assert.equal((await configure()(request('GET', null, '/v1/budget', false))).status, 401);
  assert.equal((await configure()(request('GET', null, '/v1/budget'))).status, 200);
  assert.equal((await configure()(request('DELETE', {program_id: program, period: '2026-10'}))).status, 200);
  assert.equal(JSON.stringify([...service.files.keys()]).includes('releases/'), false);
});
test('one device credential cannot revoke another source in the same program', async () => {
  const service = github(), store = new GithubStore({token: 'test-only', repo: 'test/state', fetch: service.fetch, now: () => new Date('2026-10-20T00:00:00Z')});
  const otherSource = 'f'.repeat(64);
  await store.upsert(snapshot); await store.upsert({...snapshot, source_id: otherSource});
  const handler = createVercelReceiver({store, credentials: {[source_id]: program}, now: () => new Date('2026-10-20T00:00:00Z')});
  const result = await handler(new Request('https://example.test/v1/metrics', {method: 'DELETE', headers: {'content-type': 'application/json', authorization: `Bearer ${token}`}, body: JSON.stringify({program_id: program, period: '2026-10'})}));
  assert.equal(result.status, 200);
  const remaining = await store.listSnapshots('2026-10');
  assert.equal(remaining.length, 1); assert.equal(remaining[0].source_id, otherSource);
});

test('paused cutoff upload cannot commit after a competing frozen release', async () => {
  const service = github(); let date = new Date('2026-11-07T23:59:59Z');
  const store = new GithubStore({token: 'test-only', repo: 'test/state', fetch: service.fetch, now: () => date});
  await store.upsert(snapshot);
  let unblock, started;
  const entered = new Promise(resolve => { started = resolve; });
  service.pause(async () => { started(); await new Promise(resolve => { unblock = resolve; }); });
  const upload = store.upsert({...snapshot, cells: [{...cell, count: 9}]});
  await entered; date = new Date('2026-11-08T00:00:00Z');
  const release = await store.putRelease('2026-10', {stale: true});
  unblock(); await assert.rejects(upload);
  assert.equal(release.programs[0].cells[0].count, 5);
  assert.equal((await store.listSnapshots('2026-10'))[0].cells[0].count, 5);
});
test('release recomputes from latest snapshot and visibility flips fail closed', async () => {
  const service = github(); let date = new Date('2026-10-20T00:00:00Z');
  const store = new GithubStore({token: 'test-only', repo: 'test/state', fetch: service.fetch, now: () => date});
  await store.upsert(snapshot);
  await store.upsert({...snapshot, cells: [{...cell, count: 9}]});
  date = new Date('2026-11-08T00:00:00Z');
  const release = await store.putRelease('2026-10', {programs: []});
  assert.equal(release.programs[0].cells[0].count, 9);
  service.makePublic(); await assert.rejects(store.getRelease('2026-10'));
  await assert.rejects(store.revoke(snapshot));
});

test('consent listing returns private metadata and ignores malformed paths', async () => {
  const service = github(), store = new GithubStore({token: 'test-only', repo: 'test/state', fetch: service.fetch});
  const path = `consents/${'a'.repeat(32)}.json`, value = {id: 'a'.repeat(32), status: 'approved', expires_at: '2026-11-01'};
  await store.putJson(path, value, {createOnly: true});
  service.setTree({truncated: false, tree: [{type: 'blob', path}, {type: 'blob', path: 'consents/../../private.json'}, {type: 'blob', path: 'consents/person-name.json'}, {type: 'tree', path: `consents/${'b'.repeat(32)}.json`}, {type: 'blob', path: 'months/2026-10.json'}, null]});
  assert.deepEqual(await store.listConsents(), [value]);
  service.makePublic(); await assert.rejects(store.listConsents());
});
test('consent listing rejects truncated or oversized trees and record overflow', async () => {
  const service = github(), store = new GithubStore({token: 'test-only', repo: 'test/state', fetch: service.fetch});
  for (const tree of [{truncated: true, tree: []}, {tree: []}, {truncated: false, tree: Array(10001).fill(null)}, {truncated: false, tree: Array.from({length: 1001}, (_, index) => ({type: 'blob', path: `consents/${index.toString(16).padStart(32, '0')}.json`}))}]) {
    service.setTree(tree); await assert.rejects(store.listConsents());
  }
});

test('independent receivers reject delayed uploads after durable remote revocation', async () => {
  const service = github(); let date = new Date('2026-10-20T00:00:00Z');
  const options = {token: 'test-only', repo: 'test/state', fetch: service.fetch, now: () => date};
  const first = new GithubStore(options), second = new GithubStore(options);
  await first.upsert(snapshot);
  const authenticate = async () => ({program_id: program, source_id});
  const uploadHandler = createReceiver({store: first, authenticate, now: () => date});
  const revokeHandler = createReceiver({store: second, authenticate, now: () => date});
  const {source_id: privateSource, ...wire} = snapshot;
  const request = (method, value) => new Request('https://example.test/v1/metrics', {method, headers: {'content-type': 'application/json'}, body: JSON.stringify(value)});
  let unblock, started;
  const entered = new Promise(resolve => { started = resolve; });
  service.pause(async () => { started(); await new Promise(resolve => { unblock = resolve; }); });
  const upload = uploadHandler(request('POST', {...wire, cells: [{...cell, count: 9}]}));
  await entered;
  assert.equal((await revokeHandler(request('DELETE', {program_id: program, period: '2026-10'}))).status, 200);
  unblock(); assert.equal((await upload).status, 409);
  assert.deepEqual(await second.listSnapshots('2026-10'), []);
  await second.revoke(snapshot);
  assert.equal((await second.readMonth('2026-10')).state.revoked_sources.length, 1);
  await first.upsert({...snapshot, source_id: 'f'.repeat(64)});
  date = new Date('2026-11-08T00:00:00Z');
  const released = await second.putRelease('2026-10');
  await second.revoke({...snapshot, source_id: 'f'.repeat(64)});
  assert.deepEqual(await first.getRelease('2026-10'), released);
});
test('invalid budget limits fail before any storage operation', async () => {
  let reads = 0;
  const store = new GithubStore({token: 'test-only', repo: 'test/state', fetch: async () => { reads++; throw new Error('must not read'); }});
  for (const limit of [NaN, Infinity, 0, -1, 1.5, 100001, '1000', undefined]) {
    await assert.rejects(store.takeBudget('2026-10', limit));
    await assert.rejects(store.budget('2026-10', limit));
  }
  assert.equal(reads, 0);
});
