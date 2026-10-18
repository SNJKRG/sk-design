# SK DESIGN — сайт-портфолио

Портфолио студии SK DESIGN: белая галерея в духе [Obys](https://obys.agency/), 16 работ, отдельная страница кейса для каждой, полноценная мобильная версия. Контакт: [@snj_krg](https://t.me/snj_krg).

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
2. Когда будет домен, в Settings → Environment Variables задать `VITE_SITE_URL=https://ваш-домен` (без слеша в конце) и пересобрать. До этого сборка закрыта от индексации (`robots: noindex`) и не выводит canonical.
3. Либо из терминала: `npx vercel` (preview) и `npx vercel --prod`.

Маршрутизация: `vercel.json` переписывает только 16 существующих `/projects/:slug` на `index.html` (прямой URL и refresh работают). Любой другой адрес получает `dist/404.html` — копию приложения, которая показывает страницу «Такой страницы нет», со статусом 404. Хэшированные `/assets/*` кэшируются на год, `/media/*` — на неделю. `vercel.json` генерирует `npm run media` из списка работ.

Для другого хостинга нужен тот же SPA fallback: `/projects/<slug>` → `/index.html`, остальное → `404.html` (Netlify: `_redirects`, nginx: `try_files $uri /index.html`).

## Устройство

- `src/components/GalleryScene.tsx` — бесконечная вертикальная лента. Один непрерывный параметр положения; wheel/trackpad/touch/клавиатура меняют только цель, положение догоняет её экспоненциальным затуханием в одном `requestAnimationFrame`. Из него вычисляются transform, ч/б фильтр, прозрачность и выбранный проект.
- `src/components/ProjectIndex.tsx` — список работ в виде бесконечного кольца, движется от того же параметра положения.
- `src/lib/transition.ts` — общий переход превью ↔ кейс (FLIP с реальным кадром, снимается при любом прерывании).
- `src/lib/galleryStore.ts` — положение галереи для возврата из кейса (sessionStorage).
- `src/pages/ProjectPage.tsx` — кейс: компактная информация слева, вертикальная лента снимков справа; на телефоне одна колонка.
- `scripts/prepare-media.mjs` — WebP/AVIF-варианты 480/960/1280 px (без увеличения исходников), обрезка логотипа по alpha, `src/data/projects.generated.json`, `vercel.json`.
- `scripts/qa.mjs`, `scripts/record.mjs` — браузерная приёмка и запись движения.

## Контент

- `portfolio.json` — 16 работ: названия, категории, описания, ссылки, снимки; `site-config.json` — бренд, контакт, порядок галереи.
- `projects/<id>/screenshots/` — исходные снимки сайтов, `assets/brand/` — логотип. Из них `npm run media` собирает `public/media/` и `src/data/projects.generated.json`.
- Чтобы изменить работу или порядок: правка `portfolio.json` / `site-config.json` → `npm run media` → `npm run build`.

Отчёт о проверках — [QA.md](QA.md).

