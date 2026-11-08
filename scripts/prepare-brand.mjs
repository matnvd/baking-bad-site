// Trims the club's logo + mascot art (which ship with large empty margins)
// and writes web-ready copies into src/assets/brand/, plus favicons and a
// social-share image into public/.
//
// Usage: npm run brand
// Sources live in media/design/ (gitignored). The outputs are committed.

import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'media/design';
const OUT = 'src/assets/brand';
const CREAM = '#fffaf2';

// output name -> preferred source files (first one that exists wins)
const art = {
  'logo.png': ['hires-logo.png', 'logo.png'],
  'tiger-whisk.png': ['hires-tiger-whisk.png', 'mascot-whisk.png'],
  'tiger-paws.png': ['hires-tiger-paws.png', 'mascot-peek.png'],
  'tiger-santa.png': ['hires-tiger-santa.png', 'mascot-santa.png'],
  'tiger-valentine.png': ['hires-tiger-valentine.png', 'mascot-valentine.png'],
};

function pick(names) {
  for (const n of names) {
    const p = join(SRC, n);
    if (existsSync(p)) return p;
  }
  throw new Error(`None of ${names.join(', ')} found in ${SRC}/`);
}

mkdirSync(OUT, { recursive: true });

for (const [out, sources] of Object.entries(art)) {
  const src = pick(sources);
  const info = await sharp(src)
    .trim({ threshold: 1 })
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }) // largest size the site uses (2× retina)
    .png({ compressionLevel: 9, palette: false })
    .toFile(join(OUT, out));
  console.log(`${out.padEnd(22)} ← ${src} (${info.width}×${info.height})`);
}

// Favicons + share image, built from the trimmed logo.
const logo = join(OUT, 'logo.png');
const square = (size, pad = 0, bg = { r: 0, g: 0, b: 0, alpha: 0 }) =>
  sharp(logo)
    .resize(size - pad * 2, size - pad * 2, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: bg })
    .png();

await square(32).toFile('public/favicon-32.png');
await square(180, 14, CREAM).flatten({ background: CREAM }).toFile('public/apple-touch-icon.png');

const ogLogo = await sharp(logo).resize(470, 470, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: CREAM } })
  .composite([{ input: ogLogo, gravity: 'center' }])
  .png()
  .toFile('public/og.png');

console.log('favicons + og.png written to public/');
