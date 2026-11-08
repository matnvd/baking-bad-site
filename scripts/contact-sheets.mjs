// Makes numbered contact sheets for each bake-night folder so you can pick
// which photos go on the site. macOS only (uses `sips` to read iPhone HEICs).
//
// Usage: node scripts/contact-sheets.mjs [media_dir] [out_dir]
//   media_dir defaults to media/bake_nights, out_dir to /tmp/bakingbad-sheets
// Output per event folder:
//   <out>/<folder>/sheet-N.jpg   6×5 numbered tiles
//   <out>/<folder>/index.txt     tile number → original filename
// Then copy the filenames you like into scripts/photo-picks.json.

import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { cpus } from 'node:os';

const run = promisify(execFile);
const MEDIA = process.argv[2] ?? 'media/bake_nights';
const OUT = process.argv[3] ?? '/tmp/bakingbad-sheets';
const TILE = Number(process.env.TILE ?? 360);
const COLS = Number(process.env.COLS ?? 6);
const ROWS = Number(process.env.ROWS ?? 5);
const GAP = 6;
const IMAGE = /\.(heic|jpe?g|png)$/i;

async function pool(items, limit, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

for (const folder of readdirSync(MEDIA, { withFileTypes: true })) {
  if (!folder.isDirectory()) continue;
  const src = join(MEDIA, folder.name);
  const dest = join(OUT, folder.name);
  const thumbs = join(dest, 'thumbs');
  mkdirSync(thumbs, { recursive: true });

  const files = readdirSync(src).filter((f) => IMAGE.test(f)).sort();
  if (!files.length) continue;
  writeFileSync(join(dest, 'index.txt'), files.map((f, i) => `${i}\t${f}`).join('\n') + '\n');

  const jobs = files.map((f, i) => ({ from: join(src, f), to: join(thumbs, `${String(i).padStart(3, '0')}.jpg`) }));
  await pool(jobs, cpus().length, async ({ from, to }) => {
    if (existsSync(to)) return;
    try {
      await run('sips', ['-s', 'format', 'jpeg', '-Z', String(TILE), from, '--out', to]);
    } catch {
      console.warn(`  could not convert ${from}`);
    }
  });

  const perSheet = COLS * ROWS;
  for (let s = 0; s * perSheet < jobs.length; s++) {
    const batch = jobs.slice(s * perSheet, (s + 1) * perSheet);
    const composites = [];
    for (const [k, job] of batch.entries()) {
      if (!existsSync(job.to)) continue;
      const n = s * perSheet + k;
      const left = (k % COLS) * (TILE + GAP);
      const top = Math.floor(k / COLS) * (TILE + GAP);
      const img = await sharp(job.to).rotate().resize(TILE, TILE, { fit: 'contain', background: '#fff' }).toBuffer();
      const label = Buffer.from(
        `<svg width="64" height="40"><rect width="64" height="40" rx="6" fill="#000" fill-opacity=".7"/>` +
          `<text x="32" y="28" font-family="Helvetica" font-size="24" font-weight="700" fill="#fff" text-anchor="middle">${n}</text></svg>`,
      );
      composites.push({ input: img, left, top }, { input: label, left: left + 6, top: top + 6 });
    }
    const rows = Math.ceil(batch.length / COLS);
    await sharp({
      create: { width: COLS * (TILE + GAP) - GAP, height: rows * (TILE + GAP) - GAP, channels: 3, background: '#fff' },
    })
      .composite(composites)
      .jpeg({ quality: 70 })
      .toFile(join(dest, `sheet-${s + 1}.jpg`));
  }
  console.log(`${basename(dest)}: ${files.length} photos`);
}
