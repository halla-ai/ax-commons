import {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {preparePreview, validateConsent, contentHash} from '../contributions/core.mjs';
import {validateSnapshot, uploadEligible, SKILL_IDS} from '../receiver/src/core.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const PROGRAM = /^[a-f0-9]{32,64}$/;
const PERIOD = /^20[0-9]{2}-(0[1-9]|1[0-2])$/;
const FAILURE = 'Operation unavailable or invalid. No remote error content is displayed.';
const MAX_PREVIEWS = 20;
const safeError = {errorMap: () => ({message:'Invalid tool input'})};

/** No background network activity. Every upload requires an explicit tool approval. */
export function registerRemoteTools(server, ledger, options = {}) {
  const {endpoint, metricsToken, contributionToken, programId, fetch:fetcher = globalThis.fetch, now = Date.now, crypto = globalThis.crypto} = options;
  let base;
  try {
    const url = new URL(endpoint);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/' && url.port === '') base = url.origin;
  } catch { /* Unconfigured clients retain local tools. */ }
  const previews = new Map();
  const metricsInFlight = new Map();
  const contributionsInFlight = new Map();
  const clock = () => Number(now());
  const timestamp = () => new Date(clock()).toISOString();
  // Per-operation connections follow a ledger recreated by the P1 delete command.
  function database(operation) {
    ledger.consentStatus(); // P1 creates its schema if the file has been deleted.
    const db = new DatabaseSync(ledger.path);
    try {
      db.exec('PRAGMA busy_timeout = 5000');
      db.exec(`CREATE TABLE IF NOT EXISTS bridge_contributions (
        id TEXT PRIMARY KEY, hash TEXT NOT NULL, scope TEXT NOT NULL,
        expires_at TEXT NOT NULL, submitted_at TEXT NOT NULL, status TEXT NOT NULL,
        revoke_token TEXT, pr_url TEXT
      ); CREATE TABLE IF NOT EXISTS bridge_metrics (
        period TEXT PRIMARY KEY, enabled INTEGER NOT NULL, status TEXT NOT NULL
      )`);
      return operation(db);
    } finally { db.close(); }
  }
  function transmission(db, kind) {
    db.prepare('INSERT INTO transmissions (sent_at,kind,detail) VALUES (?,?,?)').run(timestamp(),kind,'Structured payload sent; no conversation text');
  }
  const credential = token => typeof token === 'string' && HASH.test(token);
  async function request(path, token, method, body, extraHeaders = {}) {
    if (!base || !credential(token)) throw new Error('unconfigured');
    const response = await fetcher(base + path, {method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...extraHeaders},body:JSON.stringify(body)});
    if (!response.ok || response.redirected) throw new Error('remote operation failed');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('missing response');
    const chunks = []; let size = 0;
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new Error('large response'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk,offset);offset += chunk.byteLength;}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  }
  function safeRecord(row) {
    const status = row.status !== 'withdrawn' && Date.parse(row.expires_at) <= clock() ? 'expired-withdrawal-pending' : row.status;
    return {id:row.id,hash:row.hash,scope:row.scope,expiresAt:row.expires_at,status,...(row.pr_url ? {url:row.pr_url} : {})};
  }
  const receiptStatuses = ['submitted','withdrawal-pending','publication-uncertain','withdrawn'];
  function validateReceipt(result, id) {
    if (!result || result.id !== id || !receiptStatuses.includes(result.status) || (result.url !== undefined && (typeof result.url !== 'string' || !/^https:\/\/github\.com\/halla-ai\/ax-commons\/pull\/[1-9][0-9]*$/.test(result.url)))) throw new Error('invalid receipt');
    return result;
  }
  function getContribution(id) { return database(db=>db.prepare('SELECT * FROM bridge_contributions WHERE id=?').get(id ?? '')); }
  async function withdraw(row) {
    try {
      const result = validateReceipt(await request('/v1/contributions/' + row.id,row.revoke_token,'DELETE',undefined,credential(contributionToken) ? {'X-AX-Participation-Token':contributionToken} : {}),row.id);
      if (!['withdrawn','withdrawal-pending'].includes(result.status)) throw new Error('invalid withdrawal');
      database(db=>{db.prepare('UPDATE bridge_contributions SET status=? WHERE id=?').run(result.status,row.id);transmission(db,'contribution-revocation');});
    } catch { /* Retain the credential and honest withdrawal-pending state. */ }
    return safeRecord(getContribution(row.id));
  }
  function consentStatus() {
    return database(db => ({
      configured:{contributions:Boolean(base && credential(contributionToken)),metrics:Boolean(base && credential(metricsToken) && (typeof programId === 'string' && PROGRAM.test(programId)))},
      contributions:db.prepare('SELECT id,hash,scope,expires_at,status,pr_url FROM bridge_contributions ORDER BY submitted_at').all().map(safeRecord),
      metrics:db.prepare('SELECT period,enabled,status FROM bridge_metrics ORDER BY period').all().map(row=>({...row,enabled:row.enabled === 1})),
      note:'Sharing is optional. Previews stay in memory. Revocation credentials stay on device and are excluded from ledger JSON exports. Expired contributions require withdrawal; existing public copies and Git history remain licensed.'
    }));
  }
  function register(name, description, schema, handler) {
    server.registerTool(name,{description,inputSchema:schema.shape,annotations:{readOnlyHint:false,destructiveHint:name!=='sync_metrics',openWorldHint:true}},async args=>{
      try {
        const parsed = schema.parse(args);
        let result;
        if (name === 'sync_metrics') {
          if (metricsInFlight.has(parsed.period)) throw new Error('period operation pending');
          const operation = handler(parsed);
          metricsInFlight.set(parsed.period,operation);
          try { result = await operation; } finally { metricsInFlight.delete(parsed.period); }
        } else result = await handler(parsed);
        return {content:[{type:'text',text:JSON.stringify(result)}]};
      } catch {
        return {isError:true,content:[{type:'text',text:FAILURE}]};
      }
    });
  }
  register('submit_contribution','Preview explicitly selected contribution content; then submit the exact preview with public scope, expiry and explicit approval. Declining has no effect on support.',z.object({
    action:z.enum(['preview','submit','status'],safeError),candidate:z.record(z.string(),z.unknown()).optional(),id:z.string().regex(UUID).optional(),previewId:z.string().regex(UUID).optional(),hash:z.string().regex(HASH).optional(),approved:z.boolean().optional(),scope:z.literal('public',safeError).optional(),expiresAt:z.string().datetime({offset:true}).optional()
  },safeError).strict(),async args=>{
    if (args.action === 'preview') {
      const preview = await preparePreview(args.candidate,{crypto});
      for (const [id,item] of previews) if (item.createdAt + 15*60000 <= clock()) previews.delete(id);
      if (previews.size >= MAX_PREVIEWS) previews.delete(previews.keys().next().value);
      const previewId = crypto.randomUUID();
      // Retain an immutable snapshot rather than caller-owned mutable objects.
      const expiryTimer = setTimeout(() => previews.delete(previewId), 15*60000);
      expiryTimer.unref?.();
      previews.set(previewId,{candidate:JSON.stringify(preview.candidate),content:preview.content,hash:preview.hash,createdAt:clock(),expiryTimer});
      return {previewId,content:preview.content,hash:preview.hash,path:preview.path,notice:preview.notice};
    }
    if (args.action === 'status') {
      const row = getContribution(args.id);
      if (!row || !credential(row.revoke_token)) throw new Error('unknown contribution');
      try {
        const result = validateReceipt(await request('/v1/contributions/' + row.id,row.revoke_token,'GET'),row.id);
        database(db=>db.prepare("UPDATE bridge_contributions SET status=CASE WHEN status IN ('withdrawal-pending','withdrawn') AND ? NOT IN ('withdrawal-pending','withdrawn') THEN status ELSE ? END,pr_url=COALESCE(?,pr_url) WHERE id=?").run(result.status,result.status,result.url ?? null,row.id));
      } catch { /* Read failure keeps the local uncertain or pending state. */ }
      return safeRecord(getContribution(row.id));
    }
    const saved = previews.get(args.previewId);
    if (!saved || saved.createdAt + 15*60000 <= clock()) throw new Error('unknown or expired preview');
    const consent = validateConsent(args,saved.hash,clock());
    if (!base || !credential(contributionToken)) throw new Error('unconfigured');
    previews.delete(args.previewId); // Consume synchronously before any await or HTTP.
    clearTimeout(saved.expiryTimer);
    const candidate = JSON.parse(saved.candidate);
    const exact = await preparePreview(candidate,{crypto});
    if (exact.content !== saved.content || await contentHash(saved.content,crypto) !== consent.hash || Date.parse(consent.expiresAt) <= clock()) throw new Error('changed or expired');
    const id = crypto.randomUUID();
    const revokeToken = Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
    database(db=>{
      db.prepare('INSERT INTO bridge_contributions (id,hash,scope,expires_at,submitted_at,status,revoke_token,pr_url) VALUES (?,?,?,?,?,?,?,?)').run(id,consent.hash,consent.scope,consent.expiresAt,timestamp(),'publishing',revokeToken,null);
      db.prepare('INSERT INTO consent_records (recorded_at,item,kind,granted,scope,period,detail) VALUES (?,?,?,?,?,?,?)').run(timestamp(),'contribution-sharing','opt-in',1,'public',consent.expiresAt,consent.hash);
    });
    const operation = (async()=>{
      try {
        const result = validateReceipt(await request('/v1/contributions',contributionToken,'POST',{id,candidate,...consent,approved:true},{'X-AX-Withdrawal-Token':revokeToken}),id);
        database(db=>{
          db.prepare("UPDATE bridge_contributions SET status=CASE WHEN status IN ('withdrawal-pending','withdrawn') THEN status ELSE ? END,pr_url=? WHERE id=?").run(result.status,result.url ?? null,id);
          transmission(db,'contribution');
        });
      } catch {
        database(db=>db.prepare("UPDATE bridge_contributions SET status='publication-uncertain' WHERE id=? AND status='publishing'").run(id));
      }
      const row = getContribution(id);
      if (row.status === 'withdrawal-pending') return withdraw(row);
      return safeRecord(row);
    })();
    contributionsInFlight.set(id,operation);
    try { return await operation; } finally { contributionsInFlight.delete(id); }
  });
  register('sync_metrics','Upload one explicitly approved monthly replacement snapshot. Only enumerated counts in cells of at least five leave the device; no device identity or task text is sent.',z.object({period:z.string().regex(PERIOD),approved:z.boolean()},safeError).strict(),async args=>{
    if (!args.approved || !base || !credential(metricsToken) || !(typeof programId === 'string' && PROGRAM.test(programId)) || !uploadEligible(args.period,new Date(clock()))) throw new Error('unconfigured or not approved');
    const payload = database(db=>{
      const state = db.prepare('SELECT enabled FROM bridge_metrics WHERE period=?').get(args.period);
      if (state && state.enabled === 0) throw new Error('period disabled after revocation');
      const start = args.period + '-01T00:00:00.000Z';
      const [year,month] = args.period.split('-').map(Number);
      const end = new Date(Date.UTC(year,month,1)).toISOString();
      const hasSkill = db.prepare('PRAGMA table_info(task_logs)').all().some(row=>row.name === 'skill_id');
      const skill = hasSkill ? 'skill_id' : 'NULL AS skill_id';
      const grouping = hasSkill ? ',skill_id' : '';
      const cells = db.prepare(`SELECT task_type,human_reviewed,reused,${skill},COUNT(*) AS count FROM task_logs WHERE created_at>=? AND created_at<? GROUP BY task_type,human_reviewed,reused${grouping} HAVING COUNT(*)>=5 ORDER BY task_type,human_reviewed,reused${grouping}`).all(start,end).map(row=>({task_type:row.task_type,human_reviewed:row.human_reviewed === 1,reused:row.reused === 1,skill_id:row.skill_id,count:Number(row.count)}));
      if (cells.some(cell=>cell.skill_id !== null && !SKILL_IDS.includes(cell.skill_id))) throw new Error('invalid skill');
      const total = Number(db.prepare("SELECT COUNT(*) AS count FROM bridge_contributions WHERE submitted_at>=? AND submitted_at<? AND status='submitted'").get(start,end).count);
      return validateSnapshot({version:1,program_id:programId,period:args.period,cells,contribution_count:total>=5 ? total : 0});
    });
    const result = await request('/v1/metrics',metricsToken,'POST',payload);
    if (result.accepted !== true) throw new Error('invalid receipt');
    database(db=>{db.prepare("INSERT INTO bridge_metrics VALUES (?,1,'submitted') ON CONFLICT(period) DO UPDATE SET status=CASE WHEN enabled=0 THEN status ELSE 'submitted' END").run(args.period);transmission(db,'aggregate-metrics');});
    return {period:args.period,status:database(db=>db.prepare('SELECT status FROM bridge_metrics WHERE period=?').get(args.period).status)};
  });
  register('revoke','Disable local sharing and request remote withdrawal. Public copies and immutable releases may remain; pending removal is reported honestly.',z.object({kind:z.enum(['contribution','metrics'],safeError),id:z.string().regex(UUID).optional(),period:z.string().regex(PERIOD).optional()},safeError).strict(),async args=>{
    if (args.kind === 'metrics') {
      if (!args.period || !(typeof programId === 'string' && PROGRAM.test(programId))) throw new Error('missing period');
      database(db=>db.prepare("INSERT INTO bridge_metrics VALUES (?,0,'withdrawal-pending') ON CONFLICT(period) DO UPDATE SET enabled=0,status='withdrawal-pending'").run(args.period));
      const pending = metricsInFlight.get(args.period);
      if (pending) { try { await pending; } catch { /* Still remove an uncertain upload. */ } }
      const result = await request('/v1/metrics',metricsToken,'DELETE',{program_id:programId,period:args.period});
      if (result.revoked !== true) throw new Error('invalid receipt');
      database(db=>{db.prepare("UPDATE bridge_metrics SET status='withdrawn' WHERE period=?").run(args.period);transmission(db,'aggregate-revocation');});
      return {period:args.period,status:'withdrawn',publishedReleaseImmutable:result.published_release_immutable === true};
    }
    const row = getContribution(args.id);
    if (!row || !credential(row.revoke_token)) throw new Error('unknown contribution');
    if (row.status === 'withdrawn') return safeRecord(row);
    database(db=>{
      db.prepare("UPDATE bridge_contributions SET status='withdrawal-pending' WHERE id=?").run(row.id);
      db.prepare('INSERT INTO consent_records (recorded_at,item,kind,granted,scope,period,detail) VALUES (?,?,?,?,?,?,?)').run(timestamp(),'contribution-sharing','opt-in',0,'public',row.expires_at,row.hash);
    });
    const pending = contributionsInFlight.get(row.id);
    if (pending) {try {await pending;} catch { /* Withdrawal still owns the local credential. */ }}
    const current = getContribution(row.id);
    if (current.status === 'withdrawn') return safeRecord(current);
    return withdraw(current);
  });
  return {consentStatus};
}
