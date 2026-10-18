import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Индексация и canonical включаются только при заданном VITE_SITE_URL.
function seo(siteUrl: string): Plugin {
  return {
    name: 'sk-seo',
    transformIndexHtml(html) {
      if (!siteUrl) return html;
      return html
        .replace('<meta name="robots" content="noindex, nofollow" />', '<meta name="robots" content="index, follow" />')
        .replace('</title>', `</title>\n    <link rel="canonical" href="${siteUrl}/" />`);
    },
  };
}

// dist/404.html = index.html: хостинг отдаёт настоящий статус 404 для
// неизвестных адресов, а приложение показывает свою страницу «Такой страницы нет».
function notFoundPage(): Plugin {
  let outDir = 'dist';
  return {
    name: 'sk-404',
    apply: 'build',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
    },
    async closeBundle() {
      await copyFile(path.join(outDir, 'index.html'), path.join(outDir, '404.html'));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = (env.VITE_SITE_URL ?? '').replace(/\/$/, '');
  return {
    plugins: [react(), seo(siteUrl), notFoundPage()],
    server: { host: true, port: 5173 },
    preview: { host: true, port: 4173 },
    build: { target: 'es2020', assetsInlineLimit: 0 },
  };
});
