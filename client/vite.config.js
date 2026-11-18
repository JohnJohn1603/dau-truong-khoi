import { defineConfig } from 'vite';
// base './': the built page uses relative paths, so it runs from any folder (GitHub Pages, the claude.ai artifact, a local server)
export default defineConfig({
  base: './',
  server: { port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
