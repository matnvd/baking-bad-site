// Cloudflare Worker for the site.
//
// Static files (the built Astro site in dist/) are served by Cloudflare's
// static-assets layer, configured in wrangler.toml. Only /media/* requests
// reach this script: it serves event photos and video loops from the R2
// bucket, on the site's own domain.
//
// Keys look like "2026-04-03-pfc/1a2b3c4d5e6f-960.avif". They contain a hash
// of the original file, so a given URL never changes: browsers and
// Cloudflare's edge can cache it for a year.
//
// Locally, `npm run dev` / `npm run preview` serve the same files straight
// from public/media and this script isn't involved.

interface Env {
  MEDIA: R2Bucket; // the bakingbad-media bucket
  ASSETS: Fetcher; // the built site (dist/)
}

const TYPES: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  mp4: 'video/mp4',
};
const SAFE_KEY = /^[a-z0-9][a-z0-9._/-]*\.(avif|webp|jpe?g|png|mp4)$/i;
const IMMUTABLE = 'public, max-age=31536000, immutable';

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/media/')) return env.ASSETS.fetch(request);
    return media(request, env, ctx, url.pathname.slice('/media/'.length));
  },
} satisfies ExportedHandler<Env>;

async function media(request: Request, env: Env, ctx: ExecutionContext, key: string): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  try {
    key = decodeURIComponent(key);
  } catch {
    return notFound();
  }
  if (!SAFE_KEY.test(key) || key.includes('..')) return notFound();

  // Byte-range requests (Safari always uses these for <video>): answer
  // straight from R2 with a 206; the edge cache only stores full responses.
  if (request.headers.has('range')) {
    const part = await env.MEDIA.get(key, { range: request.headers });
    if (!part) return fallback(request, env);
    const headers = baseHeaders(part, key);
    const r = part.range as { offset?: number; length?: number; suffix?: number } | undefined;
    if (!r) return new Response(request.method === 'HEAD' ? null : part.body, { headers });
    const offset = r.suffix !== undefined ? part.size - r.suffix : (r.offset ?? 0);
    const length = r.suffix !== undefined ? r.suffix : (r.length ?? part.size - offset);
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${part.size}`);
    headers.set('content-length', String(length));
    return new Response(request.method === 'HEAD' ? null : part.body, { status: 206, headers });
  }

  // Edge cache first, so repeat hits never touch R2.
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) return request.method === 'HEAD' ? new Response(null, hit) : hit;

  const object = await env.MEDIA.get(key);
  if (!object) return fallback(request, env);

  const headers = baseHeaders(object, key);
  const response = new Response(object.body, { headers });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return request.method === 'HEAD' ? new Response(null, response) : response;
}

// Not in R2 (e.g. not uploaded yet): use a static copy if the build happened
// to include one (local builds do), otherwise the site's 404 page.
async function fallback(request: Request, env: Env): Promise<Response> {
  const res = await env.ASSETS.fetch(request);
  return res.ok ? res : notFound();
}

function baseHeaders(object: R2Object, key: string) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.has('content-type')) headers.set('content-type', TYPES[key.split('.').pop()!.toLowerCase()]);
  headers.set('cache-control', IMMUTABLE);
  headers.set('etag', object.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('x-content-type-options', 'nosniff');
  return headers;
}

function notFound() {
  return new Response('Not found', { status: 404, headers: { 'cache-control': 'public, max-age=60' } });
}
