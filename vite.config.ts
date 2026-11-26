import { copyFileSync, cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const pagesBase = '/sendra-orbit/';

const proxy = {
  '/rpc': { target: 'https://arb1.arbitrum.io', changeOrigin: true },
  '/binance': {
    target: 'https://api.binance.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/binance/, ''),
  },
  '/coinbase': {
    target: 'https://api.exchange.coinbase.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/coinbase/, ''),
  },
  '/gecko': {
    target: 'https://api.geckoterminal.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/gecko/, ''),
  },
};

function tradingViewLibrary() {
  const root = resolve(fileURLToPath(new URL('../../web-frontend/charting_library', import.meta.url)));
  const types: Record<string, string> = {
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.html': 'text/html',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.wasm': 'application/wasm',
  };
  const serve = (req: { url?: string }, res: { setHeader: (name: string, value: string) => void; end?: () => void }, next: () => void) => {
    const raw = (req.url ?? '').split('?')[0].replace(/^\/sendra-orbit(?=\/)/, '');
    const prefix = '/charting_library/';
    if (!raw.startsWith(prefix)) return next();
    const rel = normalize(decodeURIComponent(raw.slice(prefix.length))).replace(/^(\.\.(\/|\\|$))+/, '');
    const file = join(root, rel);
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return next();
    res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(res as unknown as NodeJS.WritableStream);
  };
  return {
    name: 'tradingview-library',
    configureServer(server: { middlewares: { use: (fn: typeof serve) => void } }) {
      server.middlewares.use(serve);
    },
    configurePreviewServer(server: { middlewares: { use: (fn: typeof serve) => void } }) {
      server.middlewares.use(serve);
    },
    closeBundle() {
      if (existsSync(root)) cpSync(root, resolve('dist/charting_library'), { recursive: true });
    },
  };
}

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
  plugins: [react(), tradingViewLibrary(), spaFallback()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5200,
    strictPort: true,
    proxy,
  },
  preview: {
    host: true,
    port: 5200,
    strictPort: true,
    proxy,
  },
}));
