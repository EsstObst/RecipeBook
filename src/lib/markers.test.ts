import { describe, expect, it } from 'vitest';
import { quantityHtml, splitQuantities } from './markers';

describe('splitQuantities', () => {
  it('returns plain text unchanged', () => {
    expect(splitQuantities('Salz, Pfeffer')).toEqual([{ type: 'text', value: 'Salz, Pfeffer' }]);
  });

  it('splits markers out of text', () => {
    expect(splitQuantities('Orzo anrösten. {{4 1/8 Tassen}} Brühe und {{2}} Zitronen')).toEqual([
      { type: 'text', value: 'Orzo anrösten. ' },
      { type: 'qty', raw: '4 1/8 Tassen', quantity: { min: 4.125, max: null, unit: 'Tassen' } },
      { type: 'text', value: ' Brühe und ' },
      { type: 'qty', raw: '2', quantity: { min: 2, max: null, unit: '' } },
      { type: 'text', value: ' Zitronen' },
    ]);
  });

  it('throws on unclosed marker', () => {
    expect(() => splitQuantities('{{500 g Orzo')).toThrow(/Nicht geschlossene Mengenmarkierung/);
  });

  it.each(['{{}} Orzo', '{{eine Handvoll}} Rucola', '{{20g}} Ingwer', '{{800 ml – 1 l}} Tomaten'])(
    'throws on unreadable marker %j',
    (text) => {
      expect(() => splitQuantities(text)).toThrow(/Unlesbare Mengenmarkierung/);
    },
  );
});

describe('quantityHtml', () => {
  it('renders a span with data attributes and escapes text', () => {
    expect(quantityHtml('2–3 EL', { min: 2, max: 3, unit: 'EL' })).toBe(
      '<span class="qty" data-min="2" data-max="3" data-unit="EL">2–3 EL</span>',
    );
    expect(quantityHtml('1 <x>', { min: 1, max: null, unit: '<x>' })).toBe(
      '<span class="qty" data-min="1" data-max="" data-unit="&lt;x&gt;">1 &lt;x&gt;</span>',
    );
  });
});
