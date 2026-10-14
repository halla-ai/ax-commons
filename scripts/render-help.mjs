import {helpContent} from '../web/help/content.mjs';

export function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function link({label, href}) {
  if (!/^\/(?!\/)/.test(href) && !/^https:\/\/github\.com\/halla-ai\/ax-commons(?:\/|$)/.test(href)) throw new Error('Unsupported help link');
  return '<a href="' + escapeHtml(href) + '">' + escapeHtml(label) + '</a>';
}
function steps(items) { return '<ol>' + items.map(item => '<li>' + escapeHtml(item) + '</li>').join('') + '</ol>'; }
export function themeSwitch(en) {
  const labels = en ? ['Color theme', 'System', 'Light', 'Dark'] : ['화면 모드', '시스템', '라이트', '다크'];
  return '<div class="theme-switch" role="group" aria-label="' + labels[0] + '" hidden>' +
    ['system', 'light', 'dark'].map((choice, index) => '<button type="button" data-theme-choice="' + choice + '" aria-pressed="' + (choice === 'system') + '">' + labels[index + 1] + '</button>').join('') + '</div>';
}
export function renderHelp(language, content = helpContent[language]) {
  if (!['ko', 'en'].includes(language)) throw new Error('Unsupported help language');
  const en = language === 'en', dashboard = '/?lang=' + language;
  const skip = en ? 'Skip to content' : '본문으로 이동';
  const contents = en ? 'On this page' : '이 페이지에서';
  const quick = en ? 'Quick start' : '시작 안내';
  const sectionLinks = content.sections.map(section => {
    if (!/^[a-z][a-z0-9-]*$/.test(section.id)) throw new Error('Invalid section ID');
    return '<a href="#' + section.id + '">' + escapeHtml(section.title) + '</a>';
  }).join('');
  const sections = content.sections.map(section => '<section id="' + section.id + '" aria-labelledby="title-' + section.id + '">' +
    '<h2 id="title-' + section.id + '">' + escapeHtml(section.title) + '</h2>' +
    section.paragraphs.map(text => '<p>' + escapeHtml(text) + '</p>').join('') +
    (section.steps ? steps(section.steps) : '') +
    (section.commands ? section.commands.map(command => '<p class="command-label">' + escapeHtml(command.label) + '</p><pre><code>' + escapeHtml(command.code) + '</code></pre>').join('') : '') +
    (section.links ? '<nav class="reference-links" aria-label="' + (en ? 'Related resources' : '관련 자료') + '">' + section.links.map(link).join('') + '</nav>' : '') + '</section>').join('');
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${escapeHtml(content.description)}">
<title>AX Commons | ${escapeHtml(content.title)}</title>
<link rel="alternate" hreflang="ko" href="/help/"><link rel="alternate" hreflang="en" href="/help/en.html">
<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/help/style.css">
<script src="/theme.js"></script>
</head>
<body>
<a class="skip-link" href="#content">${skip}</a>
<header class="site-header">
<a class="brand" href="${dashboard}">AX COMMONS</a>
<nav class="site-nav" aria-label="${en ? 'Main navigation' : '주 메뉴'}">
<a href="${dashboard}">${escapeHtml(content.nav.dashboard)}</a>
<a href="${en ? '/help/en.html' : '/help/'}" aria-current="page">${escapeHtml(content.nav.help)}</a>
<a href="/contribute/">${escapeHtml(content.nav.contribute)}</a>
</nav>
<nav class="language-switch" aria-label="${escapeHtml(content.nav.language)}">
<a href="/help/" lang="ko" hreflang="ko"${!en ? ' aria-current="true"' : ''}>한국어</a>
<a href="/help/en.html" lang="en" hreflang="en"${en ? ' aria-current="true"' : ''}>English</a>
</nav>
${themeSwitch(en)}
</header>
<main id="content" class="help-main">
<header class="help-intro"><p class="eyebrow">AX COMMONS / ${en ? 'USER GUIDE' : '사용 안내'}</p><h1>${escapeHtml(content.title)}</h1><p class="lead">${escapeHtml(content.description)}</p><p>${escapeHtml(content.intro)}</p></header>
<div class="scene scene-grass" aria-hidden="true"></div>
<div class="help-layout">
<aside><nav class="contents" aria-label="${contents}"><p>${contents}</p><a href="#quick-start">${quick}</a>${sectionLinks}<a href="#faq">FAQ</a></nav></aside>
<article>
<section id="quick-start" class="quick-start" aria-labelledby="quick-title"><h2 id="quick-title">${escapeHtml(content.quickStart.title)}</h2>${steps(content.quickStart.steps)}</section>
${sections}
<section id="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(content.faq.title)}</h2><dl class="faq">${content.faq.items.map(item => '<dt>' + escapeHtml(item.question) + '</dt><dd>' + escapeHtml(item.answer) + '</dd>').join('')}</dl></section>
</article>
</div>
<footer><p>${escapeHtml(content.footer)}</p><nav><a href="${dashboard}">${escapeHtml(content.nav.dashboard)}</a> · <a href="/contribute/">${escapeHtml(content.nav.contribute)}</a></nav></footer>
</main>
</body>
</html>
`;
}
