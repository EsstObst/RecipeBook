export function parseChecked(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter((entry): entry is string => typeof entry === 'string'));
  } catch {
    return new Set();
  }
}

export function serializeChecked(set: Set<string>): string {
  return JSON.stringify([...set].sort());
}
