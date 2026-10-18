import { useLocation } from 'react-router-dom';
import type { Project, ProjectI18n } from './data/projects';

// Три языка: русский по умолчанию на корне, английский и турецкий — /en и /tr.
export const LANGS = ['ru', 'en', 'tr'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'ru';

export const LANG_NAMES: Record<Lang, string> = { ru: 'Русский', en: 'English', tr: 'Türkçe' };
export const LANG_CODES: Record<Lang, string> = { ru: 'RU', en: 'EN', tr: 'TR' };
export const OG_LOCALES: Record<Lang, string> = { ru: 'ru_RU', en: 'en_US', tr: 'tr_TR' };

const UI = {
  ru: {
    contact: 'Обсудить проект',
    contactSr: 'в Telegram',
    home: 'на главную',
    viewCase: 'Смотреть кейс',
    visitSite: 'Открыть сайт',
    visitSiteSr: 'в новой вкладке',
    back: 'Назад к проектам',
    projects: 'Проекты',
    allProjects: 'Все проекты',
    selected: 'выбран',
    close: 'Закрыть',
    language: 'Язык',
    designCredit: 'Дизайн сайта',
    screenshots: 'Снимки сайта',
    openFull: 'Открыть в полном размере',
    homeTitle: 'Создание сайтов для бизнеса — студия SK DESIGN',
    homeDescription: 'Делаем сайты для ресторанов, застройщиков, клиник и IT-продуктов. 16 реальных работ — посмотрите кейсы и напишите нам в Telegram.',
    notFoundTitle: 'Страница не найдена | SK DESIGN',
    notFoundDescription: 'Такой страницы нет на сайте SK DESIGN.',
    notFoundHeading: 'Такой страницы нет',
    notFoundText: 'Возможно, ссылка устарела. Все 16 работ собраны на главной.',
    notFoundLink: 'К проектам',
  },
  en: {
    contact: 'Discuss a project',
    contactSr: 'on Telegram',
    home: 'home page',
    viewCase: 'View case',
    visitSite: 'Visit website',
    visitSiteSr: 'opens in a new tab',
    back: 'Back to projects',
    projects: 'Projects',
    allProjects: 'All projects',
    selected: 'selected',
    close: 'Close',
    language: 'Language',
    designCredit: 'Site design',
    screenshots: 'Website screenshots',
    openFull: 'Open full size',
    homeTitle: 'Website Design & Development Studio | SK DESIGN',
    homeDescription: 'We build websites for restaurants, real estate developers, clinics and tech products. Browse 16 real projects and message us on Telegram.',
    notFoundTitle: 'Page Not Found | SK DESIGN',
    notFoundDescription: 'This page does not exist on the SK DESIGN website.',
    notFoundHeading: 'This page doesn’t exist',
    notFoundText: 'The link may be outdated. All 16 projects are on the home page.',
    notFoundLink: 'To projects',
  },
  tr: {
    contact: 'Projeyi konuşalım',
    contactSr: 'Telegram’da',
    home: 'ana sayfa',
    viewCase: 'Projeyi incele',
    visitSite: 'Siteyi aç',
    visitSiteSr: 'yeni sekmede açılır',
    back: 'Projelere dön',
    projects: 'Projeler',
    allProjects: 'Tüm projeler',
    selected: 'seçili',
    close: 'Kapat',
    language: 'Dil',
    designCredit: 'Site tasarımı',
    screenshots: 'Site ekran görüntüleri',
    openFull: 'Tam boyutta aç',
    homeTitle: 'Web Sitesi Tasarım ve Geliştirme Stüdyosu | SK DESIGN',
    homeDescription: 'Restoranlar, gayrimenkul şirketleri, klinikler ve teknoloji ürünleri için web siteleri yapıyoruz. 16 gerçek projeyi inceleyin, Telegram’dan yazın.',
    notFoundTitle: 'Sayfa Bulunamadı | SK DESIGN',
    notFoundDescription: 'Bu sayfa SK DESIGN sitesinde yok.',
    notFoundHeading: 'Böyle bir sayfa yok',
    notFoundText: 'Bağlantı eskimiş olabilir. 16 projenin tamamı ana sayfada.',
    notFoundLink: 'Projelere',
  },
} satisfies Record<Lang, Record<string, string>>;

export type Dict = (typeof UI)['ru'];
export const dict = (lang: Lang): Dict => UI[lang];

// Подписи снимков из portfolio.json → alt на трёх языках.
const CAPTIONS: Record<string, { en: string; tr: string }> = {
  'Обложка проекта: первый экран или вступительная сцена': { en: 'first screen', tr: 'ilk ekran' },
  'Содержательный блок главной страницы': { en: 'home page section', tr: 'ana sayfa bölümü' },
  'Дополнительный блок главной страницы': { en: 'another home page section', tr: 'ana sayfanın başka bir bölümü' },
  'Главная страница целиком после прокрутки': { en: 'full home page', tr: 'ana sayfanın tamamı' },
  'Интерьер и рассказ о пространстве NAVAT': { en: 'interior and the story of the space', tr: 'iç mekân ve mekânın hikâyesi' },
  'Отдельная страница меню BUGU': { en: 'menu page', tr: 'menü sayfası' },
  'Поэтажная схема парковки ЖК Босфор': { en: 'floor-by-floor parking layout', tr: 'kat kat otopark şeması' },
  'Выбор литера в проекте «Патрики»': { en: 'building selection', tr: 'blok seçimi' },
  'Фильтры и список помещений проекта «Патрики»': { en: 'unit filters and list', tr: 'birim filtreleri ve listesi' },
};

export function captionText(caption: string, lang: Lang) {
  if (lang === 'ru') return caption.charAt(0).toLowerCase() + caption.slice(1);
  return CAPTIONS[caption]?.[lang] ?? '';
}

export const textOf = (p: Project, lang: Lang): ProjectI18n => p.i18n[lang];

export function langFromPath(pathname: string): Lang {
  const seg = pathname.split('/')[1];
  return (LANGS as readonly string[]).includes(seg) && seg !== DEFAULT_LANG ? (seg as Lang) : DEFAULT_LANG;
}

/** Путь без языкового префикса: /en/projects/x → /projects/x. */
export function stripLang(pathname: string) {
  const lang = langFromPath(pathname);
  if (lang === DEFAULT_LANG) return pathname || '/';
  const rest = pathname.slice(lang.length + 1);
  return rest === '' ? '/' : rest;
}

/** Локализованный путь: ('/projects/x', 'tr') → /tr/projects/x. */
export function localize(path: string, lang: Lang) {
  if (lang === DEFAULT_LANG) return path;
  return path === '/' ? `/${lang}` : `/${lang}${path}`;
}

export const isHomePath = (pathname: string) => stripLang(pathname) === '/';
export const slugFromPath = (pathname: string) => /^\/projects\/([^/]+)\/?$/.exec(stripLang(pathname))?.[1];

export function useLang(): Lang {
  return langFromPath(useLocation().pathname);
}
