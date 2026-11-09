import manifest from '../data/photos.json';

// Photos are served from /media/* — locally from public/media (built by
// `npm run photos:build`), in production from the R2 bucket via
// worker/index.ts.
export const MEDIA_BASE = '/media';

export interface Photo {
  id: string; // "<event-id>/<hash>"
  w: number;
  h: number;
  color: string;
  widths: number[];
}

const events = manifest.events as Record<string, Photo[]>;

export const loaderFrames = manifest.loader as { src: string; color: string }[];

export interface Video {
  event: string;
  label: string;
  src: string;
  poster: string;
  w: number;
  h: number;
}
export const videos = (manifest.videos ?? []) as Video[];

export function photosFor(eventId: string): Photo[] {
  return events[eventId] ?? [];
}

export function srcset(p: Photo, ext: 'avif' | 'webp') {
  return p.widths.map((w) => `${MEDIA_BASE}/${p.id}-${w}.${ext} ${w}w`).join(', ');
}

/** A mid-sized fallback src for browsers without srcset support. */
export function fallbackSrc(p: Photo) {
  const w = p.widths.find((x) => x >= 960) ?? p.widths.at(-1);
  return `${MEDIA_BASE}/${p.id}-${w}.webp`;
}

/** Serializable shape the photo viewer script uses. */
export function galleryItem(p: Photo) {
  return { avif: srcset(p, 'avif'), webp: srcset(p, 'webp'), src: fallbackSrc(p), w: p.w, h: p.h, color: p.color };
}
