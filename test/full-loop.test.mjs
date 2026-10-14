import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {Ledger} from '../packages/mcp-server/src/ledger.ts';
import {registerRemoteTools} from '../packages/mcp-bridge/index.mjs';
import {createHostedService} from '../packages/hosted/service.mjs';

// Exercise the real client/server protocol together, rather than mutually
// incompatible response mocks. No real network, accounts or participant data.
test('approved MCP contribution survives a lost hosted response and can be reconciled and withdrawn', async () => {
  const dir=fs.mkdtempSync(path.join(process.cwd(),'.full-loop-'));
  const ledger=new Ledger(path.join(dir,'ledger.sqlite'));
  const records=new Map();let sequence=0,published=0,removed=false;
  const store={
    getJson:async key=>records.has(key)?structuredClone(records.get(key)):null,
    putJson:async(key,value,{createOnly,expectedSha}={})=>{
      const existing=records.get(key);
      if(createOnly&&existing)return structuredClone(existing);
      if(expectedSha!==undefined&&existing?.sha!==expectedSha){const e=new Error('conflict');e.name='StorageConflict';throw e;}
      const row={value:structuredClone(value),sha:String(++sequence)};records.set(key,row);return structuredClone(row);
    },
    listConsents:async()=>[...records.values()].map(row=>structuredClone(row.value)),
  };
  const token='a'.repeat(64);
  const hosted=createHostedService({store,contributionToken:token,cronToken:'b'.repeat(64),transport:{
    publish:async({metadata})=>{published++;return{branch:`contribution/${metadata.id}`,pr:1,url:'https://github.com/halla-ai/ax-commons/pull/1',fileSha:'c'.repeat(40)};},
    revoke:async()=>{removed=true;return{status:'withdrawal-pending'};},isRemoved:async()=>removed,
  }});
  const handlers=new Map();let lose=true;
  const bridge=registerRemoteTools({registerTool:(name,config,fn)=>handlers.set(name,fn)},ledger,{endpoint:'https://example.test',contributionToken:token,fetch:async(url,options)=>{
    const response=await hosted(new Request(url,options));
    if(options.method==='POST'&&lose){lose=false;throw new Error('lost response after publication');}
    return response;
  }});
  const call=async args=>{const result=await handlers.get('submit_contribution')(args);assert.notEqual(result.isError,true);return JSON.parse(result.content[0].text);};
  try{
    const candidate={type:'prompt',slug:'protocol-fixture',purpose:'Evidence check',sources:['https://example.org'],reviewer:'Reviewer',version:'1.0.0',sunset:'full',issuePath:'https://example.org/issues',content:'Compare drafts with the supplied evidence.',contributor:'synthetic-author'};
    const preview=await call({action:'preview',candidate});assert.equal(published,0);assert.equal(records.size,0);
    const result=await call({action:'submit',previewId:preview.previewId,hash:preview.hash,approved:true,scope:'public',expiresAt:new Date(Date.now()+86400000).toISOString()});
    assert.equal(result.status,'publication-uncertain');assert.equal(published,1);
    const status=await call({action:'status',id:result.id});assert.equal(status.status,'submitted');
    const exported=path.join(dir,'export.json');ledger.exportTo(exported);
    const content=fs.readFileSync(exported,'utf8');assert.equal(content.includes(candidate.content),false);assert.equal(content.includes('revoke_token'),false);
    assert.equal(JSON.stringify(bridge.consentStatus()).includes('revokeToken'),false);
    const revoked=await handlers.get('revoke')({kind:'contribution',id:result.id});assert.notEqual(revoked.isError,true);assert.equal(JSON.parse(revoked.content[0].text).status,'withdrawn');assert.equal(removed,true);
  }finally{ledger.close();fs.rmSync(dir,{recursive:true,force:true});}
});
