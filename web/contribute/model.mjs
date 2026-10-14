export const statusLabels = Object.freeze({publishing:'전송 처리 중',submitted:'검토 요청 제출됨', 'publication-uncertain':'전송 결과 확인 필요', 'revocation-requested':'철회 처리 대기 중', 'withdrawal-pending':'현재 공개 자료 제거 대기 중',withdrawn:'현재 공개 자료 제거 확인됨'});
export function buildCandidate(values) {
  return {type:values.type,slug:values.slug.trim(),purpose:values.purpose.trim(),sources:values.sources.split(/\r?\n/).map(item=>item.trim()).filter(Boolean),reviewer:values.reviewer.trim(),version:values.version.trim(),sunset:values.sunset,issuePath:'https://github.com/halla-ai/ax-commons/issues',content:values.material,contributor:values.contributor.trim()};
}
export function validateReceipt(value,{expectedId,requireToken=false}={}) {
  if (!value || typeof value!=='object' || typeof value.id!=='string' || typeof value.status!=='string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value.id) || (expectedId && value.id!==expectedId) || !Object.hasOwn(statusLabels,value.status)) throw new Error('invalid receipt');
  if ((requireToken || value.revokeToken!==undefined) && (typeof value.revokeToken!=='string' || !/^[a-f0-9]{64}$/i.test(value.revokeToken))) throw new Error('invalid receipt');
  if (value.url!==undefined && (typeof value.url!=='string' || !/^https:\/\/github\.com\/halla-ai\/ax-commons\/pull\/[1-9][0-9]*$/.test(value.url))) throw new Error('invalid receipt');
  return {id:value.id,status:value.status,...(value.url?{url:value.url}:{}),...(value.revokeToken?{revokeToken:value.revokeToken}:{})};
}
export function validateAccess(id,token) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id) || !/^[a-f0-9]{64}$/i.test(token)) throw new Error('invalid access');
}
