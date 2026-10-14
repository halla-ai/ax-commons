import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCandidate,validateReceipt,validateAccess,createLocalReceipt,mergeRemoteReceipt,markPublicationUncertain} from './model.mjs';
const id='12345678-1234-4234-a234-123456789abc',token='a'.repeat(64);
test('form builds only contribution fields without participation credentials',()=>{
  const candidate=buildCandidate({type:'prompt',slug:' guide ',purpose:' Task ',sources:'https://example.org\n\nPublic source',reviewer:'Reviewer',version:'1.0.0',sunset:'full',material:'Selected material',contributor:'author',participation:'secret'});
  assert.deepEqual(candidate.sources,['https://example.org','Public source']);assert.equal(candidate.slug,'guide');assert.equal('participation' in candidate,false);
});
test('receipts validate trusted URL, UUID, status and access token',()=>{
  assert.equal(validateReceipt({id,status:'publication-uncertain',revokeToken:token},{requireToken:true}).status,'publication-uncertain');
  for(const patch of [{url:'https://other.example/token'},{url:'https://github.com/halla-ai/ax-commons/pull/1?token=secret'},{id:'../escape'},{status:'complete'},{revokeToken:'unsafe'}]) assert.throws(()=>validateReceipt({id,status:'submitted',revokeToken:token,...patch},{requireToken:true}));
  assert.throws(()=>validateReceipt({id,status:'withdrawn'},{expectedId:'87654321-1234-4234-a234-123456789abc'}));
  assert.doesNotThrow(()=>validateAccess(id,token));assert.throws(()=>validateAccess(id,'bad'));
});

test('lost response retains locally generated recovery key and guards forged IDs',()=>{
  const local=createLocalReceipt({hash:'approved-hash',expiresAt:'2026-10-20T00:00:00.000Z',scope:'public'});
  assert.match(local.revokeToken,/^[a-f0-9]{64}$/);
  assert.equal(local.status,'publishing');
  const uncertain=markPublicationUncertain(local);
  assert.equal(uncertain.id,local.id);assert.equal(uncertain.revokeToken,local.revokeToken);
  assert.equal(uncertain.status,'publication-uncertain');
  const merged=mergeRemoteReceipt(uncertain,{id:local.id,status:'submitted',revokeToken:'b'.repeat(64)});
  assert.equal(merged.revokeToken,local.revokeToken);
  assert.equal(merged.hash,local.hash);
  assert.throws(()=>mergeRemoteReceipt(local,{id,status:'submitted'}));
});
test('late POST receipt and lost response cannot undo requested or completed revocation',()=>{
  for(const status of ['revocation-requested','withdrawal-pending','withdrawn']) {
    const local={id,revokeToken:token,status};
    assert.equal(mergeRemoteReceipt(local,{id,status:'submitted'}).status,status);
    assert.equal(markPublicationUncertain(local).status,status);
  }
  assert.equal(mergeRemoteReceipt({id,revokeToken:token,status:'withdrawal-pending'},{id,status:'withdrawn'}).status,'withdrawn');
});
