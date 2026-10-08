import { defineConfig } from 'astro/config';
import { remarkQuantities } from './src/lib/remark-quantities.ts';
import { rehypeSections } from './src/lib/rehype-sections.ts';

export default defineConfig({
  site: 'https://esstobst.github.io',
  base: '/RecipeBook',
  markdown: {
    remarkPlugins: [remarkQuantities],
    rehypePlugins: [rehypeSections],
  },
});
