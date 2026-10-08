import { describe, expect, it } from 'vitest';
import { groupSections, sectionKey } from './rehype-sections';

const h2 = (text: string) => ({ type: 'element', tagName: 'h2', properties: {}, children: [{ type: 'text', value: text }] });
const el = (tagName: string) => ({ type: 'element', tagName, properties: {}, children: [] });

describe('sectionKey', () => {
  it('slugifies German headings', () => {
    expect(sectionKey('Zutaten')).toBe('zutaten');
    expect(sectionKey('Tipps & Varianten')).toBe('tipps-varianten');
    expect(sectionKey('Größe')).toBe('groesse');
  });
});

describe('groupSections', () => {
  it('wraps sections and splits them into aside and main', () => {
    const zutaten = h2('Zutaten');
    const ul = el('ul');
    const equipment = h2('Equipment');
    const ul2 = el('ul');
    const zubereitung = h2('Zubereitung');
    const ol = el('ol');
    const tipps = h2('Tipps');
    const ul3 = el('ul');
    const root = { type: 'root', children: [zutaten, ul, equipment, ul2, zubereitung, ol, tipps, ul3] };

    groupSections(root);

    const section = (key: string, children: unknown[]) => ({
      type: 'element',
      tagName: 'section',
      properties: { className: ['recipe-section', `recipe-section--${key}`] },
      children,
    });
    expect(root.children).toEqual([
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['recipe-aside'] },
        children: [section('zutaten', [zutaten, ul]), section('equipment', [equipment, ul2])],
      },
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['recipe-main'] },
        children: [section('zubereitung', [zubereitung, ol]), section('tipps', [tipps, ul3])],
      },
    ]);
  });

  it('leaves documents without h2 unchanged', () => {
    const p = el('p');
    const root = { type: 'root', children: [p] };
    groupSections(root);
    expect(root.children).toEqual([p]);
  });
});
