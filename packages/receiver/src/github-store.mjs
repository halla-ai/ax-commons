const SAFE_PATH = /^(?:snapshots\/[a-f0-9]{32,64}\/[a-f0-9]{32,64}\/20[0-9]{2}-(?:0[1-9]|1[0-2])|releases\/20[0-9]{2}-(?:0[1-9]|1[0-2])|usage\/20[0-9]{2}-(?:0[1-9]|1[0-2])|consents\/[a-f0-9]{32,64})\.json$/;
export class StorageConflict extends Error {}
export class GithubStore {
  constructor({token, repo, fetch: request = globalThis.fetch}) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || !token) throw new Error('Private storage configuration required');
    this.token = token; this.repo = repo; this.request = request; this.checked = null;
  }
  async call(path, options = {}) {
    return this.request(`https://api.github.com/repos/${this.repo}${path}`, {...options, headers: {'accept': 'application/vnd.github+json', 'authorization': `Bearer ${this.token}`, 'x-github-api-version': '2022-11-28', ...options.headers}});
  }
  async checkPrivate() {
    if (!this.checked) this.checked = (async () => {
      const response = await this.call('');
      if (!response.ok || (await response.json()).private !== true) throw new Error('Storage must be a verified private repository');
    })().catch(error => { this.checked = null; throw error; });
    await this.checked;
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
  snapshotPath(value) { return `snapshots/${value.program_id}/${value.source_id}/${value.period}.json`; }
  async upsert(value) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { await this.putJson(this.snapshotPath(value), value); return; } catch (error) { if (!(error instanceof StorageConflict)) throw error; }
    }
    throw new Error('Private storage contention');
  }
  async revoke(value) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const row = await this.getJson(this.snapshotPath(value)); if (!row) return;
      try { await this.deleteJson(this.snapshotPath(value), row.sha); return; } catch (error) { if (!(error instanceof StorageConflict)) throw error; }
    }
    throw new Error('Private storage contention');
  }
  async listSnapshots(period) {
    if (!/^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Invalid period');
    await this.checkPrivate();
    const metadata = await this.call('/git/trees/HEAD?recursive=1');
    if (!metadata.ok) throw new Error('Private storage unavailable');
    const tree = await metadata.json();
    if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('Private storage listing incomplete');
    const values = [];
    for (const entry of tree.tree) {
      if (entry.type === 'blob' && entry.path.startsWith('snapshots/') && entry.path.endsWith(`/${period}.json`) && SAFE_PATH.test(entry.path)) {
        const row = await this.getJson(entry.path); if (row) values.push(row.value);
      }
    }
    return values;
  }
  async getRelease(period) { return (await this.getJson(`releases/${period}.json`))?.value ?? null; }
  async putRelease(period, value) { return (await this.putJson(`releases/${period}.json`, value, {createOnly: true})).value; }
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
