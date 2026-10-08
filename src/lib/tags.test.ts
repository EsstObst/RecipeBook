import { describe, expect, it } from 'vitest';
import { allTags, findTagConflicts } from './tags';

describe('findTagConflicts', () => {
  it('finds tags that differ only in case', () => {
    expect(findTagConflicts([['Vegetarisch', 'Hauptspeise'], ['vegetarisch'], ['Hauptspeise']])).toEqual([
      'Vegetarisch / vegetarisch',
    ]);
  });

  it('returns nothing for consistent tags', () => {
    expect(findTagConflicts([['Rind'], ['Rind', 'Suppe']])).toEqual([]);
  });
});

describe('allTags', () => {
  it('returns unique tags sorted in German order', () => {
    expect(allTags([['Suppe', 'Ärger'], ['Auflauf', 'Suppe']])).toEqual(['Ärger', 'Auflauf', 'Suppe']);
  });
});
