import { parseQuantity, type Quantity } from './scale';

export type Segment = { type: 'text'; value: string } | { type: 'qty'; raw: string; quantity: Quantity };

export function splitQuantities(text: string): Segment[] {
  const segments: Segment[] = [];
  let rest = text;
  while (rest.length > 0) {
    const open = rest.indexOf('{{');
    if (open === -1) {
      segments.push({ type: 'text', value: rest });
      break;
    }
    const close = rest.indexOf('}}', open + 2);
    if (close === -1) throw new Error(`Nicht geschlossene Mengenmarkierung: "${rest.slice(open)}"`);
    if (open > 0) segments.push({ type: 'text', value: rest.slice(0, open) });
    const raw = rest.slice(open + 2, close).trim();
    const quantity = parseQuantity(raw);
    if (!quantity) throw new Error(`Unlesbare Mengenmarkierung: "{{${raw}}}"`);
    segments.push({ type: 'qty', raw, quantity });
    rest = rest.slice(close + 2);
  }
  return segments;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function quantityHtml(raw: string, q: Quantity): string {
  return `<span class="qty" data-min="${q.min}" data-max="${q.max ?? ''}" data-unit="${escapeHtml(q.unit)}">${escapeHtml(raw)}</span>`;
}
