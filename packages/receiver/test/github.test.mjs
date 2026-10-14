import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GithubStore} from '../src/github-store.mjs';
import {createVercelReceiver} from '../src/vercel.mjs';
function github(privateRepo = true) {
  const files = new Map(); let sequence = 0, forceConflict = false;
  const response = (value, status = 200) => new Response(JSON.stringify(value), {status});
  const fetch = async (url, options = {}) => {
    const path = new URL(url).pathname.replace('/repos/test/state', '');
    if (path === '') return response({private: privateRepo});
    if (path === '/git/trees/HEAD') return response({tree: [...files.keys()].map(path => ({type: 'blob', path})), truncated: false});
    const file = path.replace('/contents/', ''), existing = files.get(file);
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
  return {fetch, files, conflict: () => { forceConflict = true; }};
}
const program = 'a'.repeat(32), token = 'b'.repeat(64), source_id = createHash('sha256').update(token).digest('hex');
const cell = {task_type: 'writing', human_reviewed: true, reused: false, skill_id: null, count: 5};
const snapshot = {version: 1, program_id: program, source_id, period: '2026-10', cells: [cell], contribution_count: 0};
test('GitHub storage enforces private repository and scoped paths', async () => {
  const service = github(false), store = new GithubStore({token: 'test-only', repo: 'test/state', fetch: service.fetch});
  await assert.rejects(store.upsert(snapshot));
  await assert.rejects(store.getJson('../arbitrary.json'));
  assert.equal(service.files.size, 0);
});
test('GitHub adapter replacement retries CAS and freezes release across reopen', async () => {
  const service = github(), options = {token: 'test-only', repo: 'test/state', fetch: service.fetch};
  let store = new GithubStore(options);
  await store.upsert(snapshot); service.conflict(); await store.upsert({...snapshot, cells: [{...cell, count: 9}]});
  store = new GithubStore(options);
  assert.equal((await store.listSnapshots('2026-10'))[0].cells[0].count, 9);
  const first = await store.putRelease('2026-10', {period: '2026-10', marker: 'first'});
  assert.deepEqual(await store.putRelease('2026-10', {marker: 'replacement'}), first);
  await store.revoke(snapshot); assert.deepEqual(await store.listSnapshots('2026-10'), []);
});
test('durable GitHub budget counts concurrent requests without duplicate admissions', async () => {
  const service = github(), store = new GithubStore({token: 'test-only', repo: 'test/state', fetch: service.fetch});
  const results = await Promise.all([store.takeBudget('2026-10', 1), store.takeBudget('2026-10', 1)]);
  assert.equal(results.filter(value => !value.stopped).length, 1);
  assert.equal((await store.budget('2026-10', 1)).requests, 1);
});
test('Vercel handler cap survives reconstruction; revoke and private status stay available', async () => {
  const service = github(), options = {token: 'test-only', repo: 'test/state', fetch: service.fetch};
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
  const service = github(), store = new GithubStore({token: 'test-only', repo: 'test/state', fetch: service.fetch});
  const otherSource = 'f'.repeat(64);
  await store.upsert(snapshot); await store.upsert({...snapshot, source_id: otherSource});
  const handler = createVercelReceiver({store, credentials: {[source_id]: program}, now: () => new Date('2026-10-20T00:00:00Z')});
  const result = await handler(new Request('https://example.test/v1/metrics', {method: 'DELETE', headers: {'content-type': 'application/json', authorization: `Bearer ${token}`}, body: JSON.stringify({program_id: program, period: '2026-10'})}));
  assert.equal(result.status, 200);
  const remaining = await store.listSnapshots('2026-10');
  assert.equal(remaining.length, 1); assert.equal(remaining[0].source_id, otherSource);
});
