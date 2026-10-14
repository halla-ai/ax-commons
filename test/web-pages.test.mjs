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

test('every static page loads the theme script once and ships a hidden three-way theme switch', () => {
  for (const [name, html] of Object.entries(pages)) {
    assert.equal(html.split('<script src="/theme.js"></script>').length - 1, 1, name);
    assert.match(html, /<div class="theme-switch" role="group" aria-label="[^"]+" (?:data-label="theme" )?hidden>/, name);
    for (const choice of ['system', 'light', 'dark']) assert.ok(html.includes('data-theme-choice="' + choice + '"'), name + ' ' + choice);
  }
});
