const SINGULAR: Record<string, string> = {
  Personen: 'Person',
  Portionen: 'Portion',
};

export function servingsLabel(count: number, label: string): string {
  return count === 1 ? (SINGULAR[label] ?? label) : label;
}

/** Bezugsgröße für Nährwerte: „Portion“ bei Personen/Portionen, sonst die Einheit selbst (z. B. „Stück“). */
export function perServingLabel(label: string): string {
  return label in SINGULAR ? 'Portion' : label;
}
