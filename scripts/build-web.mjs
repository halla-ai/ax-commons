import './generate-contributors.mjs';
import {renderHelp} from './render-help.mjs';
import fs from 'node:fs';
import path from 'node:path';
const out = 'web-dist';
fs.rmSync(out, {recursive:true, force:true});
fs.mkdirSync(path.join(out, 'contribute'), {recursive:true});
for (const file of fs.readdirSync('packages/dashboard/public')) {
  fs.copyFileSync(path.join('packages/dashboard/public', file), path.join(out, file));
}
for (const file of ['index.html', 'form.mjs', 'model.mjs', 'style.css']) {
  fs.copyFileSync(path.join('web/contribute', file), path.join(out, 'contribute', file));
}
fs.copyFileSync('packages/contributions/core.mjs', path.join(out, 'contribute', 'core.mjs'));
fs.copyFileSync('commons/CONTRIBUTORS.md', path.join(out, 'contributors.md'));
fs.writeFileSync(path.join(out, 'release.json'), JSON.stringify({commit:process.env.AX_RELEASE_SHA || 'development', version:JSON.parse(fs.readFileSync('package.json','utf8')).version})+'\n');

fs.mkdirSync(path.join(out, 'help'), {recursive:true});
fs.writeFileSync(path.join(out, 'help', 'index.html'), renderHelp('ko'));
fs.writeFileSync(path.join(out, 'help', 'en.html'), renderHelp('en'));
fs.copyFileSync('web/help/style.css', path.join(out, 'help', 'style.css'));
