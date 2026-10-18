import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

type Lang = 'ru' | 'en' | 'tr';
const LANGS: Lang[] = ['ru', 'en', 'tr'];
const OG: Record<Lang, string> = { ru: 'ru_RU', en: 'en_US', tr: 'tr_TR' };
// Заголовки главной и 404 совпадают с src/i18n.ts.
const HOME: Record<Lang, [string, string]> = {
  ru: ['Создание сайтов для бизнеса | Студия SK DESIGN', 'Делаем сайты для ресторанов, застройщиков, клиник и IT-продуктов. 16 реальных работ: посмотрите кейсы и напишите нам в Telegram.'],
  en: ['Website Design & Development Studio | SK DESIGN', 'We build websites for restaurants, real estate developers, clinics and tech products. Browse 16 real projects and message us on Telegram.'],
  tr: ['Web Sitesi Tasarım ve Geliştirme Stüdyosu | SK DESIGN', 'Restoranlar, gayrimenkul şirketleri, klinikler ve teknoloji ürünleri için web siteleri yapıyoruz. 16 gerçek projeyi inceleyin, Telegram’dan yazın.'],
};
const NOT_FOUND: [string, string] = ['Страница не найдена | SK DESIGN', 'Такой страницы нет на сайте SK DESIGN.'];

const localize = (p: string, lang: Lang) => (lang === 'ru' ? p : p === '/' ? `/${lang}` : `/${lang}${p}`);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

type Page = { lang: Lang; title: string; description: string; path: string | null };

function renderHead(html: string, page: Page, siteUrl: string) {
  const { lang, title, description, path: p } = page;
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="SK DESIGN" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:locale" content="${OG[lang]}" />`,
  ];
  if (siteUrl && p) {
    tags.push(`<link rel="canonical" href="${siteUrl}${localize(p, lang)}" />`);
    for (const l of LANGS) tags.push(`<link rel="alternate" hreflang="${l}" href="${siteUrl}${localize(p, l)}" />`);
    tags.push(`<link rel="alternate" hreflang="x-default" href="${siteUrl}${p}" />`);
    tags.push(`<meta property="og:url" content="${siteUrl}${localize(p, lang)}" />`);
  }
  const robots = siteUrl && p ? 'index, follow' : 'noindex, nofollow';
  // Предзагрузка обложки SF Diamonds нужна только главной.
  if (p !== '/') html = html.replace(/\s*<link rel="preload" as="image"[^>]*>/, '');
  return html
    .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>\n    ${tags.join('\n    ')}`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`)
    .replace(/<meta name="robots" content="[^"]*" \/>/, `<meta name="robots" content="${robots}" />`);
}

// Для каждого маршрута и языка — свой HTML с title, description, hreflang:
// поисковики и превью ссылок видят правильные данные без выполнения JS.
// dist/404.html отдаёт статус 404 для неизвестных адресов (Vercel).
function seoPages(siteUrl: string): Plugin {
  let outDir = 'dist';
  return {
    name: 'sk-seo-pages',
    apply: 'build',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
    },
    async closeBundle() {
      const template = await readFile(path.join(outDir, 'index.html'), 'utf8');
      const data = JSON.parse(await readFile(path.resolve('src/data/projects.generated.json'), 'utf8')) as {
        projects: { slug: string; route: string; i18n: Record<Lang, { seoTitle: string; summary: string }> }[];
      };
      const pages: [string, Page][] = [];
      for (const lang of LANGS) {
        pages.push([lang === 'ru' ? 'index.html' : `${lang}.html`, { lang, title: HOME[lang][0], description: HOME[lang][1], path: '/' }]);
        for (const p of data.projects) {
          const file = `${lang === 'ru' ? '' : `${lang}/`}projects/${p.slug}.html`;
          pages.push([file, { lang, title: p.i18n[lang].seoTitle, description: p.i18n[lang].summary, path: p.route }]);
        }
      }
      pages.push(['404.html', { lang: 'ru', title: NOT_FOUND[0], description: NOT_FOUND[1], path: null }]);
      for (const [file, page] of pages) {
        const target = path.join(outDir, file);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, renderHead(template, page, siteUrl));
      }
      // sitemap.xml — только когда известен домен.
      if (siteUrl) {
        const urls = pages.filter(([, pg]) => pg.path).map(([, pg]) => `  <url><loc>${siteUrl}${localize(pg.path!, pg.lang)}</loc></url>`);
        await writeFile(path.join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
        await writeFile(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
      } else {
        await writeFile(path.join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = (env.VITE_SITE_URL ?? '').replace(/\/$/, '');
  return {
    plugins: [react(), seoPages(siteUrl)],
    server: { host: true, port: 5173 },
    preview: { host: true, port: 4173 },
    build: { target: 'es2020', assetsInlineLimit: 0 },
  };
});
