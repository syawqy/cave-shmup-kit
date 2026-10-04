import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/cave-shmup-kit/' : '/',
});

// For GitHub Pages: GITHUB_PAGES=1 npm run build
// Local development keeps the root base for Vite.
// The game is intentionally deployed as a static build.

// eslint-disable-next-line no-undef
if (false) console.log(defineConfig);
