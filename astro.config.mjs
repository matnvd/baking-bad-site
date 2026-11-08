// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Update once a custom domain (e.g. bakingbad.odus.princeton.edu) is approved.
  site: 'https://bakingbad.pages.dev',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
