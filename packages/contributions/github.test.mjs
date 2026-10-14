import test from 'node:test';
import assert from 'node:assert/strict';
import {createGithubTransport} from './github.mjs';
const id='12345678-1234-1234-1234-123456789abc';
const record={id,path:'commons/prompts/task-guide.json',pr:1,branch:`contribution/${id}`,fileSha:'original'};
function transport(responder) { return createGithubTransport({token:'test-only',fetch:async(url,options)=>{
  assert.ok(url.startsWith('https://api.github.com/repos/halla-ai/ax-commons/'));
  assert.equal(options.redirect,'error');
  const data=responder(url,options);
  return {ok:data!==null,status:data===null?404:200,json:async()=>data};
}}); }
test('trusted repository only',()=>{ assert.throws(()=>createGithubTransport({owner:'other',repo:'repo'}),/untrusted/); });
test('unmerged revocation closes PR and removes source branch; readback verifies',async()=>{
  const calls=[];
  const adapter=transport((url,options)=>{
    calls.push([url,options.method]);
    if(url.includes('/contents/')) return null;
    if(url.includes('/pulls/1')) return {state:options.method==='PATCH'?'closed':'open',merged_at:null};
    if(url.includes('/pulls?')) return [];
    if(url.includes('/git/ref/')) return {object:{sha:'head'}};
    return {};
  });
  await adapter.revoke(record);
  assert.ok(calls.some(([url,method])=>url.endsWith('/pulls/1')&&method==='PATCH'));
  assert.ok(calls.some(([url,method])=>url.endsWith(`/git/refs/heads/contribution/${id}`)&&method==='DELETE'));
  const absent=transport(url=>url.includes('/pulls/1')?{state:'closed'}:null);
  assert.equal(await absent.isRemoved(record),true);
});
test('changed current content remains pending, never deleted',async()=>{
  let deleted=false;
  const adapter=transport((url,options)=>{
    if(url.includes('/contents/')) { if(options.method==='DELETE') deleted=true;return {sha:'replacement'}; }
    if(url.includes('/pulls/1')) return {state:'closed',merged_at:'date'};
    return null;
  });
  const receipt=await adapter.revoke(record);
  assert.equal(receipt.reason,'current-content-changed');assert.equal(deleted,false);
  assert.equal(await adapter.isRemoved(record),false);
});
test('published revocation creates removal PR and remains pending until merge',async()=>{
  const calls=[];
  const adapter=transport((url,options)=>{
    calls.push([url,options.method]);
    if(url.includes('/contents/')) return {sha:'original'};
    if(url.includes('/pulls/1')) return {state:'closed',merged_at:'date'};
    if(url.includes('/git/ref/heads/contribution/')||url.includes('/git/ref/heads/withdrawal/')) return null;
    if(url.endsWith('/git/ref/heads/main')) return {object:{sha:'main'}};
    if(url.includes('/pulls?')) return [];
    if(url.endsWith('/pulls')) return {number:2};
    return {};
  });
  assert.equal((await adapter.revoke(record)).removalPr,2);
  assert.ok(calls.some(([url,method])=>url.includes('/contents/')&&method==='DELETE'));
  assert.equal(await adapter.isRemoved(record),false);
});
test('withdrawal retry completes deletion after branch creation succeeded',async()=>{
  let branch=false,deleted=false,deleteAttempts=0;
  const adapter=transport((url,options)=>{
    if(url.includes('/pulls/1')) return {state:'closed',merged_at:'date'};
    if(url.includes('/git/ref/heads/contribution/')) return null;
    if(url.includes('/git/ref/heads/withdrawal/')) return branch?{object:{sha:'branch'}}:null;
    if(url.endsWith('/git/ref/heads/main')) return {object:{sha:'main'}};
    if(url.endsWith('/git/refs')&&options.method==='POST') {branch=true;return {};}
    if(url.includes('/contents/')&&options.method==='DELETE') {deleteAttempts++;if(deleteAttempts===1) throw new Error('injected failure');deleted=true;return {};}
    if(url.includes('/contents/')&&url.includes('?ref=withdrawal/')) return deleted?null:{sha:'original'};
    if(url.includes('/contents/')) return {sha:'original'};
    if(url.includes('/pulls?')) return [];
    if(url.endsWith('/pulls')) {assert.equal(deleted,true);return {number:2};}
    return {};
  });
  await assert.rejects(adapter.revoke(record),/injected failure/);
  assert.equal(branch,true);assert.equal(deleted,false);
  assert.equal((await adapter.revoke(record)).removalPr,2);
  assert.equal(deleteAttempts,2);
});
