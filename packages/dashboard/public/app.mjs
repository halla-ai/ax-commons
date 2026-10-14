import {publicCells} from './model.mjs';
const form = document.querySelector('#period-form'), period = document.querySelector('#period'), status = document.querySelector('#status'), results = document.querySelector('#results');
const today = new Date();
period.value = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (today.getUTCDate() >= 8 ? 1 : 2), 1)).toISOString().slice(0, 7);
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
form.addEventListener('submit', async event => {
  event.preventDefault(); results.replaceChildren(); status.textContent = '불러오는 중 / Loading...';
  try {
    const response = await fetch(`/v1/public?period=${period.value}`);
    if (!response.ok) throw new Error(response.status === 409 ? '아직 마감되지 않은 월입니다. / Month is not closed.' : '집계를 불러올 수 없습니다. / Aggregates unavailable.');
    const data = await response.json();
    if (data.version !== 1 || !Array.isArray(data.programs)) throw new Error('Invalid aggregate response');
    for (const program of data.programs) {
      const safe = publicCells(program.cells);
      if (!safe.length) continue;
      const section = element('section', ''); section.append(element('h2', '프로그램 / Program'), element('code', program.program_id));
      const table = element('table', ''); table.append(element('caption', '활동과 재사용 인정 / Activity and reuse recognition'));
      const header = element('tr', ''); for (const title of ['업무 / Task', '검토 / Reviewed', '재사용 / Reused', '스킬 / Skill', '횟수 / Count']) header.append(element('th', title)); table.append(header);
      for (const cell of safe) {
        const row = element('tr', ''); for (const value of [cell.task_type, cell.human_reviewed ? 'Yes' : 'No', cell.reused ? 'Yes' : 'No', cell.skill_id ?? '-', String(cell.count)]) row.append(element('td', value)); table.append(row);
      }
      const wrap = element('div', ''); wrap.className = 'table-wrap'; wrap.append(table); section.append(wrap); results.append(section);
    }
    status.textContent = results.children.length ? `${data.period}: 마감 집계 / Frozen monthly aggregates` : '공개 기준을 충족하는 자료가 없습니다. / No publishable cells. This is not a zero-activity claim.';
  } catch (error) { status.textContent = error.message; }
});
