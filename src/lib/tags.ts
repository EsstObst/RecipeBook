export function findTagConflicts(tagLists: string[][]): string[] {
  const byKey = new Map<string, Set<string>>();
  for (const tag of tagLists.flat()) {
    const key = tag.toLocaleLowerCase('de');
    if (!byKey.has(key)) byKey.set(key, new Set());
    byKey.get(key)!.add(tag);
  }
  return [...byKey.values()].filter((variants) => variants.size > 1).map((variants) => [...variants].sort().join(' / '));
}

export function allTags(tagLists: string[][]): string[] {
  return [...new Set(tagLists.flat())].sort((a, b) => a.localeCompare(b, 'de'));
}
