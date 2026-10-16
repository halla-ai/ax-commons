const API='https://api.vercel.com';
const EPSILON=0.000001;
export async function checkHostingBudget({token,teamId,projectId,metricsToken,appUrl='https://ax-commons.halla.ai',guardStopAt,monthlyLimitUsd=1,fetch:request=globalThis.fetch,now=Date.now,dryRun=false}) {
  if(!token || !/^team_[A-Za-z0-9]+$/.test(teamId??'') || !/^prj_[A-Za-z0-9]+$/.test(projectId??''))throw new Error('Budget credentials/configuration unavailable');
  const limit=Number(monthlyLimitUsd);if(!Number.isFinite(limit)||limit<0)throw new Error('Budget limit unavailable');
  async function api(path,method='GET') {
    const response=await request(API+path,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{authorization:`Bearer ${token}`}});
    if(!response.ok)throw new Error('Budget provider operation unavailable');
    return response;
  }
  const project=await (await api(`/v9/projects/${projectId}?teamId=${teamId}`)).json();
  if(project.name!=='ax-commons'||project.accountId!==teamId)throw new Error('Budget target mismatch');
  const current=Number(now());
  const query=new URLSearchParams({teamId,from:new Date(Date.UTC(new Date(current).getUTCFullYear(),new Date(current).getUTCMonth(),1)).toISOString(),to:new Date(current).toISOString()});
  const charges=await api(`/v1/billing/charges?${query}`);
  const reader=charges.body?.getReader();if(!reader)throw new Error('Billing response unavailable');
  // ponytail: whole team month buffered (~17MB by mid-month on the current team); stream-filter lines if it nears the cap.
  let text='',bytes=0;const decoder=new TextDecoder('utf-8',{fatal:true});
  for(;;){const{done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>256*1024*1024){await reader.cancel();throw new Error('Billing response exceeds limit');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
  let billed=0,matched=0;
  for(const line of text.split('\n').filter(x=>x.trim())) {
    const row=JSON.parse(line);if(!row.Tags||typeof row.Tags!=='object'||Array.isArray(row.Tags))throw new Error('Billing tags unavailable');
    if(row.Tags.ProjectId!==projectId)continue;
    if(row.BilledCost===null||row.BilledCost===undefined||(typeof row.BilledCost==='string'&&!row.BilledCost.trim()))throw new Error('Billing measure unavailable');
    const value=Number(row.BilledCost);if(row.BillingCurrency!=='USD'||!Number.isFinite(value))throw new Error('Billing measure unavailable');
    billed+=Math.max(0,value);matched++;
  }
  const deadline=Number(guardStopAt);
  const stop=billed>limit+EPSILON||(Number.isFinite(deadline)&&current>=deadline);
  let quota='unverified';
  if(/^https:\/\/ax-commons\.halla\.ai\/?$/.test(appUrl)&&/^[a-f0-9]{64}$/.test(metricsToken??'')) {
    try {
      const response=await request(appUrl.replace(/\/$/,'')+'/v1/budget',{redirect:'error',signal:AbortSignal.timeout(10000),headers:{authorization:`Bearer ${metricsToken}`}});
      if(response.ok){const value=await response.json();quota=value.stopped===true?'stopped':value.warning===true?'warning':'within_limit';}
    }catch{/* Provider billing remains independently observable. */}
  }
  if(stop&&!dryRun)await api(`/v1/projects/${projectId}/pause?teamId=${teamId}`,'POST');
  return {state:stop?(dryRun?'pause_required':'paused'):(matched?'no_recorded_overage':'no_recorded_usage'),quota,reason:stop?(billed>limit+EPSILON?'billed_usage':'credential_rotation_required'):undefined};
}
if(process.argv[1]?.endsWith('/hosting-budget.mjs')) {
  try {
    const result=await checkHostingBudget({token:process.env.VERCEL_BUDGET_TOKEN,teamId:process.env.VERCEL_TEAM_ID,projectId:process.env.VERCEL_PROJECT_ID,metricsToken:process.env.AX_METRICS_TOKEN,guardStopAt:process.env.AX_BUDGET_GUARD_STOP_AT,monthlyLimitUsd:process.env.AX_BUDGET_MONTHLY_LIMIT_USD||undefined,dryRun:process.env.AX_BUDGET_DRY_RUN==='true'});
    console.log(JSON.stringify(result));
    if(result.state==='paused'||result.state==='pause_required'||result.quota==='warning'||result.quota==='stopped'){console.error('::warning::AX Commons budget guard requires operator attention');process.exitCode=1;}
  }catch{console.error('::error::AX Commons budget verification unavailable; no healthy state claimed');process.exitCode=1;}
}
