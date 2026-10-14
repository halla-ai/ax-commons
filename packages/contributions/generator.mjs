import {validateContribution} from './core.mjs';
export function generateContributors(contributions) {
  const entries = new Map();
  for (const candidate of contributions) {
    const item = validateContribution(candidate);
    const types = entries.get(item.contributor) ?? new Set();
    types.add(item.type);
    entries.set(item.contributor, types);
  }
  return '# Contributors\n\n' + [...entries].sort(([a],[b]) => a.localeCompare(b)).map(([handle,types]) => `- ${handle}: ${[...types].sort().join(', ')}`).join('\n') + '\n';
}
