import { getCollection, type CollectionEntry } from 'astro:content';
import { findTagConflicts } from './tags';

export type Recipe = CollectionEntry<'recipes'>;

export async function getRecipes(): Promise<Recipe[]> {
  const recipes = await getCollection('recipes');
  const conflicts = findTagConflicts(recipes.map((r) => r.data.tags));
  if (conflicts.length > 0) {
    throw new Error(`Tags unterscheiden sich nur in der Schreibweise: ${conflicts.join('; ')}`);
  }
  return recipes.sort((a, b) => a.data.title.localeCompare(b.data.title, 'de'));
}
