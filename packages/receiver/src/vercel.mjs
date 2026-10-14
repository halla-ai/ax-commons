import {createHash} from 'node:crypto';
import {createReceiver} from './core.mjs';
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'content-type': 'application/json', 'cache-control': 'no-store'}});
export function createVercelReceiver({store, credentials, requestLimit = 1000, now = () => new Date()}) {
  const authenticate = async request => {
    const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) return null;
    const source_id = createHash('sha256').update(token).digest('hex');
    const program_id = credentials[source_id];
    return typeof program_id === 'string' && /^[a-f0-9]{32,64}$/.test(program_id) ? {source_id, program_id} : null;
  };
  const handler = createReceiver({store, authenticate, now});
  return async request => {
    try {
      const path = new URL(request.url).pathname;
      if (path === '/health') return handler(request);
      if (path === '/v1/budget' && request.method === 'GET' && !new URL(request.url).search) {
        if (!await authenticate(request)) return json({error: 'unauthorized'}, 401);
        return json(await store.budget(now().toISOString().slice(0, 7), requestLimit));
      }
      if (path === '/v1/metrics' && request.method === 'POST') {
        if (!await authenticate(request)) return json({error: 'unauthorized'}, 401);
        if (!Number.isSafeInteger(requestLimit) || requestLimit < 1 || requestLimit > 100000) return json({error: 'budget_not_configured'}, 503);
        const budget = await store.takeBudget(now().toISOString().slice(0, 7), requestLimit);
        if (budget.stopped) return json({error: 'budget_limit_reached'}, 503);
        const result = await handler(request);
        if (budget.warning) result.headers.set('x-budget-warning', 'monthly-request-limit-near');
        return result;
      }
      return handler(request);
    } catch { return json({error: 'service_unavailable'}, 503); }
  };
}
