export function ingredientText(body: string): string {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Zutaten\s*$/.test(line));
  if (start === -1) return '';
  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const match = line.match(/^\s*[-*]\s+(.*)$/);
    if (match) items.push(match[1].replace(/\{\{[^}]*\}\}/g, '').replace(/[*_]/g, '').trim());
  }
  return items.join(' · ');
}
