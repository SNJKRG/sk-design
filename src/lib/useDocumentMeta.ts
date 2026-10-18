import { useEffect } from 'react';

// Базовый домен задаётся VITE_SITE_URL при сборке. Пока он не задан,
// canonical не выводится, а index.html закрывает preview от индексации.
const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

function setMeta(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

export function useDocumentMeta(title: string, description: string, path: string) {
  useEffect(() => {
    document.title = title;
    setMeta('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }), 'content', description);
    if (SITE_URL) {
      setMeta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', SITE_URL + path);
      document.head.querySelector('meta[name="robots"]')?.setAttribute('content', 'index, follow');
    }
  }, [title, description, path]);
}
