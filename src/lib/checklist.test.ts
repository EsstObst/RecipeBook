import { describe, expect, it } from 'vitest';
import { parseChecked, serializeChecked } from './checklist';

describe('parseChecked', () => {
  it('returns an empty set for missing or broken data', () => {
    expect(parseChecked(null)).toEqual(new Set());
    expect(parseChecked('{')).toEqual(new Set());
    expect(parseChecked('"x"')).toEqual(new Set());
  });

  it('keeps only string entries', () => {
    expect(parseChecked('[1,"3",null,"0"]')).toEqual(new Set(['3', '0']));
  });

  it('round-trips with serializeChecked', () => {
    const set = new Set(['2', '0']);
    expect(serializeChecked(set)).toBe('["0","2"]');
    expect(parseChecked(serializeChecked(set))).toEqual(set);
  });
});
