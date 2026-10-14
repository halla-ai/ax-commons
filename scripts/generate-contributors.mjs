import fs from 'node:fs';
import path from 'node:path';
import {generateContributors} from '../packages/contributions/generator.mjs';
const items = [];
function scalar(text, key) {
  const value = text.match(new RegExp(`^\\s*${key}: (.+)$`, 'm'))?.[1];
  if (value === undefined) return undefined;
  try { return JSON.parse(value); } catch { return value; }
}
function visit(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.isFile() && entry.name.endsWith('.json')) items.push(JSON.parse(fs.readFileSync(file, 'utf8')));
    else if (entry.isFile() && entry.name === 'SKILL.md') {
      const text = fs.readFileSync(file, 'utf8');
      const contributor = scalar(text, 'contributor');
      if (!contributor) continue;
      const pieces = text.split(/^---\s*$/m);
      const header = pieces[1] || '';
      items.push({type:'skill',slug:scalar(header,'name'),purpose:scalar(header,'purpose'),sources:scalar(header,'reference_sources')?.split('; '),reviewer:scalar(header,'reviewer'),version:String(scalar(header,'version')),sunset:scalar(header,'sunset'),issuePath:scalar(header,'issue_report_path'),content:pieces.slice(2).join('---').trim(),contributor});
    }
  }
}
for (const directory of ['commons/prompts','commons/cases','commons/issues','commons/skills']) visit(directory);
fs.writeFileSync('commons/CONTRIBUTORS.md', generateContributors(items));
