export const MIN_CELL = 5;
export const TASK_TYPES = ['document-summary', 'translation', 'writing', 'coding', 'data', 'other'];
export const SKILL_IDS = ['general/summary-with-evidence', 'general/bilingual-translation', 'general/general-documents', 'small-business/promotion-and-replies', 'career/job-documents', 'hospitality/multilingual-replies', 'agriculture/work-logs-and-settlements'];
const ID = /^[a-f0-9]{32,64}$/;
const PERIOD = /^20[0-9]{2}-(0[1-9]|1[0-2])$/;
export class InvalidPayload extends Error {}
export class PeriodClosedError extends Error {}
export class MonthCapacityError extends Error {}
const reject = () => { throw new InvalidPayload('Invalid aggregate payload'); };
function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== keys.sort().join(',')) reject();
}
export function validateIdentity(value) {
  exact(value, ['program_id', 'period']);
  if (typeof value.program_id !== 'string' || typeof value.period !== 'string' || !ID.test(value.program_id) || !PERIOD.test(value.period)) reject();
  return value;
}
const key = cell => JSON.stringify([cell.task_type, cell.human_reviewed, cell.reused, cell.skill_id]);
export function validateSnapshot(value) {
  exact(value, ['version', 'program_id', 'period', 'cells', 'contribution_count']);
  validateIdentity({program_id: value.program_id, period: value.period});
  if (value.version !== 1 || !Array.isArray(value.cells) || value.cells.length > 192 || !Number.isSafeInteger(value.contribution_count) || value.contribution_count < 0 || value.contribution_count > 1000000 || (value.contribution_count > 0 && value.contribution_count < MIN_CELL)) reject();
  const seen = new Set();
  for (const cell of value.cells) {
    exact(cell, ['task_type', 'human_reviewed', 'reused', 'skill_id', 'count']);
    if (!TASK_TYPES.includes(cell.task_type) || typeof cell.human_reviewed !== 'boolean' || typeof cell.reused !== 'boolean' || (cell.skill_id !== null && !SKILL_IDS.includes(cell.skill_id)) || !Number.isSafeInteger(cell.count) || cell.count < MIN_CELL || cell.count > 1000000 || seen.has(key(cell))) reject();
    seen.add(key(cell));
  }
  return value;
}
export function releaseEligible(period, now) {
  if (typeof period !== 'string' || !PERIOD.test(period)) return false;
  const [year, month] = period.split('-').map(Number);
  return now.getTime() >= Date.UTC(year, month, 8);
}
export function uploadEligible(period, now) {
  const current = now.toISOString().slice(0, 7);
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  return period === current || (period === previous && !releaseEligible(period, now));
}
// Only disjoint cells are exposed. No totals, ranges or alternate marginal views.
export function suppressSnapshots(snapshots, period) {
  const programs = new Map();
  for (const snapshot of snapshots) {
    const {source_id, ...wire} = snapshot;
    if (typeof source_id !== 'string' || !ID.test(source_id)) reject();
    validateSnapshot(wire);
    if (snapshot.period !== period) reject();
    const cells = programs.get(snapshot.program_id) ?? new Map();
    programs.set(snapshot.program_id, cells);
    for (const cell of snapshot.cells) {
      const existing = cells.get(key(cell)) ?? {...cell, count: 0};
      existing.count += cell.count;
      if (!Number.isSafeInteger(existing.count)) reject();
      cells.set(key(cell), existing);
    }
  }
  return {version: 1, period, minimum_cell_size: MIN_CELL, programs: [...programs].sort(([a], [b]) => a.localeCompare(b)).map(([program_id, cells]) => ({program_id, cells: [...cells.values()].filter(cell => cell.count >= MIN_CELL).sort((a, b) => key(a).localeCompare(key(b)))})).filter(program => program.cells.length > 0)};
}
const response = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}});
export function createReceiver({store, authenticate, now = () => new Date()}) {
  return async request => {
    try {
      const url = new URL(request.url);
      if (url.pathname === '/health' && request.method === 'GET') return response({status: 'ok'});
      if (url.pathname === '/v1/public' && request.method === 'GET') {
        if ([...url.searchParams.keys()].some(name => name !== 'period') || url.searchParams.getAll('period').length !== 1) return response({error: 'one_fixed_period_required'}, 400);
        const period = url.searchParams.get('period');
        if (!PERIOD.test(period ?? '')) return response({error: 'invalid_period'}, 400);
        if (!releaseEligible(period, now())) return response({error: 'period_not_closed'}, 409);
        let release = await store.getRelease(period);
        if (!release) release = await store.putRelease(period, suppressSnapshots(await store.listSnapshots(period), period));
        return response(release);
      }
      if (url.pathname !== '/v1/metrics' || !['POST', 'DELETE'].includes(request.method)) return response({error: 'not_found'}, 404);
      if (url.search) return response({error: 'query_not_allowed'}, 400);
      const identity = await authenticate(request);
      if (!identity || typeof identity.program_id !== 'string' || !ID.test(identity.program_id) || typeof identity.source_id !== 'string' || !ID.test(identity.source_id)) return response({error: 'unauthorized'}, 401);
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return response({error: 'json_required'}, 415);
      // Stream bounded bytes: never buffer an unbounded request, never echo body.
      const reader = request.body?.getReader();
      if (!reader) reject();
      const parts = []; let size = 0;
      while (true) {
        const {done, value} = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 65536) { await reader.cancel(); return response({error: 'payload_too_large'}, 413); }
        parts.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
      let body; try { body = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); } catch { reject(); }
      const value = request.method === 'POST' ? validateSnapshot(body) : validateIdentity(body);
      if (identity.program_id !== value.program_id) return response({error: 'program_mismatch'}, 403);
      if (request.method === 'DELETE') {
        await store.revoke({...value, source_id: identity.source_id});
        return response({revoked: true, published_release_immutable: Boolean(await store.getRelease(value.period))});
      }
      if (!uploadEligible(value.period, now()) || await store.getRelease(value.period)) return response({error: 'period_closed'}, 409);
      await store.upsert({...value, source_id: identity.source_id});
      return response({accepted: true});
    } catch (error) {
      if (error instanceof MonthCapacityError) return response({error: 'month_capacity_reached'}, 409);
      if (error instanceof PeriodClosedError) return response({error: 'period_closed'}, 409);
      return response({error: error instanceof InvalidPayload ? 'invalid_payload' : 'service_unavailable'}, error instanceof InvalidPayload ? 400 : 503);
    }
  };
}
