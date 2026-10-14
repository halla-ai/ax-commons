import {validateSnapshot, suppressSnapshots, uploadEligible, releaseEligible, PeriodClosedError} from './core.mjs';
const SAFE_PATH = /^(?:months\/20[0-9]{2}-(?:0[1-9]|1[0-2])|usage\/20[0-9]{2}-(?:0[1-9]|1[0-2])|consents\/[a-f0-9]{32,64})\.json$/;
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
  async readMonth(period) {
    const row = await this.getJson(`months/${period}.json`);
    const state = row?.value ?? {snapshots: [], release: null};
    if (!state || Object.keys(state).sort().join(',') !== 'release,snapshots' || !Array.isArray(state.snapshots)) throw new Error('Invalid private month state');
    const seen = new Set();
    for (const entry of state.snapshots) {
      const {source_id, ...wire} = entry;
      if (typeof source_id !== 'string' || !/^[a-f0-9]{32,64}$/.test(source_id) || wire.period !== period) throw new Error('Invalid private source');
      validateSnapshot(wire);
      const key = `${wire.program_id}/${source_id}`;
      if (seen.has(key)) throw new Error('Duplicate private source'); seen.add(key);
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
  async mutateMonth(period, mutate) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const {state, sha} = await this.readMonth(period);
      const change = mutate(state);
      if (!change.write) return change.result;
      try { await this.putJson(`months/${period}.json`, state, {expectedSha: sha}); return change.result; }
      catch (error) { if (!(error instanceof StorageConflict)) throw error; }
    }
    throw new Error('Private storage contention');
  }
  async upsert(value) {
    const {source_id, ...wire} = value; validateSnapshot(wire);
    if (typeof source_id !== 'string' || !/^[a-f0-9]{32,64}$/.test(source_id)) throw new Error('Invalid private source');
    return this.mutateMonth(value.period, state => {
      if (!uploadEligible(value.period, this.now()) || state.release !== null) throw new PeriodClosedError();
      state.snapshots = state.snapshots.filter(entry => entry.program_id !== value.program_id || entry.source_id !== source_id);
      state.snapshots.push(value); return {write: true};
    });
  }
  async revoke(value) {
    return this.mutateMonth(value.period, state => {
      const original = state.snapshots.length;
      state.snapshots = state.snapshots.filter(entry => entry.program_id !== value.program_id || entry.source_id !== value.source_id);
      return {write: state.snapshots.length !== original};
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
  async takeBudget(period, limit) {
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
  async budget(period, limit) { const requests = (await this.getJson(`usage/${period}.json`))?.value.requests ?? 0; return {period, requests, limit, warning: requests >= limit * .8, stopped: requests >= limit}; }
}
