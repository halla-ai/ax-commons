// Color theme: system (default), light or dark. Loaded in <head> so the stored choice applies before first paint.
(() => {
  const root = document.documentElement, key = 'ax-theme', choices = ['system', 'light', 'dark'];
  let choice = 'system';
  try { const saved = localStorage.getItem(key); if (choices.includes(saved)) choice = saved; } catch {}
  function apply() {
    if (choice === 'system') root.removeAttribute('data-theme'); else root.dataset.theme = choice;
    for (const button of document.querySelectorAll('[data-theme-choice]')) button.setAttribute('aria-pressed', String(button.dataset.themeChoice === choice));
  }
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    for (const group of document.querySelectorAll('.theme-switch')) group.hidden = false;
    for (const button of document.querySelectorAll('[data-theme-choice]')) button.addEventListener('click', () => {
      choice = button.dataset.themeChoice;
      try { if (choice === 'system') localStorage.removeItem(key); else localStorage.setItem(key, choice); } catch {}
      apply();
    });
    apply();
  });
})();
