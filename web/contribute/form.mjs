import {preparePreview,validateConsent} from './core.mjs';
let preview;
const get = id => document.getElementById(id);
get('form').addEventListener('submit',async event => {
  event.preventDefault();
  preview = undefined;
  get('preview').hidden = true;
  get('consent').checked = false;
  try {
    preview = await preparePreview(JSON.parse(get('candidate').value));
    get('content').textContent = preview.content;
    get('hash').textContent = `SHA-256: ${preview.hash}`;
    get('notice').textContent = preview.notice;
    get('preview').hidden = false;
    get('result').textContent = '아직 전송되지 않았습니다. / Nothing has been sent.';
  } catch { get('result').textContent = '자료 형식 또는 안전 검사 실패. 개인정보, 비밀정보, 위험 지시를 제거하세요. / Format or safety validation failed.'; }
});
get('candidate').addEventListener('input',() => { preview = undefined;get('preview').hidden = true;get('consent').checked = false; });
get('approve').addEventListener('click',async () => {
  if (!preview) return;
  let consent;
  try { consent = validateConsent({approved:get('consent').checked,hash:preview.hash,scope:'public',expiresAt:get('expiry').value},preview.hash); }
  catch { get('result').textContent = '명시적 승인과 90일 이내의 미래 만료일이 필요합니다. / Explicit approval and a future expiry within 90 days are required.'; return; }
  const submission = {candidate:preview.candidate,...consent,approved:true};
  preview = undefined;
  get('approve').disabled = true;
  try {
    const response = await fetch('/v1/contributions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(submission)});
    if (!response.ok) throw new Error('failed');
    const receipt = await response.json();
    get('result').textContent = `제출됨 / Submitted: ${receipt.id}. ${receipt.url ?? ''} 철회용 토큰을 안전하게 보관하세요 / Keep the withdrawal token safe: ${receipt.revokeToken ?? ''}`;
  } catch { get('result').textContent = '제출 결과 확인 필요. 자동 재시도하지 않습니다. / Submission outcome needs confirmation; no automatic retry.'; }
  finally { get('approve').disabled = false;get('consent').checked = false;get('preview').hidden = true; }
});
