import { describe, expect, it } from 'vitest';
import { remarkQuantities, transformQuantities } from './remark-quantities';

const listWith = (value: string) => ({
  type: 'root',
  children: [
    {
      type: 'list',
      children: [{ type: 'listItem', children: [{ type: 'paragraph', children: [{ type: 'text', value }] }] }],
    },
  ],
});

describe('transformQuantities', () => {
  it('replaces markers in nested text nodes with html nodes', () => {
    const tree = listWith('{{500 g}} Orzo');
    transformQuantities(tree);
    expect(tree.children[0].children[0].children[0].children).toEqual([
      { type: 'html', value: '<span class="qty" data-min="500" data-max="" data-unit="g">500 g</span>' },
      { type: 'text', value: ' Orzo' },
    ]);
  });

  it('leaves text without markers untouched', () => {
    const tree = listWith('Salz, Pfeffer');
    transformQuantities(tree);
    expect(tree.children[0].children[0].children[0].children).toEqual([{ type: 'text', value: 'Salz, Pfeffer' }]);
  });
});

describe('remarkQuantities', () => {
  it('prefixes errors with the file path', () => {
    const run = remarkQuantities();
    expect(() => run(listWith('{{eine Handvoll}} Rucola'), { path: 'src/content/recipes/x/index.md' })).toThrow(
      'src/content/recipes/x/index.md: Unlesbare Mengenmarkierung: "{{eine Handvoll}}"',
    );
  });
});
