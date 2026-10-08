import { describe, expect, it } from 'vitest';
import { formatQuantity, parseQuantity, scaleQuantity } from './scale';

describe('parseQuantity', () => {
  it.each([
    ['500 g', { min: 500, max: null, unit: 'g' }],
    ['1,5 l', { min: 1.5, max: null, unit: 'l' }],
    ['1.5 l', { min: 1.5, max: null, unit: 'l' }],
    ['1/2 TL', { min: 0.5, max: null, unit: 'TL' }],
    ['4 1/8 Tassen', { min: 4.125, max: null, unit: 'Tassen' }],
    ['2–3 EL', { min: 2, max: 3, unit: 'EL' }],
    ['2-3 EL', { min: 2, max: 3, unit: 'EL' }],
    ['800–1000 ml', { min: 800, max: 1000, unit: 'ml' }],
    ['2', { min: 2, max: null, unit: '' }],
    ['4 Stück', { min: 4, max: null, unit: 'Stück' }],
    ['2 Bund', { min: 2, max: null, unit: 'Bund' }],
    ['1.000 g', { min: 1000, max: null, unit: 'g' }],
    ['0.125 l', { min: 0.125, max: null, unit: 'l' }],
  ])('parses %s', (raw, expected) => {
    expect(parseQuantity(raw)).toEqual(expected);
  });

  it.each(['', 'eine Handvoll', '20g', '800 ml – 1 l', '1/0 TL', '3–2 EL', 'ca. 200 g'])(
    'rejects %j',
    (raw) => {
      expect(parseQuantity(raw)).toBeNull();
    },
  );
});

describe('scaleQuantity', () => {
  it('multiplies min and max', () => {
    expect(scaleQuantity({ min: 2, max: 3, unit: 'EL' }, 0.5)).toEqual({ min: 1, max: 1.5, unit: 'EL' });
    expect(scaleQuantity({ min: 500, max: null, unit: 'g' }, 2)).toEqual({ min: 1000, max: null, unit: 'g' });
  });
});

describe('formatQuantity', () => {
  const f = (min: number, unit: string, max: number | null = null) => formatQuantity({ min, max, unit });

  it('rounds g/ml to whole numbers below 10, else to steps of 5', () => {
    expect(f(7.4, 'g')).toBe('7 g');
    expect(f(333.3, 'g')).toBe('335 g');
    expect(f(112.4, 'ml')).toBe('110 ml');
  });

  it('rounds kg/l to one decimal with German comma', () => {
    expect(f(1.25, 'kg')).toBe('1,3 kg');
    expect(f(2, 'l')).toBe('2 l');
  });

  it('rounds spoon-like units to quarters as fractions', () => {
    expect(f(1.4, 'Tassen')).toBe('1 ½ Tassen');
    expect(f(0.75, 'TL')).toBe('¾ TL');
    expect(f(2.0625, 'Tassen')).toBe('2 Tassen');
    expect(f(1.3, 'EL')).toBe('1 ¼ EL');
  });

  it('rounds pieces and unitless to halves', () => {
    expect(f(2.4, 'Stück')).toBe('2 ½ Stück');
    expect(f(3, '')).toBe('3');
    expect(f(1.2, '')).toBe('1');
  });

  it('never shows zero', () => {
    expect(f(0.2, 'g')).toBe('1 g');
    expect(f(0.01, 'kg')).toBe('0,1 kg');
    expect(f(0.05, 'TL')).toBe('¼ TL');
    expect(f(0.1, '')).toBe('¼');
  });

  it('formats ranges and collapses equal bounds', () => {
    expect(f(0.5, 'EL', 0.75)).toBe('½–¾ EL');
    expect(f(101, 'g', 102)).toBe('100 g');
  });
});
