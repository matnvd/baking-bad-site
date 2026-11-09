// Uploads the web-sized photos/videos in public/media/ to the R2 bucket,
// skipping any already there (filenames are content-hashed, so an existing
// key never needs re-uploading).
//
// Usage: npm run photos:upload     (reads credentials from .env; see .env.example)
//
// Credentials — either of these works (see README → "One-time Cloudflare setup"):
//   A) R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY  (from R2's own token page)
//   B) CLOUDFLARE_API_TOKEN                     (any Cloudflare API token with R2 edit/write access)
//      Cloudflare's docs: S3 Access Key ID = the token's id,
//      Secret Access Key = SHA-256 hash of the token value. We derive both.

import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CLOUDFLARE_API_TOKEN, R2_BUCKET = 'bakingbad-media' } = process.env;
const help = 'See README → "One-time Cloudflare setup".';

if (!R2_ACCOUNT_ID) {
  console.error(`Missing R2_ACCOUNT_ID in .env. ${help}`);
  process.exit(1);
}

async function credentials() {
  if (R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    return { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY };
  }
  if (CLOUDFLARE_API_TOKEN) {
    // Look up the token's id (account-owned tokens first, then user tokens).
    const urls = [
      `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/tokens/verify`,
      'https://api.cloudflare.com/client/v4/user/tokens/verify',
    ];
    for (const url of urls) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` } });
      const body = await res.json().catch(() => null);
      if (body?.success && body.result?.id) {
        if (body.result.status && body.result.status !== 'active') {
          console.error(`That API token is ${body.result.status}. ${help}`);
          process.exit(1);
        }
        return {
          accessKeyId: body.result.id,
          secretAccessKey: createHash('sha256').update(CLOUDFLARE_API_TOKEN).digest('hex'),
        };
      }
    }
    console.error(`Cloudflare didn't accept CLOUDFLARE_API_TOKEN (wrong value, or it was deleted). ${help}`);
    process.exit(1);
  }
  console.error(`No credentials in .env: set CLOUDFLARE_API_TOKEN, or R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY. ${help}`);
  process.exit(1);
}

const ROOT = 'public/media';
const TYPES = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4' };

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: await credentials(),
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
try {
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, ContinuationToken: token }));
    for (const o of page.Contents ?? []) existing.add(o.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
} catch (err) {
  const name = err?.name ?? err?.Code ?? 'Error';
  if (name === 'NoSuchBucket') console.error(`Bucket "${R2_BUCKET}" doesn't exist in this account. Create it in R2 first.`);
  else if (name === 'AccessDenied' || name === 'InvalidAccessKeyId' || name === 'SignatureDoesNotMatch' || err?.$metadata?.httpStatusCode === 403)
    console.error(`Cloudflare refused access (${name}). The token needs permission to read AND write R2 objects in "${R2_BUCKET}", and R2_ACCOUNT_ID must be the same account. ${help}`);
  else console.error(err);
  process.exit(1);
}

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
