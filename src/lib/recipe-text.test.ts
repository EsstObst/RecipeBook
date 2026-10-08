import { describe, expect, it } from 'vitest';
import { ingredientText } from './recipe-text';

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
