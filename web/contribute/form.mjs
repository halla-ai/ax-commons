import {preparePreview,validateConsent} from './core.mjs';
import {buildCandidate,validateReceipt,validateAccess,statusLabels,createLocalReceipt,mergeRemoteReceipt,markPublicationUncertain} from './model.mjs';
let preview,receipt;
let revision=0;
const get=id=>document.getElementById(id);
const fields=['type','slug','purpose','sources','reviewer','version','sunset','material','contributor'];
function invalidate() {revision++;preview=undefined;get('preview').hidden=true;get('consent').checked=false;}
function showReceipt(next) {
  receipt={...receipt,...next};
  get('receipt').hidden=false;
  get('receipt-status').textContent=statusLabels[receipt.status];
  get('receipt-id').textContent=`자료 ID: ${receipt.id}`;
  get('record-id').value=receipt.id;
  if(receipt.revokeToken) get('withdrawal-token').value=receipt.revokeToken;
  get('repository-link').hidden=!receipt.url;
  if(receipt.url) get('repository-link').href=receipt.url;
  get('download').disabled=!receipt.revokeToken;
}
get('type').addEventListener('change',()=>{get('skill-help').hidden=get('type').value!=='skill';});
for(const field of fields) get(field).addEventListener('input',invalidate);
get('form').addEventListener('submit',async event=>{
  event.preventDefault();invalidate();
  const currentRevision=revision;
  try {
    const candidate=buildCandidate(Object.fromEntries(fields.map(field=>[field,get(field).value])));
    const next=await preparePreview(candidate);
    if(currentRevision!==revision) return;
    preview=next;get('content').textContent=next.content;get('hash').textContent=`내용 확인 코드 (SHA-256): ${next.hash}`;
    get('preview').hidden=false;get('result').textContent='아직 전송되지 않았습니다. 내용 확인 후 공개 여부를 선택하세요.';
  } catch {get('result').textContent='자료 형식 또는 안전 검사 실패. 개인정보·비밀정보·위험 지시를 제거하고 필요한 항목을 확인하세요.';}
});
get('approve').addEventListener('click',async()=>{
  if(!preview) return;
  let consent;
  const participation=get('participation').value.trim();
  try {
    if(!/^[a-f0-9]{64}$/i.test(participation)) throw new Error('invalid code');
    consent=validateConsent({approved:get('consent').checked,hash:preview.hash,scope:'public',expiresAt:get('expiry').value},preview.hash);
  } catch {get('result').textContent='참여 코드, 공개 동의와 90일 이내의 미래 만료일을 확인하세요.';return;}
  const local=createLocalReceipt(consent);
  const submission={id:local.id,candidate:preview.candidate,...consent,approved:true};
  receipt=undefined;showReceipt(local);
  invalidate();get('approve').disabled=true;get('result').textContent='검토 요청을 전송하고 있습니다.';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),30000);
  try {
    const response=await fetch('/v1/contributions',{method:'POST',redirect:'error',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${participation}`,'X-AX-Withdrawal-Token':local.revokeToken},body:JSON.stringify(submission)});
    const data=await response.json();
    const next=validateReceipt(data,{expectedId:local.id});
    if(receipt?.id!==local.id) return;
    const merged=mergeRemoteReceipt(receipt,next);
    showReceipt(response.ok?merged:markPublicationUncertain(merged));
    if(!response.ok || receipt.status!=='submitted') get('result').textContent='제출 결과 또는 공개 상태 확인이 필요합니다. 저장한 기록으로 상태를 확인하세요. 자동 재시도하지 않습니다.';
    else get('result').textContent='검토 요청이 제출되었습니다. 공개 승인 여부는 제출 기록에서 확인하세요.';
  } catch {
    if(receipt?.id===local.id) showReceipt(markPublicationUncertain(receipt));
    get('result').textContent='제출 응답을 확인하지 못했습니다. 저장한 자료 ID와 철회 코드로 상태 확인 또는 철회 요청을 할 수 있습니다. 자동 재시도하지 않습니다.';
  }
  finally {clearTimeout(timeout);get('approve').disabled=false;get('participation').value='';}
});
async function manage(method) {
  const id=get('record-id').value.trim(),token=get('withdrawal-token').value.trim();
  try {validateAccess(id,token);} catch {get('result').textContent='자료 ID와 철회 코드를 확인하세요.';return;}
  get('refresh').disabled=true;get('withdraw').disabled=true;
  if(method==='DELETE') {
    if(receipt?.id!==id) receipt=undefined;
    showReceipt({id,revokeToken:token,status:'revocation-requested'});
  }
  try {
    const headers={Authorization:`Bearer ${token}`};
    const participation=get('participation').value.trim();
    if(method==='DELETE'&&/^[a-f0-9]{64}$/i.test(participation)) headers['X-AX-Participation-Token']=participation;
    const response=await fetch(`/v1/contributions/${id}`,{method,redirect:'error',headers});
    const next=validateReceipt(await response.json(),{expectedId:id});
    if(!response.ok) throw new Error('failed');
    if(receipt?.id!==id) receipt=undefined;
    showReceipt(mergeRemoteReceipt(receipt??{id,revokeToken:token,status:'publication-uncertain'},next));
    get('result').textContent=method==='DELETE'&&next.status!=='withdrawn'?'철회 요청 처리 중입니다. 현재 자료 제거가 확인될 때까지 대기 상태입니다.':statusLabels[next.status];
  } catch {get('result').textContent='현재 상태를 확인하지 못했습니다. 상태가 바뀌었다고 가정하지 않습니다. 운영자에게 확인하세요.';}
  finally {get('refresh').disabled=false;get('withdraw').disabled=false;}
}
get('refresh').addEventListener('click',()=>manage('GET'));
get('withdraw').addEventListener('click',()=>manage('DELETE'));
get('download').addEventListener('click',()=>{
  if(!receipt?.revokeToken) return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(receipt,null,2)+'\n'],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`ax-commons-receipt-${receipt.id}.json`;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});

get('restore').addEventListener('change',async()=>{
  const file=get('restore').files?.[0];
  if(!file) return;
  try {
    if(file.size>10000) throw new Error('invalid file');
    const restored=validateReceipt(JSON.parse(await file.text()),{requireToken:true});
    receipt=undefined;showReceipt(restored);
    get('result').textContent='제출 기록을 불러왔습니다. 현재 상태는 상태 확인 버튼으로 확인하세요.';
  } catch {get('result').textContent='제출 기록의 자료 ID·상태·철회 코드를 확인하세요.';}
  finally {get('restore').value='';}
});
