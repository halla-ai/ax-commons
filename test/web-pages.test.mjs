import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderHelp} from '../scripts/render-help.mjs';

const pages = {
  dashboard: fs.readFileSync('packages/dashboard/public/index.html', 'utf8'),
  contribute: fs.readFileSync('web/contribute/index.html', 'utf8'),
  'help-ko': renderHelp('ko'),
  'help-en': renderHelp('en'),
};

test('static pages use unique element IDs, so script lookups hit the intended node', () => {
  for (const [name, html] of Object.entries(pages)) {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), [], name);
  }
});
