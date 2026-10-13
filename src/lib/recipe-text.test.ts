import { describe, expect, it } from 'vitest';
import { ingredientLines, ingredientText, stepTexts } from './recipe-text';

const body = [
  '## Zutaten',
  '',
  '### Mochis',
  '- {{450 g}} Kartoffeln, mehligkochend',
  '- **Gouda**',
  '',
  '### Glasur',
  '- {{8 EL}} Sojasoße',
  '',
  '## Zubereitung',
  '1. **Kochen:** Kartoffeln kochen.',
].join('\r\n');

describe('ingredientText', () => {
  it('collects ingredient lines without markers and formatting', () => {
    expect(ingredientText(body)).toBe('Kartoffeln, mehligkochend · Gouda · Sojasoße');
  });

  it('returns empty text without an ingredient section', () => {
    expect(ingredientText('## Zubereitung\n1. Kochen')).toBe('');
  });
});

describe('ingredientLines', () => {
  it('keeps quantities and strips markup', () => {
    expect(ingredientLines(body)).toEqual(['450 g Kartoffeln, mehligkochend', 'Gouda', '8 EL Sojasoße']);
  });
});

describe('stepTexts', () => {
  it('returns step text without title, markup and images', () => {
    const steps = [
      '## Zubereitung',
      '1. **Anbraten:** {{2}} Zwiebeln *(nicht zu heiß!)* anbraten.',
      '   ![Bild](./schritt-1.jpg)',
      '2. **Servieren:** Servieren.',
      '',
      '## Tipps',
      '- Tipp',
    ].join('\n');
    expect(stepTexts(steps)).toEqual(['Anbraten: 2 Zwiebeln (nicht zu heiß!) anbraten.', 'Servieren: Servieren.']);
  });

  it('appends continuation lines to the current step', () => {
    expect(stepTexts('## Zubereitung\n1. **A:** Eins\n   - Unterpunkt\n2. **B:** Zwei')).toEqual(['A: Eins Unterpunkt', 'B: Zwei']);
  });
});
