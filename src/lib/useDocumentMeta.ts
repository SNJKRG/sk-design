import { useEffect } from 'react';
import { LANGS, OG_LOCALES, localize, type Lang } from '../i18n';

// Базовый домен задаётся VITE_SITE_URL при сборке. Пока он не задан,
// canonical и hreflang не выводятся, а страницы закрыты от индексации.
const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

function upsert(selector: string, tag: 'meta' | 'link', attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = document.createElement(tag);
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
}

/** path — путь без языкового префикса (/ или /projects/slug); null для 404. */
export function useDocumentMeta(title: string, description: string, path: string | null, lang: Lang) {
  useEffect(() => {
    document.title = title;
    document.documentElement.lang = lang;
    upsert('meta[name="description"]', 'meta', { name: 'description', content: description });
    upsert('meta[property="og:title"]', 'meta', { property: 'og:title', content: title });
    upsert('meta[property="og:description"]', 'meta', { property: 'og:description', content: description });
    upsert('meta[property="og:locale"]', 'meta', { property: 'og:locale', content: OG_LOCALES[lang] });
    if (!SITE_URL) return;
    document.head.querySelector('meta[name="robots"]')?.setAttribute('content', path ? 'index, follow' : 'noindex');
    if (!path) return;
    upsert('link[rel="canonical"]', 'link', { rel: 'canonical', href: SITE_URL + localize(path, lang) });
    for (const l of LANGS) upsert(`link[rel="alternate"][hreflang="${l}"]`, 'link', { rel: 'alternate', hreflang: l, href: SITE_URL + localize(path, l) });
    upsert('link[rel="alternate"][hreflang="x-default"]', 'link', { rel: 'alternate', hreflang: 'x-default', href: SITE_URL + path });
  }, [title, description, path, lang]);
}
