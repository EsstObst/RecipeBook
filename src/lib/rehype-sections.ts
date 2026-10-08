interface HNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HNode[];
  value?: string;
}

const ASIDE_KEYS = new Set(['zutaten', 'equipment']);

export function sectionKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function textOf(node: HNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}

const wrapper = (className: string, children: HNode[]): HNode => ({
  type: 'element',
  tagName: 'div',
  properties: { className: [className] },
  children,
});

export function groupSections(root: HNode): void {
  const before: HNode[] = [];
  const aside: HNode[] = [];
  const main: HNode[] = [];
  let current: HNode | null = null;

  for (const child of root.children ?? []) {
    if (child.type === 'element' && child.tagName === 'h2') {
      const key = sectionKey(textOf(child));
      current = {
        type: 'element',
        tagName: 'section',
        properties: { className: ['recipe-section', `recipe-section--${key}`] },
        children: [child],
      };
      (ASIDE_KEYS.has(key) ? aside : main).push(current);
    } else if (current) {
      current.children!.push(child);
    } else {
      before.push(child);
    }
  }

  if (aside.length === 0 && main.length === 0) return;
  root.children = [
    ...before,
    ...(aside.length > 0 ? [wrapper('recipe-aside', aside)] : []),
    ...(main.length > 0 ? [wrapper('recipe-main', main)] : []),
  ];
}

export function rehypeSections() {
  return (tree: HNode) => groupSections(tree);
}
