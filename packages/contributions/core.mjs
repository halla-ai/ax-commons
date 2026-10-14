/** User-selected public contribution validation. No conversation capture or network. */
export const TYPES = Object.freeze(['prompt', 'skill', 'case-success', 'case-failure', 'issue']);
const RULES = [
  ['email', /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/i],
  ['phone', /(?:\+\d{1,3}[ .-]?)?(?:\b0\d{1,2}[ .-]?\d{3,4}[ .-]?\d{4}\b|\b\d{3}[ .-]\d{3}[ .-]\d{4}\b)/],
  ['national-id', /\b\d{6}[ -]?[1-8]\d{6}\b/],
  ['card', /\b(?:\d[ -]?){13,19}\b/],
  ['secret', /(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[a-z0-9]{20,}|github_pat_[a-z0-9_]{20,}|sk-[a-z0-9_-]{16,}|AKIA[A-Z0-9]{16})\b|(?:api[_ -]?key|password|secret|access[_ -]?token)\s*[:=]\s*["']?[^\s"'<>]{8,})/i],
  ['injection', /(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior|system|developer)\s+(?:instructions|rules|prompts)|(?:reveal|print|exfiltrate|send)\s+(?:the\s+)?(?:system prompt|credentials|secrets)|이전\s*(?:지시|명령).*무시|시스템\s*(?:프롬프트|지시).*무시/i],
  ['remote-execution', /(?:curl|wget)[^\n]{0,250}\|\s*(?:ba)?sh|(?:eval|exec)\s*\([^\n]*(?:fetch|https?:)|(?:bash|sh|python|node)\s+https?:\/\/|(?:fetch|download).{0,80}(?:execute|run).{0,80}(?:code|script)/i],
];
export function scanSafety(text) {
  if (typeof text !== 'string') throw new Error('text must be a string');
  const normalized = text.normalize('NFKC').replace(/\p{Cf}/gu, '');
  return RULES.filter(([,pattern]) => pattern.test(normalized)).map(([kind]) => kind);
}
const FIELDS = ['type','slug','purpose','sources','reviewer','version','sunset','issuePath','content','contributor'];
export function validateContribution(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('contribution must be an object');
  if (Object.keys(value).some(key => !FIELDS.includes(key))) throw new Error('unknown contribution field');
  if (!TYPES.includes(value.type)) throw new Error('unsupported contribution type');
  for (const key of ['slug','purpose','reviewer','version','sunset','issuePath','content','contributor']) {
    if (typeof value[key] !== 'string' || !value[key].trim()) throw new Error(`missing ${key}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) || value.slug.length > 80) throw new Error('invalid slug');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.contributor) || value.contributor.length > 80) throw new Error('contributor must be a pseudonymous handle');
  if (!/^\d+\.\d+\.\d+$/.test(value.version)) throw new Error('invalid version');
  if (!['full','scope-limited','purpose-limited'].includes(value.sunset)) throw new Error('invalid sunset');
  if (!Array.isArray(value.sources) || value.sources.length < 1 || value.sources.some(s => typeof s !== 'string' || !s.trim())) throw new Error('sources required');
  if (!/^https:\/\//.test(value.issuePath)) throw new Error('HTTPS issue path required');
  const result = Object.fromEntries(FIELDS.map(key => [key, key === 'sources' ? [...value[key]] : value[key]]));
  const serialized = JSON.stringify(result);
  if (serialized.length > 50000) throw new Error('contribution too large');
  const blocked = [...new Set(Object.values(result).flatMap(field => (Array.isArray(field) ? field : [field]).flatMap(text => scanSafety(text))))];
  if (blocked.length) throw new Error(`unsafe contribution: ${blocked.join(', ')}`);
  if (result.type === 'skill') {
    const ko = result.content.match(/^## (?:ko|한국어)\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);
    const en = result.content.match(/^## (?:en|English)\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);
    if (!ko || !/[가-힣]/.test(ko[1]) || !en || !/[A-Za-z]/.test(en[1])) throw new Error('skill requires Korean and English sections');
  }
  return result;
}
export function contributionPath(candidate) {
  const folder = {prompt:'prompts',skill:'skills','case-success':'cases/success','case-failure':'cases/failure',issue:'issues'}[candidate.type];
  if (!folder || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.slug)) throw new Error('invalid path');
  return candidate.type === 'skill' ? `commons/skills/community/${candidate.slug}/SKILL.md` : `commons/${folder}/${candidate.slug}.json`;
}
export async function contentHash(text, crypto = globalThis.crypto) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2,'0')).join('');
}
export function renderContribution(candidate) {
  if (candidate.type !== 'skill') return JSON.stringify(candidate, null, 2) + '\n';
  const scalar = value => JSON.stringify(value);
  return [
    '---', `name: ${candidate.slug}`, `description: ${scalar(candidate.purpose)}`, 'license: CC-BY-4.0',
    'metadata:', `  purpose: ${scalar(candidate.purpose)}`, `  reference_sources: ${scalar(candidate.sources.join('; '))}`,
    `  reviewer: ${scalar(candidate.reviewer)}`, `  version: ${candidate.version}`, `  sunset: ${candidate.sunset}`,
    `  issue_report_path: ${scalar(candidate.issuePath)}`, '  languages: ko,en', `  contributor: ${candidate.contributor}`,
    '---', '', candidate.content.trim(), '', '## log_task', '',
    'MCP 서버가 있으면 작업 종료 시 log_task로 작업 유형, 사람 검토 여부, 재사용 여부만 기록합니다. 대화 내용은 기록하지 않습니다. MCP가 없어도 일반 지침으로 사용합니다.',
    'When the MCP server is available, finish by calling log_task with only task type, human review and reuse flags. Do not include conversation text. Without MCP this skill works as plain instructions.', ''
  ].join('\n');
}
export async function preparePreview(candidate, {crypto = globalThis.crypto} = {}) {
  const validated = validateContribution(candidate);
  const content = renderContribution(validated);
  return Object.freeze({candidate: validated, content, hash: await contentHash(content, crypto), path: contributionPath(validated), notice:'Public CC BY 4.0 contributions cannot recall existing copies or immutable Git history. Withdrawal removes current project content. Declining has no effect on support.'});
}
export function validateConsent({approved,hash,scope,expiresAt}, previewHash, now = Date.now()) {
  if (approved !== true || hash !== previewHash) throw new Error('explicit exact-content approval required');
  if (scope !== 'public') throw new Error('only public scope is available');
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 90*86400000) throw new Error('expiry must be future and within 90 days');
  return {hash,scope,expiresAt:new Date(expiry).toISOString()};
}
export function createContributionFlow({transport, now = Date.now, crypto = globalThis.crypto} = {}) {
  const previews = new Map(), approvals = new Map(), records = new Map(), publishing = new Map();
  return {
    async preview(candidate) {
      const preview = await preparePreview(candidate, {crypto});
      const id = crypto.randomUUID();
      previews.set(id, {content:preview.content,hash:preview.hash,candidateJSON:JSON.stringify(preview.candidate)});
      return {...preview, id};
    },
    async approve(id, consent) {
      const saved = previews.get(id);
      if (!saved) throw new Error('unknown preview');
      const {content,hash,candidateJSON} = saved;
      const terms = validateConsent(consent, hash, now());
      const token = crypto.randomUUID();
      approvals.set(token, {id,content,candidateJSON,...terms});
      previews.delete(id);
      return {token,...terms};
    },
    async submit(token) {
      const approval = approvals.get(token);
      if (!approval) throw new Error('unknown or used approval');
      approvals.delete(token); // Consume before awaiting network, including failures.
      if (Date.parse(approval.expiresAt) <= now()) throw new Error('consent expired');
      const candidate = validateContribution(JSON.parse(approval.candidateJSON));
      if (await contentHash(approval.content, crypto) !== approval.hash) throw new Error('content changed');
      const metadata = {id:approval.id,hash:approval.hash,scope:approval.scope,expiresAt:approval.expiresAt,path:contributionPath(candidate),contributor:candidate.contributor,type:candidate.type,status:'publishing'};
      records.set(metadata.id, metadata);
      const operation = (async () => {
        try {
          const receipt = await transport.publish({candidate,content:approval.content,metadata:{...metadata}});
          Object.assign(metadata,receipt);
          if (metadata.status !== 'revocation-requested') metadata.status = 'submitted';
        } catch (error) {
          if (metadata.status !== 'revocation-requested') metadata.status = 'publication-uncertain';
          throw error;
        }
      })();
      publishing.set(metadata.id, operation);
      try {
        await operation;
        if (Date.parse(metadata.expiresAt) <= now() && metadata.status !== 'revocation-requested') await this.revoke(metadata.id);
        return {...metadata};
      } finally { publishing.delete(metadata.id); }
    },
    status() { return [...records.values()].map(item => ({...item})); },
    async revoke(id) {
      const record = records.get(id);
      if (!record) throw new Error('unknown contribution');
      record.status = 'revocation-requested';
      const pending = publishing.get(id);
      if (pending) { try { await pending; } catch { /* Reconcile uncertain publication by deterministic branch. */ } }
      record.status = 'withdrawal-pending';
      const receipt = await transport.revoke({...record});
      Object.assign(record,receipt);
      if (await transport.isRemoved({...record})) record.status = 'withdrawn';
      return {...record};
    },
    async sweepExpired() {
      const expired = [...records.values()].filter(item => Date.parse(item.expiresAt) <= now() && item.status !== 'withdrawn');
      for (const item of expired) await this.revoke(item.id);
      return this.status();
    },
  };
}
