/** Turns a template name into a URL-safe slug base. Pure — uniqueness (appending -2, -3, …) is resolved by the caller against the database. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
