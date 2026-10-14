import {contributionPath, contentHash, preparePreview, validateContribution} from './core.mjs';
/** Trusted repository adapter. Credentials never enter receipts or diagnostics. */
export function createGithubTransport({owner = 'halla-ai',repo = 'ax-commons',token,fetch:fetcher = globalThis.fetch,crypto = globalThis.crypto} = {}) {
  if (owner !== 'halla-ai' || repo !== 'ax-commons') throw new Error('untrusted repository');
  if (typeof token !== 'string' || !token.trim()) throw new Error('repository credential unavailable');
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  async function request(path, {method='GET',body,missing=false} = {}) {
    const response = await fetcher(base+path, {method,redirect:'error',headers:{'User-Agent':'ax-commons',Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},...(body ? {body:JSON.stringify(body)} : {})});
    if (missing && response.status === 404) return null;
    if (!response.ok) throw new Error(`repository operation failed (${response.status})`);
    if (response.status === 204) return null;
    return response.json();
  }
  function encode(text) {
    const bytes = new TextEncoder().encode(text);
    return btoa(Array.from(bytes,byte => String.fromCharCode(byte)).join(''));
  }
  function assertRecord(record) {
    if (!/^[a-f0-9-]{36}$/.test(record.id) || !/^commons\/(?:(?:prompts|cases\/(?:success|failure)|issues)\/[a-z0-9]+(?:-[a-z0-9]+)*\.json|skills\/community\/[a-z0-9]+(?:-[a-z0-9]+)*\/SKILL\.md)$/.test(record.path)) throw new Error('invalid contribution receipt');
    if (record.branch && record.branch !== `contribution/${record.id}`) throw new Error('invalid contribution branch');
    if (record.pr && (!Number.isSafeInteger(record.pr) || record.pr < 1)) throw new Error('invalid PR');
  }
  async function current(record) {
    return request(`/contents/${record.path}?ref=main`,{missing:true});
  }
  return {
    async publish({candidate,content,metadata}) {
      validateContribution(candidate);
      const exact = await preparePreview(candidate,{crypto});
      if (exact.content !== content) throw new Error('content mismatch');
      assertRecord(metadata);
      if (contributionPath(candidate) !== metadata.path || await contentHash(content,crypto) !== metadata.hash) throw new Error('content mismatch');
      const existing = await current(metadata);
      if (existing) throw new Error('contribution slug already exists');
      const head = await request('/git/ref/heads/main');
      const branch = `contribution/${metadata.id}`;
      await request('/git/refs',{method:'POST',body:{ref:`refs/heads/${branch}`,sha:head.object.sha}});
      const file = await request(`/contents/${metadata.path}`,{method:'PUT',body:{message:`Add ${candidate.type} contribution`,content:encode(content),branch}});
      const pr = await request('/pulls',{method:'POST',body:{title:`Contribution: ${candidate.type} ${candidate.slug}`,head:branch,base:'main',body:`User approved public sharing of content hash ${metadata.hash}. Expiry: ${metadata.expiresAt}. License: CC BY 4.0. Withdrawal removes current content; published copies and Git history remain licensed.`}});
      return {branch,pr:pr.number,url:pr.html_url,fileSha:file.content.sha};
    },
    async revoke(record) {
      assertRecord(record);
      const branch = record.branch ?? `contribution/${record.id}`;
      const originals = record.pr ? [await request(`/pulls/${record.pr}`,{missing:true})] : await request(`/pulls?head=${owner}:${branch}&state=open`);
      for (const pr of originals) {
        if (pr && !pr.merged_at && pr.state === 'open') await request(`/pulls/${record.pr ?? pr.number}`,{method:'PATCH',body:{state:'closed'}});
      }
      const ref = await request(`/git/ref/heads/${branch}`,{missing:true});
      if (ref) await request(`/git/refs/heads/${branch}`,{method:'DELETE'});
      const file = await current(record);
      if (!file) {
        const removalBranch = `withdrawal/${record.id}`;
        const staleRemoval = await request(`/git/ref/heads/${removalBranch}`,{missing:true});
        if (staleRemoval) {
          const stalePrs = await request(`/pulls?head=${owner}:${removalBranch}&state=open`);
          for (const pr of stalePrs) await request(`/pulls/${pr.number}`,{method:'PATCH',body:{state:'closed'}});
          await request(`/git/refs/heads/${removalBranch}`,{method:'DELETE'});
        }
        return {status:'withdrawal-pending'};
      }
      // Preserve a later unrelated replacement rather than deleting by path alone.
      if (!record.fileSha || file.sha !== record.fileSha) return {status:'withdrawal-pending',reason:'current-content-changed'};
      const removalBranch = `withdrawal/${record.id}`;
      const existingRemoval = await request(`/git/ref/heads/${removalBranch}`,{missing:true});
      if (!existingRemoval) {
        const head = await request('/git/ref/heads/main');
        await request('/git/refs',{method:'POST',body:{ref:`refs/heads/${removalBranch}`,sha:head.object.sha}});
      }
      const pendingFile = await request(`/contents/${record.path}?ref=${removalBranch}`,{missing:true});
      if (pendingFile) {
        if (pendingFile.sha !== record.fileSha) return {status:'withdrawal-pending',reason:'withdrawal-content-changed'};
        await request(`/contents/${record.path}`,{method:'DELETE',body:{message:'Withdraw contribution from current content',sha:pendingFile.sha,branch:removalBranch}});
      }
      const prs = await request(`/pulls?head=${owner}:${removalBranch}&state=open`);
      const pr = prs[0] ?? await request('/pulls',{method:'POST',body:{title:`Withdraw contribution ${record.id}`,head:removalBranch,base:'main',body:'Remove current content following consent withdrawal or expiry. Immutable Git history and existing licensed copies are not erased.'}});
      return {status:'withdrawal-pending',removalPr:pr.number};
    },
    async isRemoved(record) {
      assertRecord(record);
      const file = await current(record);
      const branch = await request(`/git/ref/heads/contribution/${record.id}`,{missing:true});
      const removalBranch = await request(`/git/ref/heads/withdrawal/${record.id}`,{missing:true});
      const originals = record.pr ? [await request(`/pulls/${record.pr}`,{missing:true})] : await request(`/pulls?head=${owner}:contribution/${record.id}&state=open`);
      return !file && !branch && !removalBranch && originals.every(pr => !pr || pr.state === 'closed');
    },
  };
}
