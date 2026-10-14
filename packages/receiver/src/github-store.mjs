import {validateSnapshot, suppressSnapshots, uploadEligible, releaseEligible, PeriodClosedError, MonthCapacityError} from './core.mjs';
const SAFE_PATH = /^(?:months\/20[0-9]{2}-(?:0[1-9]|1[0-2])|usage\/20[0-9]{2}-(?:0[1-9]|1[0-2])|consents\/[a-f0-9]{32,64})\.json$/;
export const MAX_MONTH_BYTES = 512 * 1024;
export const MAX_MONTH_SOURCES = 1000;
const TOMBSTONE_RESERVE_BYTES = Buffer.byteLength(JSON.stringify({program_id: 'f'.repeat(64), source_id: 'f'.repeat(64)})) + 1;
export class StorageConflict extends Error {}
export class GithubStore {
  constructor({token, repo, fetch: request = globalThis.fetch, now = () => new Date()}) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || !token) throw new Error('Private storage configuration required');
    this.token = token; this.repo = repo; this.request = request; this.now = now;
  }
  async call(path, options = {}) {
    return this.request(`https://api.github.com/repos/${this.repo}${path}`, {...options, headers: {'accept': 'application/vnd.github+json', 'authorization': `Bearer ${this.token}`, 'x-github-api-version': '2022-11-28', ...options.headers}});
  }
  async checkPrivate() {
    const response = await this.call('');
    if (!response.ok || (await response.json()).private !== true) throw new Error('Storage must be a verified private repository');
  }
  async getJson(path) {
    if (!SAFE_PATH.test(path)) throw new Error('Invalid storage path');
    await this.checkPrivate();
    const response = await this.call(`/contents/${path}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Private storage unavailable');
    const item = await response.json();
    if (item.type !== 'file' || item.encoding !== 'base64' || typeof item.sha !== 'string' || typeof item.content !== 'string') throw new Error('Invalid private storage response');
    return {value: JSON.parse(Buffer.from(item.content, 'base64').toString('utf8')), sha: item.sha};
  }
  async putJson(path, value, {createOnly = false, expectedSha} = {}) {
    if (!SAFE_PATH.test(path)) throw new Error('Invalid storage path');
    await this.checkPrivate();
    let sha = expectedSha;
    if (!createOnly && sha === undefined) sha = (await this.getJson(path))?.sha;
    const response = await this.call(`/contents/${path}`, {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify({message: 'Update private structured state', content: Buffer.from(JSON.stringify(value)).toString('base64'), ...(sha ? {sha} : {})})});
    if (response.status === 409 || response.status === 422) {
      if (createOnly) { const existing = await this.getJson(path); if (existing) return existing; }
      throw new StorageConflict('Concurrent state update');
    }
    if (!response.ok) throw new Error('Private storage write failed');
    const result = await response.json();
    return {value, sha: result.content.sha};
  }
  async deleteJson(path, sha) {
    if (!SAFE_PATH.test(path) || !sha) throw new Error('Invalid storage deletion');
    await this.checkPrivate();
    const response = await this.call(`/contents/${path}`, {method: 'DELETE', headers: {'content-type': 'application/json'}, body: JSON.stringify({message: 'Withdraw private structured state', sha})});
    if (response.status === 404) return;
    if (response.status === 409 || response.status === 422) throw new StorageConflict('Concurrent state update');
    if (!response.ok) throw new Error('Private storage deletion failed');
  }
  async listConsents() {
    await this.checkPrivate();
    const response = await this.call('/git/trees/HEAD?recursive=1');
    if (!response.ok) throw new Error('Private consent listing unavailable');
    const tree = await response.json();
    if (tree.truncated !== false || !Array.isArray(tree.tree) || tree.tree.length > 10000) throw new Error('Private consent listing incomplete');
    const paths = new Set();
    for (const entry of tree.tree) {
      if (entry?.type === 'blob' && typeof entry.path === 'string' && /^consents\/[a-f0-9]{32,64}\.json$/.test(entry.path)) paths.add(entry.path);
    }
    if (paths.size > 1000) throw new Error('Private consent listing limit exceeded');
    const values = [];
    for (const path of [...paths].sort()) {
      // Fresh visibility check on each read, including after tree enumeration.
      const row = await this.getJson(path);
      if (row) {
        if (!row.value || typeof row.value !== 'object' || Array.isArray(row.value)) throw new Error('Invalid private consent metadata');
        values.push(row.value);
      }
    }
    return values;
  }
  async readMonth(period) {
    const row = await this.getJson(`months/${period}.json`);
    const state = row?.value ?? {snapshots: [], release: null, revoked_sources: []};
    if (!state || !['release,snapshots', 'release,revoked_sources,snapshots'].includes(Object.keys(state).sort().join(',')) || !Array.isArray(state.snapshots)) throw new Error('Invalid private month state');
    state.revoked_sources ??= [];
    if (!Array.isArray(state.revoked_sources)) throw new Error('Invalid withdrawal state');
    const revoked = new Set();
    for (const source of state.revoked_sources) {
      if (!source || Object.keys(source).sort().join(',') !== 'program_id,source_id' || typeof source.program_id !== 'string' || typeof source.source_id !== 'string' || !/^[a-f0-9]{32,64}$/.test(source.program_id) || !/^[a-f0-9]{32,64}$/.test(source.source_id)) throw new Error('Invalid withdrawal source');
      const key = `${source.program_id}/${source.source_id}`;
      if (revoked.has(key)) throw new Error('Duplicate withdrawal source'); revoked.add(key);
    }
    const seen = new Set();
    for (const entry of state.snapshots) {
      const {source_id, ...wire} = entry;
      if (typeof source_id !== 'string' || !/^[a-f0-9]{32,64}$/.test(source_id) || wire.period !== period) throw new Error('Invalid private source');
      validateSnapshot(wire);
      const key = `${wire.program_id}/${source_id}`;
      if (seen.has(key) || revoked.has(key)) throw new Error('Duplicate or withdrawn private source'); seen.add(key);
    }
    if (state.release !== null) {
      const release = state.release;
      if (!release || Object.keys(release).sort().join(',') !== 'minimum_cell_size,period,programs,version' || release.version !== 1 || release.period !== period || release.minimum_cell_size !== 5 || !Array.isArray(release.programs)) throw new Error('Invalid frozen release');
      for (const program of release.programs) {
        if (Object.keys(program).sort().join(',') !== 'cells,program_id' || !Array.isArray(program.cells)) throw new Error('Invalid frozen program');
        validateSnapshot({version: 1, program_id: program.program_id, period, contribution_count: 0, cells: []});
        // Public aggregated counts may exceed a single snapshot's count bound.
        for (const cell of program.cells) {
          if (!Number.isSafeInteger(cell.count) || cell.count < 5) throw new Error('Invalid frozen count');
          validateSnapshot({version: 1, program_id: program.program_id, period, contribution_count: 0, cells: [{...cell, count: 5}]});
        }
      }
    }
    return {state, sha: row?.sha ?? null};
  }
  sourceKeys(state) {
    return new Set([...state.snapshots, ...state.revoked_sources].map(source => `${source.program_id}/${source.source_id}`));
  }
  admissionFits(state, period) {
    const projected = {...state, release: state.release ?? suppressSnapshots(state.snapshots, period)};
    // Reserve every remaining source slot, including never-uploaded sources.
    const reserve = (MAX_MONTH_SOURCES - state.revoked_sources.length) * TOMBSTONE_RESERVE_BYTES;
    return this.sourceKeys(state).size <= MAX_MONTH_SOURCES && Buffer.byteLength(JSON.stringify(projected)) + reserve <= MAX_MONTH_BYTES;
  }
  async mutateMonth(period, mutate) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const {state, sha} = await this.readMonth(period);
      const change = mutate(state);
      if (!change.write) return change.result;
      if (Buffer.byteLength(JSON.stringify(state)) > MAX_MONTH_BYTES) throw new MonthCapacityError();
      try { await this.putJson(`months/${period}.json`, state, {expectedSha: sha}); return change.result; }
      catch (error) { if (!(error instanceof StorageConflict)) throw error; }
    }
    throw new Error('Private storage contention');
  }
  async upsert(value) {
    const {source_id, ...wire} = value; validateSnapshot(wire);
    if (typeof source_id !== 'string' || !/^[a-f0-9]{32,64}$/.test(source_id)) throw new Error('Invalid private source');
    return this.mutateMonth(value.period, state => {
      if (!uploadEligible(value.period, this.now()) || state.release !== null || state.revoked_sources.some(source => source.program_id === value.program_id && source.source_id === source_id)) throw new PeriodClosedError();
      state.snapshots = state.snapshots.filter(entry => entry.program_id !== value.program_id || entry.source_id !== source_id);
      state.snapshots.push(value);
      if (!this.admissionFits(state, value.period)) throw new MonthCapacityError();
      return {write: true};
    });
  }
  async revoke(value) {
    return this.mutateMonth(value.period, state => {
      const keys = this.sourceKeys(state);
      const sourceKey = `${value.program_id}/${value.source_id}`;
      // A never-admitted source at a permanently full source quota cannot
      // upload later, so no additional tombstone is needed to withdraw it.
      if (!keys.has(sourceKey) && keys.size >= MAX_MONTH_SOURCES) return {write: false};
      if (!state.revoked_sources.some(source => source.program_id === value.program_id && source.source_id === value.source_id)) {
        state.revoked_sources.push({program_id: value.program_id, source_id: value.source_id});
      } else return {write: false};
      state.snapshots = state.snapshots.filter(entry => entry.program_id !== value.program_id || entry.source_id !== value.source_id);
      return {write: true};
    });
  }
  async listSnapshots(period) { return (await this.readMonth(period)).state.snapshots; }
  async getRelease(period) { return (await this.readMonth(period)).state.release; }
  async putRelease(period) {
    return this.mutateMonth(period, state => {
      if (state.release !== null) return {write: false, result: state.release};
      if (!releaseEligible(period, this.now())) throw new PeriodClosedError();
      state.release = suppressSnapshots(state.snapshots, period);
      return {write: true, result: state.release};
    });
  }
  validateBudgetLimit(limit) { if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100000) throw new Error('Invalid budget limit'); }
  async takeBudget(period, limit) {
    this.validateBudgetLimit(limit);
    for (let attempt = 0; attempt < 4; attempt++) {
      const path = `usage/${period}.json`, current = await this.getJson(path);
      const requests = current?.value.requests ?? 0;
      if (!Number.isSafeInteger(requests) || requests < 0) throw new Error('Invalid budget state');
      if (requests >= limit) return {requests, limit, stopped: true, warning: true};
      try { await this.putJson(path, {requests: requests + 1}, {expectedSha: current?.sha ?? null}); return {requests: requests + 1, limit, stopped: false, warning: requests + 1 >= limit * .8}; }
      catch (error) { if (!(error instanceof StorageConflict)) throw error; }
    }
    throw new Error('Private budget contention');
  }
  async budget(period, limit) { this.validateBudgetLimit(limit); const requests = (await this.getJson(`usage/${period}.json`))?.value.requests ?? 0; if (!Number.isSafeInteger(requests) || requests < 0) throw new Error('Invalid budget state'); return {period, requests, limit, warning: requests >= limit * .8, stopped: requests >= limit}; }
}
