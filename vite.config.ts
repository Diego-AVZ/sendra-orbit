import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const pagesBase = '/sendra-orbit/';

function spaFallback() {
  return {
    name: 'github-pages-spa-fallback',
    apply: 'build' as const,
    closeBundle() {
      const indexPath = resolve('dist/index.html');
      if (existsSync(indexPath)) copyFileSync(indexPath, resolve('dist/404.html'));
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? pagesBase : '/',
  plugins: [react(), spaFallback()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5200,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 5200,
    strictPort: true,
  },
}));
