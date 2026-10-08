import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const tag = z
  .string()
  .trim()
  .min(1)
  .refine((t) => !t.includes(','), 'Tags dürfen kein Komma enthalten');

const recipes = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/recipes',
    generateId: ({ entry }) => entry.split(/[\\/]/)[0],
  }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        servings: z.number().int().min(1),
        servingsLabel: z.string().min(1).default('Personen'),
        tags: z.array(tag),
        added: z.coerce.date(),
        cover: image().optional(),
        duration: z.number().int().positive().optional(),
        rating: z.number().int().min(1).max(5).optional(),
        cooked: z.boolean().default(false),
        source: z
          .string()
          .min(1)
          .refine((s) => !s.startsWith('http') || URL.canParse(s), 'Quelle ist keine gültige URL')
          .optional(),
      })
      .strict(),
});

export const collections = { recipes };
