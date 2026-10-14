import {readFileSync} from 'node:fs';
import {validateSkillFile, readSkillFile} from '../../scripts/validate-skill.mjs';
import {scanSafety, validateContribution} from './core.mjs';
export function checkContributionFile(path) {
  const content = readFileSync(path,'utf8');
  if (path.endsWith('.json')) validateContribution(JSON.parse(content));
  else if (path.endsWith('/SKILL.md')) {
    const blocked = scanSafety(content);
    if (blocked.length) throw new Error(`Blocked ${path}: ${blocked.join(', ')}`);
    if (validateSkillFile(path).length) throw new Error('invalid skill schema');
    const {data} = readSkillFile(path);
    const strings = [...Object.values(data).filter(value => typeof value === 'string'), ...Object.values(data.metadata ?? {}).filter(value => typeof value === 'string')];
    if (strings.some(value => scanSafety(value).length)) throw new Error('unsafe contribution');
  } else throw new Error(`Unsupported contribution format: ${path}`);
}
if (process.argv[1]?.endsWith('/check.mjs')) {
  for (const path of process.argv.slice(2)) checkContributionFile(path);
}
