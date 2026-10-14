import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../api/service.js';
const env = {CONTRIBUTION_TOKEN:'a'.repeat(64),CRON_SECRET:'b'.repeat(64),AX_RELEASE_SHA:'reviewed-source',METRICS_CREDENTIALS:'{}'};
function setup() {
  const calls=[];
  const store = {getRelease:async period=>{calls.push(period);return {version:1,period,minimum_cell_size:5,programs:[]};},getJson:async()=>{throw new Error('unexpected storage access');},takeBudget:async()=>{throw new Error('unexpected budget');}};
  return {calls,app:createApp(env,{store,transport:{}})};
}
test('deployment health identifies exact release, without touching data stores',async()=>{
  const {app,calls}=setup();const response=await app(new Request('https://example.test/api/service?__route=health'));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'ok',version:'reviewed-source'});assert.deepEqual(calls,[]);
});
test('public rewrite preserves only fixed period and caches immutable release',async()=>{
  const {app,calls}=setup();const response=await app(new Request('https://example.test/api/service?__route=public&period=2025-01'));
  assert.equal(response.status,200);assert.ok(response.headers.get('cache-control').includes('s-maxage'));assert.deepEqual(calls,['2025-01']);
  assert.equal((await app(new Request('https://example.test/api/service?__route=public&period=2025-01&other=1'))).status,400);
});
test('anonymous metrics and contributions cannot access private storage',async()=>{
  const {app,calls}=setup();
  for(const route of ['metrics','contributions']) assert.equal((await app(new Request(`https://example.test/api/service?__route=${route}`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}))).status,401);
  assert.deepEqual(calls,[]);
});

test('Vercel fixed budget rewrite has no injected source parameters',async()=>{
  const {readFileSync}=await import('node:fs');
  const {createHash}=await import('node:crypto');
  const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
  const rule=config.rewrites.find(rule=>rule.source==='/v1/budget');
  assert.ok(rule,'budget must not depend on a wildcard source query');
  const token='c'.repeat(64),program='d'.repeat(32);
  const app=createApp({...env,METRICS_CREDENTIALS:JSON.stringify({[createHash('sha256').update(token).digest('hex')]:program})},{store:{budget:async()=>({requests:0,limit:1000,stopped:false})},transport:{}});
  const result=await app(new Request('https://example.test'+rule.destination,{headers:{authorization:`Bearer ${token}`}}));
  assert.equal(result.status,200);assert.equal((await result.json()).limit,1000);
});

test('Vercel contribution routing removes only the matching injected identifier',async()=>{
  const id='12345678-1234-4123-8123-123456789abc';
  const app=createApp(env,{store:{getJson:async()=>null},transport:{}});
  const headers={authorization:`Bearer ${'e'.repeat(64)}`};
  const routed=await app(new Request(`https://example.test/api/service?__route=contributions/${id}&id=${id}`,{headers}));
  assert.equal(routed.status,401);
  const extra=await app(new Request(`https://example.test/api/service?__route=contributions/${id}&id=${id}&extra=1`,{headers}));
  assert.equal(extra.status,400);
});
