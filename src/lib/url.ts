const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function url(path: string): string {
  return `${base}/${path.replace(/^\//, '')}`;
}

export function recipeUrl(id: string): string {
  return url(`rezepte/${id}/`);
}

export function tagUrl(tag: string): string {
  return url(`?tags=${encodeURIComponent(tag)}`);
}
