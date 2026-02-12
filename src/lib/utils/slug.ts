export function generateSlug(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

export function uniqueSlug(headline: string): string {
  const base = generateSlug(headline);
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}
