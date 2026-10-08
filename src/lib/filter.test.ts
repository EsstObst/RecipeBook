import { describe, expect, it } from 'vitest';
import { filterAndSort, normalize, parseState, toSearch, type RecipeSummary } from './filter';

const r = (id: string, title: string, extra: Partial<RecipeSummary> = {}): RecipeSummary => ({
  id,
  title,
  tags: [],
  rating: null,
  duration: null,
  added: '2026-10-08',
  ingredients: '',
  ...extra,
});

const items = [
  r('orzo', 'Mediterrane Hähnchen-Orzo', { tags: ['Hähnchen', 'Hauptspeise'], rating: 4, duration: 60, ingredients: 'Orzo · Babyspinat' }),
  r('gnocchi', 'Gnocchi in Spinat-Frischkäse-Soße', { tags: ['Hauptspeise', 'Vegetarisch'], duration: 20, added: '2026-10-09', ingredients: 'Gnocchi · Babyspinat' }),
  r('steak', 'Steak braten', { tags: ['Hauptspeise', 'Rind'], rating: 5, duration: 15 }),
  r('mochis', 'Potato Mochis', { tags: ['Snack'] }),
];
const state = (over: Partial<{ tags: string[]; q: string; sort: 'name' | 'rating' | 'duration' | 'added' }> = {}) => ({
  tags: [],
  q: '',
  sort: 'name' as const,
  ...over,
});

describe('normalize', () => {
  it('makes umlauts and their transliterations equal', () => {
    expect(normalize('Hähnchen')).toBe(normalize('haehnchen'));
    expect(normalize('Hähnchen')).toBe(normalize('hahnchen'));
    expect(normalize('Soße')).toBe(normalize('sosse'));
  });
});

describe('filterAndSort', () => {
  it('sorts by name by default', () => {
    expect(filterAndSort(items, state())).toEqual(['gnocchi', 'orzo', 'mochis', 'steak']);
  });

  it('requires all selected tags', () => {
    expect(filterAndSort(items, state({ tags: ['Hauptspeise', 'Vegetarisch'] }))).toEqual(['gnocchi']);
  });

  it('searches title and ingredients, every word, umlaut-insensitive', () => {
    expect(filterAndSort(items, state({ q: 'haehnchen' }))).toEqual(['orzo']);
    expect(filterAndSort(items, state({ q: 'babyspinat gnocchi' }))).toEqual(['gnocchi']);
    expect(filterAndSort(items, state({ q: 'pizza' }))).toEqual([]);
  });

  it('sorts by rating desc with missing values last and name as tie-breaker', () => {
    expect(filterAndSort(items, state({ sort: 'rating' }))).toEqual(['steak', 'orzo', 'gnocchi', 'mochis']);
  });

  it('sorts by duration asc with missing values last', () => {
    expect(filterAndSort(items, state({ sort: 'duration' }))).toEqual(['steak', 'gnocchi', 'orzo', 'mochis']);
  });

  it('sorts by added desc with name as tie-breaker', () => {
    expect(filterAndSort(items, state({ sort: 'added' }))).toEqual(['gnocchi', 'orzo', 'mochis', 'steak']);
  });
});

describe('URL state', () => {
  const known = ['Hähnchen', 'Hauptspeise', 'Rind'];

  it('round-trips state through the query string', () => {
    const s = { tags: ['Hähnchen', 'Rind'], q: 'orzo', sort: 'rating' as const };
    expect(parseState(toSearch(s), known)).toEqual(s);
  });

  it('omits defaults', () => {
    expect(toSearch(state())).toBe('');
  });

  it('ignores unknown tags and invalid sort values', () => {
    expect(parseState('?tags=Main%20dish,Rind&sort=xyz', known)).toEqual({ tags: ['Rind'], q: '', sort: 'name' });
  });
});
