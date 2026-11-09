// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // The live URL (used for link previews/canonical links). Update if the
  // Worker or account subdomain is renamed, or a Princeton address is set up.
  site: 'https://princeton.bakinbad.workers.dev',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
