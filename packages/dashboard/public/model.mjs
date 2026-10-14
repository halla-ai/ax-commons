// The rendering boundary independently rejects small or malformed public cells.
export function publicCells(cells) {
  if (!Array.isArray(cells)) return [];
  return cells.filter(cell => cell && Number.isSafeInteger(cell.count) && cell.count >= 5 && typeof cell.task_type === 'string' && typeof cell.human_reviewed === 'boolean' && typeof cell.reused === 'boolean' && (cell.skill_id === null || typeof cell.skill_id === 'string'));
}
