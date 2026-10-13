function sectionLines(body: string, heading: string): string[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^##\\s+${heading}\\s*$`).test(line));
  if (start === -1) return [];
  const end = lines.findIndex((line, index) => index > start && /^##\s/.test(line));
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

function plain(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\{\{([^}]*)\}\}/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function listItems(body: string, heading: string): string[] {
  return sectionLines(body, heading)
    .map((line) => line.match(/^\s*[-*]\s+(.*)$/)?.[1])
    .filter((item): item is string => item !== undefined);
}

export function ingredientText(body: string): string {
  return listItems(body, 'Zutaten')
    .map((item) => item.replace(/\{\{[^}]*\}\}/g, '').replace(/[*_]/g, '').trim())
    .join(' · ');
}

export function ingredientLines(body: string): string[] {
  return listItems(body, 'Zutaten').map(plain);
}

export function stepTexts(body: string): string[] {
  const steps: string[] = [];
  for (const line of sectionLines(body, 'Zubereitung')) {
    const start = line.match(/^\d+\.\s+(.*)$/);
    if (start) steps.push(start[1]);
    else if (steps.length > 0 && line.trim()) steps[steps.length - 1] += ` ${line.trim().replace(/^[-*]\s+/, '')}`;
  }
  return steps.map(plain).filter(Boolean);
}
