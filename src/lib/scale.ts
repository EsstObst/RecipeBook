export interface Quantity {
  min: number;
  max: number | null;
  unit: string;
}

const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)`;
const QUANTITY_RE = new RegExp(String.raw`^(${NUMBER})(?:\s*[–-]\s*(${NUMBER}))?(?:\s+([^\d]+))?$`);

function parseNumber(text: string): number {
  const t = text.trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = t.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  if (/^[1-9]\d{0,2}\.\d{3}$/.test(t)) return Number(t.replace('.', ''));
  return Number(t.replace(',', '.'));
}

export function parseQuantity(raw: string): Quantity | null {
  const match = raw.trim().match(QUANTITY_RE);
  if (!match) return null;
  const min = parseNumber(match[1]);
  const max = match[2] === undefined ? null : parseNumber(match[2]);
  if (!Number.isFinite(min) || min <= 0) return null;
  if (max !== null && (!Number.isFinite(max) || max < min)) return null;
  return { min, max, unit: (match[3] ?? '').trim() };
}

export function scaleQuantity(q: Quantity, factor: number): Quantity {
  return { min: q.min * factor, max: q.max === null ? null : q.max * factor, unit: q.unit };
}

type Group = 'small' | 'large' | 'spoon' | 'piece';

const SMALL = new Set(['g', 'ml']);
const LARGE = new Set(['kg', 'l']);
const SPOON = new Set(['tasse', 'tassen', 'el', 'tl', 'prise', 'prisen', 'msp', 'bund', 'dose', 'dosen', 'packung', 'packungen']);

function groupOf(unit: string): Group {
  const word = unit.trim().split(/\s+/)[0].toLowerCase();
  if (SMALL.has(word)) return 'small';
  if (LARGE.has(word)) return 'large';
  if (SPOON.has(word)) return 'spoon';
  return 'piece';
}

function roundValue(v: number, group: Group): number {
  switch (group) {
    case 'small': {
      const r = v < 10 ? Math.round(v) : Math.round(v / 5) * 5;
      return r === 0 ? 1 : r;
    }
    case 'large': {
      const r = Math.round(v * 10) / 10;
      return r === 0 ? 0.1 : r;
    }
    case 'spoon': {
      const r = Math.round(v * 4) / 4;
      return r === 0 ? 0.25 : r;
    }
    case 'piece': {
      const r = Math.round(v * 2) / 2;
      return r === 0 ? 0.25 : r;
    }
  }
}

const FRACTIONS: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

function formatNumber(v: number, group: Group): string {
  if (group === 'small') return String(v);
  if (group === 'large') return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
  const whole = Math.floor(v);
  const fraction = FRACTIONS[v - whole];
  if (!fraction) return String(whole);
  return whole === 0 ? fraction : `${whole} ${fraction}`;
}

export function formatQuantity(q: Quantity): string {
  const group = groupOf(q.unit);
  const min = roundValue(q.min, group);
  const max = q.max === null ? null : roundValue(q.max, group);
  let text = formatNumber(min, group);
  if (max !== null && max !== min) text += `–${formatNumber(max, group)}`;
  return q.unit ? `${text} ${q.unit}` : text;
}
