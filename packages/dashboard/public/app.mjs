import {publicCells} from './model.mjs';
import {languageFrom, messages} from './language.mjs';

const form = document.querySelector('#period-form'), period = document.querySelector('#period'), status = document.querySelector('#status'), results = document.querySelector('#results');
let language = languageFrom(location.search), state = 'ready', data = null, requestId = 0;
const today = new Date();
period.value = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (today.getUTCDate() >= 8 ? 1 : 2), 1)).toISOString().slice(0, 7);
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }

function renderResults() {
  const text = messages[language];
  results.replaceChildren();
  if (data) for (const program of data.programs) {
    const safe = publicCells(program.cells);
    if (!safe.length) continue;
    const section = element('section', '');
    section.append(element('h2', text.program), element('code', program.program_id));
    const table = element('table', ''); table.append(element('caption', text.caption));
    const header = element('tr', '');
    for (const title of text.columns) { const th = element('th', title); th.scope = 'col'; header.append(th); }
    const thead = element('thead', ''); thead.append(header); table.append(thead);
    const tbody = element('tbody', '');
    for (const cell of safe) {
      const row = element('tr', '');
      for (const value of [text.tasks[cell.task_type] ?? cell.task_type, cell.human_reviewed ? text.yes : text.no, cell.reused ? text.yes : text.no, cell.skill_id ?? '-', String(cell.count)]) row.append(element('td', value));
      tbody.append(row);
    }
    table.append(tbody);
    const wrap = element('div', ''); wrap.className = 'table-wrap'; wrap.append(table); section.append(wrap); results.append(section);
  }
  status.textContent = state === 'loaded' ? (results.children.length ? data.period + ': ' + text.loaded : text.empty) : text[state];
}

function renderLanguage() {
  const text = messages[language];
  document.documentElement.lang = language;
  document.title = text.title;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = text[node.dataset.i18n];
  for (const node of document.querySelectorAll('[data-label]')) node.setAttribute('aria-label', text[node.dataset.label]);
  for (const node of document.querySelectorAll('[data-help-link]')) node.href = language === 'en' ? '/help/en.html' : '/help/';
  for (const node of document.querySelectorAll('[data-dashboard-link]')) node.href = '/?lang=' + language;
  for (const node of document.querySelectorAll('[data-language]')) {
    if (node.dataset.language === language) node.setAttribute('aria-current', 'true');
    else node.removeAttribute('aria-current');
  }
  renderResults();
}

for (const link of document.querySelectorAll('[data-language]')) link.addEventListener('click', event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); language = link.dataset.language;
  const url = new URL(location.href); url.searchParams.set('lang', language);
  history.pushState(null, '', url); renderLanguage();
});
window.addEventListener('popstate', () => { language = languageFrom(location.search); renderLanguage(); });
form.addEventListener('submit', async event => {
  event.preventDefault(); const currentRequest = ++requestId;
  data = null; state = 'loading'; renderResults();
  try {
    const response = await fetch('/v1/public?period=' + period.value);
    if (currentRequest !== requestId) return;
    if (!response.ok) { state = response.status === 409 ? 'closed' : 'unavailable'; renderResults(); return; }
    const payload = await response.json();
    if (currentRequest !== requestId) return;
    if (payload.version !== 1 || !Array.isArray(payload.programs) || typeof payload.period !== 'string' || payload.programs.some(program => !program || typeof program.program_id !== 'string' || !Array.isArray(program.cells))) throw new Error('Invalid aggregate response');
    data = payload; state = 'loaded';
  } catch { if (currentRequest !== requestId) return; state = 'unavailable'; }
  renderResults();
});
renderLanguage();
