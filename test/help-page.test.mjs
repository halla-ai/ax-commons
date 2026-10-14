import test from 'node:test';
import assert from 'node:assert/strict';
import {helpContent} from '../web/help/content.mjs';
import {renderHelp} from '../scripts/render-help.mjs';
import {languageFrom, messages} from '../packages/dashboard/public/language.mjs';

// The same-origin theme script is the only script allowed on help pages; the pages stay complete without it.
const withoutThemeScript = html => html.replace('<script src="/theme.js"></script>', '');

test('unrecognized dashboard locales fall back to Korean, never to URL content', () => {
  for (const search of ['', '?lang=ko', '?lang=fr', '?lang=EN', '?lang=script']) assert.equal(languageFrom(search), 'ko');
  assert.equal(languageFrom('?period=2026-09&lang=en'), 'en');
  assert.deepEqual(Object.keys(messages.ko).sort(), Object.keys(messages.en).sort());
  assert.deepEqual(Object.keys(messages.ko.tasks), Object.keys(messages.en.tasks));
});

test('both static help routes are complete and navigable without scripts', () => {
  const ids = ['install', 'usage', 'sharing', 'records', 'cautions'];
  for (const language of ['ko', 'en']) {
    const content = helpContent[language], html = renderHelp(language);
    assert.deepEqual(content.sections.map(section => section.id), ids);
    assert.equal(content.faq.items.length, 8);
    assert.match(html, new RegExp('<html lang="' + language + '">'));
    assert.ok(html.includes('href="/?lang=' + language + '"'));
    // The language icon links to the other language; both routes stay reachable without scripts.
    assert.ok(html.includes(language === 'ko' ? 'href="/help/en.html" lang="en"' : 'href="/help/" lang="ko"'));
    for (const id of ['quick-start', ...ids, 'faq']) {
      assert.ok(html.includes('href="#' + id + '"'));
      assert.ok(html.includes('id="' + id + '"'));
    }
    assert.ok(html.includes('/releases/latest'));
    assert.doesNotMatch(withoutThemeScript(html), /<script|onclick=|localStorage|<iframe/);
    const sharing = content.sections.find(section => section.id === 'sharing').paragraphs.join(' ');
    assert.match(sharing, /reviewers-only/);
    assert.match(sharing, /90/);
    assert.match(content.sections.find(section => section.id === 'records').paragraphs.join(' '), /revoke/);
  }
});

test('help renderer escapes content and rejects executable links or malformed anchors', () => {
  const content = structuredClone(helpContent.en);
  content.title = '<script>alert(1)</script>';
  content.sections[0].paragraphs.push('<img src=x onerror=alert(1)>');
  content.faq.items[0].answer = 'A & B "quoted"';
  const html = renderHelp('en', content);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('A &amp; B &quot;quoted&quot;'));
  assert.doesNotMatch(withoutThemeScript(html), /<script|<img/);
  content.sections[0].links[0].href = 'javascript:alert(1)';
  assert.throws(() => renderHelp('en', content), /Unsupported help link/);
  content.sections[0].links[0].href = 'https://github.com/halla-ai/ax-commons/releases/latest';
  content.sections[0].id = 'install" onclick="alert(1)';
  assert.throws(() => renderHelp('en', content), /Invalid section ID/);
  assert.throws(() => renderHelp('fr'), /Unsupported help language/);
});
