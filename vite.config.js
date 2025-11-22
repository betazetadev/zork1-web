import { defineConfig } from 'vite';

export default defineConfig({
  // For GitHub Pages: set base to '/<repo-name>/' or '/' for user pages
  // Update this to match your GitHub repo name
  base: '/zork1-web/',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    open: true,
  },
});
