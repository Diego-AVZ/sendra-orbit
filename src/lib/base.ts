/** Prefix a root-absolute path with Vite's base (`/` locally, `/sendra-orbit/` on Pages). */
export function withBase(path = '/'): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (path === '/' || path === '') return `${base}/`;
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
}
