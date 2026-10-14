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
