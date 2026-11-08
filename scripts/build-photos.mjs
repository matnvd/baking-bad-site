// Turns the photos listed in scripts/photo-picks.json into web-sized images
// and writes the manifest the site reads (src/data/photos.json).
//
// Usage: npm run photos:build      (macOS: uses `sips` to read iPhone HEICs)
//
// Output (gitignored):  public/media/<event>/<hash>-<width>.{avif,webp}
//                       public/media/loader/<hash>-240.webp
//                       public/media/videos/<hash>-540.{mp4,webp}   (needs ffmpeg)
// Output (committed):   src/data/photos.json
// Filenames include a hash of the original file, so they never change and can
// be cached forever. Then run `npm run photos:upload` to push them to R2.

import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);
const MEDIA = 'media/bake_nights';
const OUT = 'public/media';
const MANIFEST = 'src/data/photos.json';
const WIDTHS = [480, 960, 1600];
const LOADER_SIZE = 240;
const CACHE = join(tmpdir(), 'bakingbad-photo-cache');

const picks = JSON.parse(readFileSync('scripts/photo-picks.json', 'utf8'));
mkdirSync(CACHE, { recursive: true });

const hashOf = (file) => createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 12);

// HEIC → full-size JPEG once (sharp can't decode iPhone HEVC images).
async function decoded(src, hash) {
  if (!/\.heic$/i.test(src)) return src;
  const jpg = join(CACHE, `${hash}.jpg`);
  if (!existsSync(jpg)) await run('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', src, '--out', jpg]);
  return jpg;
}

async function processPhoto(event, source, file) {
  const src = join(MEDIA, source, file);
  if (!existsSync(src)) throw new Error(`Missing ${src} (listed in photo-picks.json)`);
  const hash = hashOf(src);
  const input = await decoded(src, hash);

  // Auto-rotate from EXIF once, then reuse the upright buffer.
  const upright = await sharp(input).rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = upright.info;
  const widths = WIDTHS.filter((w) => w < width).concat(width < WIDTHS.at(-1) ? [width] : []).slice(0, WIDTHS.length);
  mkdirSync(join(OUT, event), { recursive: true });

  for (const w of widths) {
    const base = join(OUT, event, `${hash}-${w}`);
    if (!existsSync(`${base}.avif`)) await sharp(upright.data).resize({ width: w }).avif({ quality: 52, effort: 5 }).toFile(`${base}.avif`);
    if (!existsSync(`${base}.webp`)) await sharp(upright.data).resize({ width: w }).webp({ quality: 78 }).toFile(`${base}.webp`);
  }

  // Average color, softened toward cream, used as the placeholder while the image loads.
  const { channels } = await sharp(upright.data).resize(64).stats();
  const color = '#' + channels.slice(0, 3).map((c) => Math.round(c.mean * 0.7 + 250 * 0.3).toString(16).padStart(2, '0')).join('');
  return { id: `${event}/${hash}`, w: width, h: height, color, widths, upright: upright.data };
}

async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) {
        const k = i++;
        results[k] = await fn(items[k]);
      }
    }),
  );
  return results;
}

const jobs = Object.entries(picks.events).flatMap(([event, { source, photos }]) =>
  photos.map((file) => ({ event, source, file })),
);
console.log(`Processing ${jobs.length} photos…`);
const done = await pool(jobs, Math.max(2, cpus().length - 2), async (job) => {
  const r = await processPhoto(job.event, job.source, job.file);
  process.stdout.write('.');
  return { ...job, ...r };
});
process.stdout.write('\n');

const events = {};
for (const p of done) {
  (events[p.event] ??= []).push({ id: p.id, w: p.w, h: p.h, color: p.color, widths: p.widths });
}

// Loader frames: small square crops of chosen covers.
mkdirSync(join(OUT, 'loader'), { recursive: true });
const loader = [];
for (const { event, photo } of picks.loader) {
  const p = done.find((d) => d.event === event && d.file === photo);
  if (!p) throw new Error(`Loader photo ${event}/${photo} must also be in that event's photos`);
  const hash = p.id.split('/')[1];
  const file = join(OUT, 'loader', `${hash}-${LOADER_SIZE}.webp`);
  if (!existsSync(file)) {
    await sharp(p.upright).resize(LOADER_SIZE, LOADER_SIZE, { fit: 'cover', position: 'attention' }).webp({ quality: 72 }).toFile(file);
  }
  loader.push({ src: `/media/loader/${hash}-${LOADER_SIZE}.webp`, color: p.color });
}

// Video loops: short, muted, vertical 9:16 clips (H.264 MP4 + a poster).
// Needs ffmpeg. The hash covers the source file and the chosen segment.
const VIDEO_W = 540;
const VIDEO_H = 960;
mkdirSync(join(OUT, 'videos'), { recursive: true });
const videos = [];
for (const v of picks.videos ?? []) {
  const { source } = picks.events[v.event] ?? {};
  if (!source) throw new Error(`Video event ${v.event} must also be listed under events`);
  const src = join(MEDIA, source, v.file);
  if (!existsSync(src)) throw new Error(`Missing ${src} (listed in photo-picks.json → videos)`);
  const hash = createHash('sha1').update(readFileSync(src)).update(`${v.start}:${v.duration}`).digest('hex').slice(0, 12);
  const base = join(OUT, 'videos', `${hash}-${VIDEO_W}`);
  const crop = `scale=${VIDEO_W}:${VIDEO_H}:force_original_aspect_ratio=increase,crop=${VIDEO_W}:${VIDEO_H}`;
  if (!existsSync(`${base}.mp4`)) {
    await run('ffmpeg', [
      '-v', 'error', '-y', '-ss', String(v.start), '-t', String(v.duration), '-i', src,
      '-vf', `${crop},fps=30`, '-an',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', `${base}.mp4`,
    ]);
  }
  if (!existsSync(`${base}.webp`)) {
    const jpg = join(CACHE, `${hash}-poster.jpg`);
    await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(v.start + 0.2), '-i', src, '-frames:v', '1', '-vf', crop, jpg]);
    await sharp(jpg).webp({ quality: 72 }).toFile(`${base}.webp`);
  }
  videos.push({
    event: v.event,
    label: v.label,
    src: `/media/videos/${hash}-${VIDEO_W}.mp4`,
    poster: `/media/videos/${hash}-${VIDEO_W}.webp`,
    w: VIDEO_W,
    h: VIDEO_H,
  });
  process.stdout.write('v');
}
if (videos.length) process.stdout.write('\n');

writeFileSync(MANIFEST, JSON.stringify({ events, loader, videos }, null, 2) + '\n');
console.log(
  `Wrote ${MANIFEST}: ${done.length} photos across ${Object.keys(events).length} events, ${loader.length} loader frames, ${videos.length} videos.`,
);
