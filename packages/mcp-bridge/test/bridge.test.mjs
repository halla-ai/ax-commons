import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Ledger} from '../../mcp-server/src/ledger.ts';
import {z} from 'zod';
import {registerRemoteTools} from '../index.mjs';
const fixed = Date.UTC(2026,9,14);
const candidate = {type:'prompt',slug:'safe-guide',purpose:'Reusable drafting procedure',sources:['https://example.org/reference'],reviewer:'Reviewer',version:'1.0.0',sunset:'full',issuePath:'https://github.com/halla-ai/ax-commons/issues',content:'Mark unsupported claims before review.',contributor:'pilot-author'};
const id = '12345678-1234-1234-1234-123456789abc';
const revokeToken = 'a'.repeat(64);
function setup(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(),'ax-bridge-'));
  const ledger = new Ledger(join(dir,'ledger.sqlite'));
  const handlers = new Map(),schemas = new Map(),calls = [];
  const server = {registerTool(name, config, handler) {handlers.set(name,handler);schemas.set(name,z.object(config.inputSchema));}};
  const api = registerRemoteTools(server,ledger,{endpoint:'https://ax-commons.vercel.app',contributionToken:'c'.repeat(64),metricsToken:'d'.repeat(64),programId:'b'.repeat(32),now:()=>fixed,fetch:async(url,config)=>{
    calls.push({url,...config});
    const data = config.method === 'DELETE' ? (url.endsWith('/metrics') ? {revoked:true,published_release_immutable:true} : {status:'withdrawal-pending'}) : url.endsWith('/metrics') ? {accepted:true} : {id,revokeToken,status:'submitted',url:'https://github.com/halla-ai/ax-commons/pull/12'};
    return new Response(JSON.stringify(data),{status:200});
  },...options});
  t.after(()=>{ledger.close();rmSync(dir,{recursive:true,force:true});});
  async function call(name,args) {const result = await handlers.get(name)(args);return result.isError ? {error:true,text:result.content[0].text} : JSON.parse(result.content[0].text);}
  return {ledger,calls,api,call,dir,schemas};
}
test('preview makes no ledger writes or HTTP; approved exact content sends once and persists metadata only',async t=>{
  const {ledger,calls,call,api,dir} = setup(t);
  const before = ledger.consentStatus();
  const preview = await call('submit_contribution',{action:'preview',candidate});
  assert.equal(calls.length,0);
  assert.deepEqual(ledger.consentStatus(),before);
  const approval = {action:'submit',previewId:preview.previewId,hash:preview.hash,scope:'public',expiresAt:new Date(fixed+86400000).toISOString(),approved:true};
  for (const patch of [{approved:false},{hash:'f'.repeat(64)},{scope:'reviewers-only'},{expiresAt:new Date(fixed).toISOString()}]) assert.equal((await call('submit_contribution',{...approval,...patch})).error,true);
  assert.equal(calls.length,0);
  const receipt = await call('submit_contribution',approval);
  assert.equal(receipt.status,'submitted');assert.equal(receipt.revokeToken,undefined);
  assert.equal(calls.length,1);assert.equal(calls[0].redirect,'error');
  assert.deepEqual(JSON.parse(calls[0].body),{candidate,hash:preview.hash,scope:'public',expiresAt:approval.expiresAt,approved:true});
  assert.equal((await call('submit_contribution',approval)).error,true);
  assert.equal(JSON.stringify(api.consentStatus()).includes(revokeToken),false);
  assert.equal(JSON.stringify(api.consentStatus()).includes(candidate.content),false);
  ledger.exportTo(join(dir,'export.json'));
  assert.equal(readFileSync(join(dir,'export.json'),'utf8').includes(revokeToken),false);
  assert.equal(readFileSync(ledger.path).includes(Buffer.from(candidate.content)),false);
  const revoked = await call('revoke',{kind:'contribution',id});
  assert.equal(revoked.status,'withdrawal-pending');
  assert.equal(calls[1].url,'https://ax-commons.vercel.app/v1/contributions/'+id);
  assert.equal(calls[1].headers.Authorization,'Bearer '+revokeToken);
});
test('metrics suppress small cells and replace a fixed period without identity or timestamps',async t=>{
  const {ledger,calls,call} = setup(t);
  const db = new DatabaseSync(ledger.path);
  for (let i=0;i<5;i++) db.prepare('INSERT INTO task_logs (created_at,task_type,human_reviewed,reused,minutes) VALUES (?,?,?,?,?)').run(new Date(fixed).toISOString(),'writing',1,0,null);
  for (let i=0;i<4;i++) db.prepare('INSERT INTO task_logs (created_at,task_type,human_reviewed,reused,minutes) VALUES (?,?,?,?,?)').run(new Date(fixed).toISOString(),'data',0,0,null);
  db.close();
  assert.equal((await call('sync_metrics',{period:'2026-10',approved:false})).error,true);
  assert.equal(calls.length,0);
  for (let i=0;i<2;i++) assert.equal((await call('sync_metrics',{period:'2026-10',approved:true})).status,'submitted');
  const wire = JSON.parse(calls[0].body);
  assert.deepEqual(wire,{version:1,program_id:'b'.repeat(32),period:'2026-10',cells:[{task_type:'writing',human_reviewed:true,reused:false,skill_id:null,count:5}],contribution_count:0});
  assert.equal(calls[0].body,calls[1].body);
  assert.equal((await call('revoke',{kind:'metrics',period:'2026-10'})).status,'withdrawn');
  assert.equal((await call('sync_metrics',{period:'2026-10',approved:true})).error,true);
  assert.equal(calls.length,3);
});
test('unconfigured, unsafe endpoint, invalid program and unsafe candidates never transmit',async t=>{
  for (const options of [{endpoint:'http://ax-commons.vercel.app'},{endpoint:'https://other.example/path'},{programId:'school-name'},{metricsToken:'private conversation sentinel'},{metricsToken:''}]) {
    const {calls,call} = setup(t,options);
    assert.equal((await call('sync_metrics',{period:'2026-10',approved:true})).error,true);
    assert.equal(calls.length,0);
    assert.equal((await call('submit_contribution',{action:'preview',candidate:{...candidate,content:'person@example.org'}})).error,true);
    assert.equal(calls.length,0);
  }
});
test('network failure consumes preview and never echoes remote content',async t=>{
  const {call} = setup(t,{fetch:async()=>{throw new Error('unsafe remote secret');}});
  const preview = await call('submit_contribution',{action:'preview',candidate});
  const args = {action:'submit',previewId:preview.previewId,hash:preview.hash,scope:'public',expiresAt:new Date(fixed+86400000).toISOString(),approved:true};
  const result = await call('submit_contribution',args);
  assert.equal(result.error,true);assert.equal(result.text.includes('unsafe remote secret'),false);
  assert.equal((await call('submit_contribution',args)).error,true);
});
test('deleted ledger is recreated and expired previews send nothing',async t=>{
  let clock = fixed;
  const {ledger,calls,call,api} = setup(t,{now:()=>clock});
  const preview = await call('submit_contribution',{action:'preview',candidate});
  clock += 16*60000;
  assert.equal((await call('submit_contribution',{action:'submit',previewId:preview.previewId,hash:preview.hash,scope:'public',expiresAt:new Date(clock+86400000).toISOString(),approved:true})).error,true);
  assert.equal(calls.length,0);
  rmSync(ledger.path);
  assert.deepEqual(api.consentStatus().contributions,[]);
});
test('revocation waits for an active metrics upload, then deletes and prevents retry',async t=>{
  let release;
  const delayed = new Promise(resolve=>{release=resolve;});
  const sequence = [];
  const {call,api} = setup(t,{fetch:async(url,config)=>{
    sequence.push(config.method);
    if (config.method === 'POST') await delayed;
    return new Response(JSON.stringify(config.method === 'POST' ? {accepted:true} : {revoked:true}));
  }});
  const upload = call('sync_metrics',{period:'2026-10',approved:true});
  await new Promise(resolve=>setImmediate(resolve));
  const revoke = call('revoke',{kind:'metrics',period:'2026-10'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(sequence,['POST']);
  release();
  assert.equal((await upload).status,'submitted');assert.equal((await revoke).status,'withdrawn');
  assert.deepEqual(sequence,['POST','DELETE']);
  assert.equal(api.consentStatus().metrics[0].enabled,false);
});
test('malformed and oversize receipts remain generic and never persist server-controlled metadata',async t=>{
  for (const data of [{id:'wrong',revokeToken,status:'submitted'}, {id,revokeToken:'wrong',status:'submitted'}, {id,revokeToken,status:'submitted',url:'https://evil.example/secret'}, {padding:'x'.repeat(9000)}]) {
    const {call,api} = setup(t,{fetch:async()=>new Response(JSON.stringify(data))});
    const preview = await call('submit_contribution',{action:'preview',candidate});
    const result = await call('submit_contribution',{action:'submit',previewId:preview.previewId,hash:preview.hash,scope:'public',expiresAt:new Date(fixed+86400000).toISOString(),approved:true});
    assert.equal(result.error,true);assert.equal(result.text.includes('evil'),false);
    assert.deepEqual(api.consentStatus().contributions,[]);
  }
});

test('SDK input field validation messages never echo rejected action, scope or kind',t=>{
  const {schemas} = setup(t);
  const sentinel = 'private conversation sentinel';
  for (const [name,args] of [
    ['submit_contribution',{action:sentinel}],
    ['submit_contribution',{action:'submit',scope:sentinel}],
    ['revoke',{kind:sentinel}],
    ['sync_metrics',{period:sentinel,approved:true}],
  ]) {
    const result = schemas.get(name).safeParse(args);
    assert.equal(result.success,false);
    assert.equal(result.error.issues.map(issue=>issue.message).join(' ').includes(sentinel),false);
  }
});
test('actual MCP SDK rejects unsafe enum values without returning conversation text',async t=>{
  const [{McpServer},{Client},{InMemoryTransport}] = await Promise.all([
    import('@modelcontextprotocol/sdk/server/mcp.js'),
    import('@modelcontextprotocol/sdk/client/index.js'),
    import('@modelcontextprotocol/sdk/inMemory.js')
  ]);
  const {ledger} = setup(t);
  const server = new McpServer({name:'bridge-validation',version:'0.1.0'});
  registerRemoteTools(server,ledger);
  const client = new Client({name:'test-client',version:'0.1.0'});
  const [clientTransport,serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async()=>{await client.close();await server.close();});
  const sentinel = 'private conversation sentinel';
  for (const [name,args] of [
    ['submit_contribution',{action:sentinel}],
    ['submit_contribution',{action:'submit',scope:sentinel}],
    ['revoke',{kind:sentinel}],
  ]) {
    let result;
    try {result = await client.callTool({name,arguments:args});}
    catch (error) {result = {error:String(error)};}
    assert.equal(JSON.stringify(result).includes(sentinel),false);
    assert.ok(result.isError || result.error);
  }
});

test('malformed contribution credential disables submission before HTTP',async t=>{
  for (const contributionToken of ['', 'private conversation sentinel', 'A'.repeat(64), 1]) {
    const {call,calls} = setup(t,{contributionToken});
    const preview = await call('submit_contribution',{action:'preview',candidate});
    assert.equal((await call('submit_contribution',{action:'submit',previewId:preview.previewId,hash:preview.hash,scope:'public',expiresAt:new Date(fixed+86400000).toISOString(),approved:true})).error,true);
    assert.equal(calls.length,0);
  }
});
