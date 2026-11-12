// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // The live URL (used for link previews/canonical links). OIT points this
  // Princeton address at the Cloudflare Pages project with a CNAME record.
  site: 'https://bakingbad.odus.princeton.edu',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
