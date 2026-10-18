# SK DESIGN — сайт-портфолио

Портфолио студии SK DESIGN: белая галерея в духе [Obys](https://obys.agency/), 16 работ, отдельная страница кейса для каждой, полноценная мобильная версия, три языка (русский, English, Türkçe). Контакт: [@snj_krg](https://t.me/snj_krg).

Стек: React 19 + TypeScript + Vite 8, React Router 7, GSAP 3, шрифт Inter Variable (OFL, подключён локально из `@fontsource-variable/inter`). Без backend, форм и внешних сервисов.

## Запуск

```bash
npm ci            # зависимости строго по package-lock.json (Node ≥ 20.19)
npm run dev       # http://localhost:5173
npm run build     # typecheck + production build в dist/
npm run preview   # production preview: http://localhost:4173
```

Проверки:

```bash
npm run typecheck
npm run lint
npm run qa        # браузерная приёмка против запущенного preview → qa/results.json, qa/screens/
npm run record    # запись движения → qa/video/*.mp4 (нужен ffmpeg)
npm run media     # пересобрать public/media и данные из portfolio.json (--clean — с нуля)
```

## Деплой на Vercel

Проект готов к импорту в Vercel как есть: `vercel.json` задаёт `framework: vite`, `npm ci`, `npm run build`, `outputDirectory: dist`.

1. Vercel → Add New → Project → импортировать репозиторий. Настройки сборки подтянутся из `vercel.json`.
2. Когда будет домен, в Settings → Environment Variables задать `VITE_SITE_URL=https://ваш-домен` (без слеша в конце) и пересобрать. Тогда появятся canonical, hreflang, `og:url`, `sitemap.xml` и `robots.txt` с разрешением индексации. До этого сборка закрыта от индексации (`robots: noindex`, `Disallow: /`).
3. Либо из терминала: `npx vercel` (preview) и `npx vercel --prod`.

Маршруты: `/`, `/projects/<slug>` (русский), `/en`, `/en/projects/<slug>`, `/tr`, `/tr/projects/<slug>`. Сборка создаёт для каждого из 51 адреса свой HTML с `<html lang>`, title, description и Open Graph на нужном языке (`dist/en/projects/bugu.html` и т. д.). Поисковики и превью ссылок видят правильные данные без выполнения JavaScript, прямой URL и refresh работают. `cleanUrls` в `vercel.json` отдаёт эти файлы по адресам без `.html`. Любой другой адрес получает `dist/404.html` со статусом 404. Хэшированные `/assets/*` кэшируются на год, `/media/*` — на неделю.

Для другого хостинга: отдавать `<путь>.html` для адреса без расширения, иначе `404.html` (nginx: `try_files $uri $uri.html =404; error_page 404 /404.html;`).

## Устройство

- `src/components/GalleryScene.tsx` — бесконечная вертикальная лента. Один непрерывный параметр положения; wheel/trackpad/touch/клавиатура меняют только цель, положение догоняет её экспоненциальным затуханием в одном `requestAnimationFrame`. Из него вычисляются transform, ч/б фильтр, прозрачность и выбранный проект.
- `src/components/ProjectIndex.tsx` — список работ в виде бесконечного кольца, движется от того же параметра положения.
- `src/components/CaseStrip.tsx` — лента кейса как у Obys: на desktop правая половина экрана, бесконечный цикл снимков без подложек с инерционной прокруткой, снимок на центральной линии крупнее соседей; на телефоне снимки в обычном потоке.
- `src/components/LangSwitch.tsx`, `src/i18n.ts` — языки, выпадающий список в закреплённой шапке, тексты интерфейса, локализованные пути.
- `src/lib/transition.ts` — общий переход превью ↔ кейс (FLIP с реальным кадром, снимается при любом прерывании).
- `src/lib/galleryStore.ts` — положение галереи для возврата из кейса (sessionStorage).
- `src/pages/ProjectPage.tsx` — кейс: страница неподвижна, слева на центральной линии название, категории, описание и «Открыть сайт ↗», внизу «Назад к проектам»; на телефоне одна колонка.
- `scripts/prepare-media.mjs` — WebP/AVIF-варианты 480/960/1280 px (без увеличения исходников), обрезка логотипа по alpha, `src/data/projects.generated.json` с текстами на трёх языках.
- `vite.config.ts` — генерация HTML для каждой страницы и языка, `404.html`, `sitemap.xml`, `robots.txt`.
- `scripts/qa.mjs`, `scripts/record.mjs` — браузерная приёмка и запись движения.

## Контент

- `portfolio.json` — 16 работ: названия, категории, описания, ссылки, снимки; `site-config.json` — бренд, контакт, порядок галереи.
- `content/translations.json` — английские и турецкие тексты каждой работы, SEO-заголовки на трёх языках и уточнения к русским текстам. Тексты интерфейса и заголовки главной — в `src/i18n.ts` (заголовки главной продублированы в `vite.config.ts` для статического HTML).
- `projects/<id>/screenshots/` — исходные снимки сайтов, `assets/brand/` — логотип. Из них `npm run media` собирает `public/media/` и `src/data/projects.generated.json`.
- Чтобы изменить работу, перевод или порядок: правка `portfolio.json` / `content/translations.json` / `site-config.json` → `npm run media` → `npm run build`. Скрипт остановится, если у работы не хватает перевода.

Отчёт о проверках — [QA.md](QA.md).

