import { quantityHtml, splitQuantities } from './markers';

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
}

export function transformQuantities(node: MdNode): void {
  if (!node.children) return;
  const next: MdNode[] = [];
  for (const child of node.children) {
    if (child.type === 'text' && child.value?.includes('{{')) {
      for (const segment of splitQuantities(child.value)) {
        next.push(
          segment.type === 'text'
            ? { type: 'text', value: segment.value }
            : { type: 'html', value: quantityHtml(segment.raw, segment.quantity) },
        );
      }
    } else {
      transformQuantities(child);
      next.push(child);
    }
  }
  node.children = next;
}

export function remarkQuantities() {
  return (tree: MdNode, file: { path?: string }) => {
    try {
      transformQuantities(tree);
    } catch (error) {
      throw new Error(`${file.path ?? 'Rezept'}: ${(error as Error).message}`);
    }
  };
}
