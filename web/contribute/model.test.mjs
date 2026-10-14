import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCandidate,validateReceipt,validateAccess} from './model.mjs';
const id='12345678-1234-1234-1234-123456789abc',token='a'.repeat(64);
test('form builds only contribution fields without participation credentials',()=>{
  const candidate=buildCandidate({type:'prompt',slug:' guide ',purpose:' Task ',sources:'https://example.org\n\nPublic source',reviewer:'Reviewer',version:'1.0.0',sunset:'full',material:'Selected material',contributor:'author',participation:'secret'});
  assert.deepEqual(candidate.sources,['https://example.org','Public source']);assert.equal(candidate.slug,'guide');assert.equal('participation' in candidate,false);
});
test('receipts validate trusted URL, UUID, status and access token',()=>{
  assert.equal(validateReceipt({id,status:'publication-uncertain',revokeToken:token},{requireToken:true}).status,'publication-uncertain');
  for(const patch of [{url:'https://other.example/token'},{url:'https://github.com/halla-ai/ax-commons/pull/1?token=secret'},{id:'../escape'},{status:'complete'},{revokeToken:'unsafe'}]) assert.throws(()=>validateReceipt({id,status:'submitted',revokeToken:token,...patch},{requireToken:true}));
  assert.throws(()=>validateReceipt({id,status:'withdrawn'},{expectedId:'87654321-1234-1234-1234-123456789abc'}));
  assert.doesNotThrow(()=>validateAccess(id,token));assert.throws(()=>validateAccess(id,'bad'));
});
