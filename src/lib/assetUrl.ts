/** Resolve a project-root asset path for the current deploy base (e.g. GitHub Pages). */
export function assetUrl(path: string): string {
  const normalized = path.replace(/^\//, '');
  return `${import.meta.env.BASE_URL}${normalized}`;
}
