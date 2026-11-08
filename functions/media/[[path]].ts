// Cloudflare Pages Function: serves event photos from the R2 bucket at
// /media/<key>, on the site's own domain.
//
// Keys look like "2026-04-03-pfc/1a2b3c4d5e6f-960.avif". They contain a hash
// of the original photo, so a given URL never changes: we can tell browsers
// and Cloudflare's edge to cache it for a year.
//
// Locally, `npm run dev` / `npm run preview` serve the same files straight
// from public/media and this function isn't involved.

interface Env {
  MEDIA: R2Bucket;
}

const TYPES: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};
const SAFE_KEY = /^[a-z0-9][a-z0-9._/-]*\.(avif|webp|jpe?g|png)$/i;
const IMMUTABLE = 'public, max-age=31536000, immutable';

export const onRequest: PagesFunction<Env> = async ({ request, env, params, waitUntil, next }) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const key = ([] as string[]).concat(params.path ?? []).join('/');
  if (!SAFE_KEY.test(key) || key.includes('..')) return notFound();

  // Edge cache first, so repeat hits never touch R2.
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) return request.method === 'HEAD' ? new Response(null, hit) : hit;

  const object = await env.MEDIA.get(key);
  // Not in R2 (e.g. not uploaded yet): fall back to a static copy if the
  // build happened to include one, otherwise the site's 404.
  if (!object) return next();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.has('content-type')) headers.set('content-type', TYPES[key.split('.').pop()!.toLowerCase()]);
  headers.set('cache-control', IMMUTABLE);
  headers.set('etag', object.httpEtag);
  headers.set('x-content-type-options', 'nosniff');

  const response = new Response(object.body, { headers });
  waitUntil(cache.put(cacheKey, response.clone()));
  return request.method === 'HEAD' ? new Response(null, response) : response;
};

function notFound() {
  return new Response('Not found', { status: 404, headers: { 'cache-control': 'public, max-age=60' } });
}
