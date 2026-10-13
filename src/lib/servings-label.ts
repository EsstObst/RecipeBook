const SINGULAR: Record<string, string> = {
  Personen: 'Person',
  Portionen: 'Portion',
};

export function servingsLabel(count: number, label: string): string {
  return count === 1 ? (SINGULAR[label] ?? label) : label;
}
