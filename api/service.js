import { GithubStore } from '../packages/receiver/src/github-store.mjs';
import { createVercelReceiver } from '../packages/receiver/src/vercel.mjs';
import { createGithubTransport } from '../packages/contributions/github.mjs';
import { createHostedService } from '../packages/hosted/service.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: {'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff'},
});

export function createApp(env, dependencies = {}) {
  const store = dependencies.store ?? new GithubStore({token:env.STATE_GITHUB_TOKEN, repo:env.STATE_REPOSITORY || 'halla-ai/ax-commons-state'});
  const transport = dependencies.transport ?? createGithubTransport({token:env.CONTRIBUTIONS_GITHUB_TOKEN});
  const metrics = createVercelReceiver({store, credentials:JSON.parse(env.METRICS_CREDENTIALS || '{}'), requestLimit:Number(env.MONTHLY_REQUEST_LIMIT || '1000')});
  const contributions = createHostedService({store, transport, contributionToken:env.CONTRIBUTION_TOKEN, cronToken:env.CRON_SECRET, reserveSubmission:() => store.takeBudget(new Date().toISOString().slice(0,7), Number(env.MONTHLY_REQUEST_LIMIT || '1000'))});
  return async request => {
    const url = new URL(request.url);
    // Explicit rewrites retain the public contract independently of Vercel's
    // physical function URL. Never forward internal route parameters to core.
    const route = url.searchParams.get('__route');
    if (route) {
      if (!/^(?:metrics|public|budget|contributions(?:\/[a-f0-9-]{36})?|expire|health)$/.test(route)) return json({error:'not_found'}, 404);
      url.pathname = route === 'health' ? '/health' : `/v1/${route}`;
      url.searchParams.delete('__route');
      request = new Request(url, request);
    }
    if (url.pathname === '/health' && request.method === 'GET') return json({status:'ok', version:env.AX_RELEASE_SHA || 'development'});
    if (url.pathname.startsWith('/v1/contributions') || url.pathname === '/v1/expire') return contributions(request);
    const result = await metrics(request);
    if (url.pathname === '/v1/public' && request.method === 'GET' && result.ok) {
      result.headers.set('cache-control', 'public, s-maxage=86400, stale-while-revalidate=86400');
    }
    return result;
  };
}

let application;
export default {
  async fetch(request) {
    try {
      application ??= createApp(process.env);
      return await application(request);
    } catch { return json({error:'service_unavailable'}, 503); }
  },
};
