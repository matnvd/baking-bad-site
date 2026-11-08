// Uploads the web-sized photos in public/media/ to the R2 bucket, skipping
// any that are already there (filenames are content-hashed, so an existing
// key never needs re-uploading).
//
// Usage: npm run photos:upload     (reads credentials from .env; see .env.example)

import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET = 'bakingbad-media' } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Missing R2 credentials. Copy .env.example to .env and fill it in (see README → "One-time Cloudflare setup").');
  process.exit(1);
}

const ROOT = 'public/media';
const TYPES = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4' };

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const local = walk(ROOT)
  .filter((p) => /\.(avif|webp|jpe?g|png|mp4)$/i.test(p))
  .map((p) => ({ path: p, key: relative(ROOT, p).split(sep).join('/') }));

const existing = new Set();
let token;
do {
  const page = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, ContinuationToken: token }));
  for (const o of page.Contents ?? []) existing.add(o.Key);
  token = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (token);

const todo = local.filter((f) => !existing.has(f.key));
console.log(`${local.length} local files, ${existing.size} already in ${R2_BUCKET}, uploading ${todo.length}…`);

let done = 0;
const queue = [...todo];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: f.key,
          Body: readFileSync(f.path),
          ContentType: TYPES[f.key.split('.').pop().toLowerCase()],
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      if (++done % 50 === 0) console.log(`  ${done}/${todo.length}`);
    }
  }),
);
console.log(`Done. Uploaded ${done} file(s).`);
