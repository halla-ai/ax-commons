import {contentHash, preparePreview, validateConsent} from '../contributions/core.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOKEN = /^[a-f0-9]{64}$/;
const INPUT = ['id', 'candidate', 'hash', 'approved', 'scope', 'expiresAt'];
const PUBLISHING_LEASE_MS = 120000;
const PUBLIC_FIELDS = ['id', 'hash', 'scope', 'expiresAt', 'path', 'type', 'contributor', 'status', 'branch', 'pr', 'url', 'fileSha', 'removalPr', 'reason'];
class InvalidRequest extends Error {}

// Fixed-size comparison for tokens and hashes. Credentials never enter diagnostics.
function equalToken(actual, expected) {
  if (typeof actual !== 'string' || !TOKEN.test(actual) || !TOKEN.test(expected)) return false;
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
function bearer(request) {
  const value = request.headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
}
function pathFor(id) { return `consents/${id.replaceAll('-', '')}.json`; }
function publicRecord(record) { return Object.fromEntries(PUBLIC_FIELDS.filter(key => record[key] !== undefined).map(key => [key, record[key]])); }
function response(value, status = 200) {
  return new Response(JSON.stringify(value), {status, headers: {'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}});
}
function conflict(error) { return error?.name === 'StorageConflict' || error?.constructor?.name === 'StorageConflict'; }

async function readBody(request) {
  if (!request.headers.get('content-type')?.split(';')[0].trim().toLowerCase().endsWith('/json')) throw new InvalidRequest();
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 65536)) throw new InvalidRequest();
  if (!request.body) throw new InvalidRequest();
  const reader = request.body.getReader();
  const chunks = []; let size = 0, timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new InvalidRequest()), 5000); });
  try {
    while (true) {
      const {done, value} = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > 65536) throw new InvalidRequest();
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); } catch { throw new InvalidRequest(); }
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

// Only repository-adapter receipt fields are retained, never arbitrary transport data.
function receiptFields(receipt, id) {
  if (!receipt || typeof receipt !== 'object') throw new Error('Invalid receipt');
  const saved = {};
  if (receipt.branch !== undefined) {
    if (receipt.branch !== `contribution/${id}`) throw new Error('Invalid receipt');
    saved.branch = receipt.branch;
  }
  for (const key of ['pr', 'removalPr']) {
    if (receipt[key] !== undefined) {
      if (!Number.isSafeInteger(receipt[key]) || receipt[key] < 1) throw new Error('Invalid receipt');
      saved[key] = receipt[key];
    }
  }
  if (receipt.url !== undefined) {
    if (typeof receipt.url !== 'string' || !/^https:\/\/github\.com\/halla-ai\/ax-commons\/pull\/[1-9][0-9]*$/.test(receipt.url)) throw new Error('Invalid receipt');
    saved.url = receipt.url;
  }
  if (receipt.fileSha !== undefined) {
    if (typeof receipt.fileSha !== 'string' || !/^[a-f0-9]{40,64}$/.test(receipt.fileSha)) throw new Error('Invalid receipt');
    saved.fileSha = receipt.fileSha;
  }
  if (['current-content-changed', 'withdrawal-content-changed'].includes(receipt.reason)) saved.reason = receipt.reason;
  return saved;
}

/** Authenticated Fetch service. Durable state is metadata only; approved content goes to the commons transport. */
export function createHostedService({store, transport, contributionToken, cronToken, reserveSubmission, now = Date.now, crypto = globalThis.crypto}) {
  if (!TOKEN.test(contributionToken) || !TOKEN.test(cronToken) || contributionToken === cronToken) throw new Error('Hosted credentials required');
  if (!store || !transport) throw new Error('Hosted adapters required');
  async function get(id) {
    const row = await store.getJson(pathFor(id));
    if (row && (row.value.id !== id || !TOKEN.test(row.value.revokeTokenHash))) throw new Error('Invalid consent state');
    return row;
  }
  async function update(id, change) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const row = await get(id);
      if (!row) throw new Error('Consent unavailable');
      const value = change({...row.value});
      try {
        await store.putJson(pathFor(id), value, {expectedSha: row.sha});
        return value;
      } catch (error) { if (!conflict(error)) throw error; }
    }
    throw new Error('Consent contention');
  }
  async function authorizedRecord(request, id) {
    const supplied = bearer(request);
    if (!TOKEN.test(supplied)) return null;
    const row = await get(id);
    return row && equalToken(await contentHash(supplied, crypto), row.value.revokeTokenHash) ? row.value : null;
  }
  async function withdraw(id) {
    let record = await update(id, value => ({...value, revocationRequested: true, status: value.status === 'withdrawn' ? 'withdrawn' : 'withdrawal-pending'}));
    if (record.status === 'withdrawn') return record;
    try {
      const receipt = receiptFields(await transport.revoke(publicRecord(record)), id);
      // Re-read after network: a publisher may have supplied the receipt meanwhile.
      record = await update(id, value => ({...value, ...receipt, revocationRequested: true, status: 'withdrawal-pending'}));
      if (await transport.isRemoved(publicRecord(record))) {
        record = await update(id, value => ({...value, revocationRequested: true, status: 'withdrawn'}));
      }
    } catch {
      record = (await get(id))?.value ?? record;
    }
    return record;
  }
  async function submit(request) {
    let input, preview, consent;
    const withdrawalToken = request.headers.get('x-ax-withdrawal-token');
    try {
      input = await readBody(request);
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== INPUT.length || Object.keys(input).some(key => !INPUT.includes(key)) || typeof input.expiresAt !== 'string' || !UUID.test(input.id) || !TOKEN.test(withdrawalToken)) throw new InvalidRequest();
      preview = await preparePreview(input.candidate, {crypto});
      consent = validateConsent(input, preview.hash, now());
    } catch { return response({error: 'Invalid or unapproved contribution'}, 400); }
    // Nothing has touched the store or transport before validation and exact approval.
    const id = input.id, revokeTokenHash = await contentHash(withdrawalToken, crypto);
    function replay(record) {
      if (!equalToken(revokeTokenHash, record.revokeTokenHash)) return response({error: 'Unauthorized'}, 403);
      if (record.status !== 'withdrawn' || record.hash !== undefined) {
        if (record.hash !== consent.hash || record.scope !== consent.scope || record.expiresAt !== consent.expiresAt) return response({error: 'Contribution ID conflict'}, 409);
      }
      return response({...publicRecord(record), pending: !['submitted', 'withdrawn'].includes(record.status)}, record.status === 'withdrawn' || record.status === 'submitted' ? 200 : 202);
    }
    const existing = await get(id);
    if (existing) return replay(existing.value);
    const budget = reserveSubmission ? await reserveSubmission() : {stopped: false, warning: false};
    if (!budget || typeof budget.stopped !== 'boolean' || typeof budget.warning !== 'boolean') throw new Error('Invalid submission budget');
    if (budget.stopped) {
      const limited = response({error: 'budget_limit_reached'}, 503);
      if (budget.warning) limited.headers.set('x-budget-warning', 'true');
      return limited;
    }
    // A private claim distinguishes identical concurrent createOnly attempts.
    const publicationOwner = crypto.randomUUID();
    const metadata = {id, ...consent, path: preview.path, type: preview.candidate.type, contributor: preview.candidate.contributor, publicationOwner, submitted_at: new Date(now()).toISOString(), revokeTokenHash, revocationRequested: false, status: 'publishing'};
    const created = await store.putJson(pathFor(id), metadata, {createOnly: true});
    if (!created?.value || created.value.id !== id) throw new Error('Consent collision');
    if (created.value.publicationOwner !== publicationOwner) return replay(created.value);
    let record;
    try {
      // Expiry or cron revocation can happen while the initial persistence awaits.
      record = (await get(id)).value;
      if (record.revocationRequested || Date.parse(record.expiresAt) <= now()) {
        record = await withdraw(id);
      } else {
        const receipt = receiptFields(await transport.publish({candidate: preview.candidate, content: preview.content, metadata: publicRecord(record)}), id);
        if (!receipt.branch || !receipt.pr || !receipt.url || !receipt.fileSha) throw new Error('Incomplete publication receipt');
        record = await update(id, value => ({...value, ...receipt, status: value.revocationRequested || Date.parse(value.expiresAt) <= now() ? 'withdrawal-pending' : 'submitted'}));
        if (record.revocationRequested || Date.parse(record.expiresAt) <= now()) record = await withdraw(id);
      }
    } catch {
      try {
        record = await update(id, value => ({...value, status: value.revocationRequested ? 'withdrawal-pending' : 'publication-uncertain'}));
      } catch { record = {...metadata, status: 'publication-uncertain'}; }
    }
    const result = response({...publicRecord(record), pending: record.status !== 'submitted' && record.status !== 'withdrawn'}, record.status === 'submitted' ? 201 : 202);
    if (budget.warning) result.headers.set('x-budget-warning', 'true');
    return result;
  }

  return async function fetch(request) {
    try {
      const url = new URL(request.url);
      if (url.search) return response({error: 'Invalid request'}, 400);
      if (url.pathname === '/v1/contributions' && request.method === 'POST') {
        if (!equalToken(bearer(request), contributionToken)) return response({error: 'Unauthorized'}, 401);
        return await submit(request);
      }
      if (url.pathname === '/v1/expire' && request.method === 'GET') {
        if (!equalToken(bearer(request), cronToken)) return response({error: 'Unauthorized'}, 401);
        const records = await store.listConsents();
        let processed = 0, pending = 0;
        for (const entry of records) {
          if (!UUID.test(entry.id)) throw new Error('Invalid consent listing');
          const record = (await get(entry.id))?.value;
          if (!record || record.status === 'withdrawn') continue;
          // Give active publication its bounded lease. An explicit request or expiry
          // still sets the durable flag, which the publisher re-reads after network.
          const started = Date.parse(record.submitted_at);
          if (record.status === 'publishing' && Number.isFinite(started) && now() - started < PUBLISHING_LEASE_MS) {
            if (record.revocationRequested || Date.parse(record.expiresAt) <= now()) {
              const updated = await update(record.id, value => ({...value, revocationRequested: true}));
              processed++;
              // Publication may have finished between listing and CAS. In that case
              // this request owns cleanup rather than waiting for another cron run.
              const result = updated.status === 'publishing' ? updated : await withdraw(record.id);
              if (result.status !== 'withdrawn') pending++;
            }
            continue;
          }
          if (record.revocationRequested || Date.parse(record.expiresAt) <= now() || ['publishing', 'publication-uncertain', 'withdrawal-pending'].includes(record.status)) {
            const result = await withdraw(record.id); processed++;
            if (result.status !== 'withdrawn') pending++;
          }
        }
        return response({processed, pending});
      }
      const match = url.pathname.match(/^\/v1\/contributions\/([^/]+)$/);
      if (match && UUID.test(match[1]) && ['GET', 'POST', 'DELETE'].includes(request.method)) {
        const id = match[1]; let record = await authorizedRecord(request, id);
        if (!record && request.method === 'DELETE' && TOKEN.test(bearer(request)) && equalToken(request.headers.get('x-ax-participation-token'), contributionToken)) {
          // Allow a preallocated local receipt to be withdrawn before its POST arrives.
          const current = await get(id);
          if (current) return response({error: 'Unauthorized'}, 401);
          const tokenHash = await contentHash(bearer(request), crypto);
          const created = await store.putJson(pathFor(id), {id, revokeTokenHash: tokenHash, status: 'withdrawn', revocationRequested: true}, {createOnly: true});
          if (created?.value?.id === id && equalToken(created.value.revokeTokenHash, tokenHash)) record = created.value;
        }
        if (!record) return response({error: 'Unauthorized'}, 401);
        if (request.method === 'GET') return response(publicRecord(record));
        // Return promptly while publish awaits; durable flag survives process loss.
        if (record.status === 'publishing') {
          const updated = await update(id, value => ({...value, revocationRequested: true, status: value.status === 'publishing' ? 'publishing' : value.status}));
          if (updated.status === 'publishing') return response({...publicRecord(updated), pending: true}, 202);
        }
        const result = await withdraw(id);
        return response({...publicRecord(result), pending: result.status !== 'withdrawn'}, result.status === 'withdrawn' ? 200 : 202);
      }
      return response({error: 'Not found'}, 404);
    } catch { return response({error: 'Service temporarily unavailable'}, 503); }
  };
}
