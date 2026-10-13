const root = document.documentElement;
const toggle = document.querySelector<HTMLButtonElement>('.theme-toggle');
const THEME_COLORS = { light: '#faf8f5', dark: '#191817' } as const;

function effectiveTheme(): 'light' | 'dark' {
  const chosen = root.dataset.theme;
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function sync(): void {
  const theme = effectiveTheme();
  toggle?.setAttribute('aria-pressed', String(theme === 'dark'));
  // Bei manueller Wahl gilt die Browserleisten-Farbe unabhängig vom System-Design.
  if (root.dataset.theme) {
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = THEME_COLORS[theme];
  }
}

toggle?.addEventListener('click', () => {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    // Speicher nicht verfügbar – Auswahl gilt nur für diese Seite.
  }
  sync();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sync);
sync();
