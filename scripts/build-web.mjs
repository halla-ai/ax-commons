import './generate-contributors.mjs';
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
fs.writeFileSync(path.join(out, 'release.json'), JSON.stringify({commit:process.env.AX_RELEASE_SHA || 'development', version:'0.2.0'})+'\n');
