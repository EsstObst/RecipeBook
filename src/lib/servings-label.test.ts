import { describe, expect, it } from 'vitest';
import { perServingLabel, servingsLabel } from './servings-label';

describe('servingsLabel', () => {
  it('uses the singular for one', () => {
    expect(servingsLabel(1, 'Personen')).toBe('Person');
    expect(servingsLabel(1, 'Portionen')).toBe('Portion');
  });

  it('keeps the plural for other counts', () => {
    expect(servingsLabel(2, 'Personen')).toBe('Personen');
    expect(servingsLabel(0, 'Portionen')).toBe('Portionen');
  });

  it('leaves labels without a known singular unchanged', () => {
    expect(servingsLabel(1, 'Stück')).toBe('Stück');
    expect(servingsLabel(1, 'Gläser')).toBe('Gläser');
  });
});

describe('perServingLabel', () => {
  it('uses „Portion“ for people and portions', () => {
    expect(perServingLabel('Personen')).toBe('Portion');
    expect(perServingLabel('Portionen')).toBe('Portion');
  });

  it('keeps other units', () => {
    expect(perServingLabel('Stück')).toBe('Stück');
  });
});
