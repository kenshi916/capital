/* Apply before styles load so a saved dark theme never flashes light. */
(() => {
  const key = 'mainstreet-theme';
  const root = document.documentElement;
  const system = window.matchMedia?.('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem(key); } catch { /* Storage can be unavailable. */ }
  if (preference !== 'light' && preference !== 'dark') preference = null;

  function apply(theme) {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#f7f8f9');
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    }
  }
  const preferredTheme = () => preference || (system?.matches ? 'dark' : 'light');
  apply(preferredTheme());
  system?.addEventListener?.('change', () => { if (!preference) apply(preferredTheme()); });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : null;
    apply(preferredTheme());
  });
  document.addEventListener('DOMContentLoaded', () => {
    apply(preferredTheme());
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(preference);
      try { localStorage.setItem(key, preference); } catch { /* The switch still works for this visit. */ }
    });
  }, { once: true });
})();
