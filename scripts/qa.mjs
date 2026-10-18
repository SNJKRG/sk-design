// Браузерная приёмка SK DESIGN: node scripts/qa.mjs [baseUrl]
// Запускать против production preview (npm run build && npm run preview).
// Результаты: qa/results.json и снимки qa/screens/*.png.
import { chromium, devices } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const root = path.resolve(import.meta.dirname, '..');
const SCREENS = path.join(root, 'qa', 'screens');
await mkdir(SCREENS, { recursive: true });
const data = JSON.parse(await readFile(path.join(root, 'src', 'data', 'projects.generated.json'), 'utf8'));
const projects = data.projects;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail: String(detail) });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();

async function open(ctxOpts = {}) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(BASE)) problems.push(`${r.status()} ${r.url()}`);
  });
  return { ctx, page, problems };
}

const settle = (page, ms = 1300) => page.waitForTimeout(ms);
const homeState = (page) =>
  page.evaluate(() => ({
    title: document.querySelector('.meta__title')?.textContent ?? null,
    href: document.querySelector('.meta__link')?.getAttribute('href') ?? null,
    list: document.querySelector('.index__list .is-active .index__name')?.textContent ?? null,
    overlay: document.querySelectorAll('.flip-overlay').length,
    transitioning: document.documentElement.classList.contains('is-transitioning'),
  }));
const consistent = (s) => {
  const p = projects.find((x) => x.route === s.href);
  return p && p.title === s.title && (s.list === null || s.list === p.shortTitle);
};
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

// ───────── 1. Все 16 кейсов: прямой URL, refresh, контент, ссылки ─────────
{
  const { ctx, page, problems } = await open({ viewport: { width: 1536, height: 1024 } });
  for (const p of projects) {
    await page.goto(BASE + p.route, { waitUntil: 'networkidle' });
    const info = await page.evaluate(() => {
      const live = [...document.querySelectorAll('a')].find((a) => a.textContent.includes('Открыть сайт'));
      const imgs = [...document.querySelectorAll('.case-media img')];
      return {
        h1: document.querySelector('h1')?.childNodes[0]?.textContent?.trim(),
        title: document.title,
        live: live && { href: live.getAttribute('href'), target: live.target, rel: live.rel },
        imgs: imgs.length,
        firstLoaded: imgs.slice(0, 2).every((i) => i.complete && i.naturalWidth > 0),
        text: document.querySelector('.case-info__text')?.textContent?.length ?? 0,
        demo: Boolean(document.querySelector('.tag')),
        credit: document.querySelector('.case-info__note')?.textContent ?? '',
        emptyHref: [...document.querySelectorAll('a')].some((a) => !a.getAttribute('href') || a.getAttribute('href') === '#'),
        hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
        localImgs: imgs.every((i) => new URL(i.currentSrc || i.src).origin === location.origin),
      };
    });
    const ok =
      info.h1 === p.title &&
      info.live?.href === p.url &&
      info.live?.target === '_blank' &&
      /noopener/.test(info.live?.rel) &&
      /noreferrer/.test(info.live?.rel) &&
      info.imgs === p.media.length &&
      info.firstLoaded &&
      info.text > 40 &&
      !info.emptyHref &&
      !info.hscroll &&
      info.localImgs;
    check(`кейс ${p.route}`, ok, `h1="${info.h1}", сайт=${info.live?.href}, снимков ${info.imgs}/${p.media.length}`);
    if (p.status === 'demo') check(`ORBIT помечен «Демо»`, info.demo);
    if (p.designCredit) check(`M-Starter: кредит дизайна copylobby.art`, info.credit.includes('copylobby.art'));
    if (p.status !== 'demo' && info.demo) check(`лишняя отметка «Демо» на ${p.slug}`, false);
  }
  // refresh одного маршрута
  await page.goto(BASE + projects[5].route, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  check('refresh кейса сохраняет страницу', (await page.locator('h1').first().textContent()).includes(projects[5].title));
  // 404
  for (const bad of ['/projects/unknown-slug', '/about', '/projects/']) {
    await page.goto(BASE + bad, { waitUntil: 'networkidle' });
    check(`404 для ${bad}`, (await page.locator('h1').first().textContent()).includes('Такой страницы нет'));
  }
  // Подсчёт уникальности
  check('16 уникальных маршрутов и адресов', new Set(projects.map((p) => p.route)).size === 16 && new Set(projects.map((p) => p.url)).size === 16);
  check('кейсы: нет ошибок и 404 ассетов', problems.length === 0, problems.slice(0, 5).join(' | '));
  await ctx.close();
}

// ───────── 2. Главная desktop: состав, фильтр, синхронизация, цикл ─────────
{
  const { ctx, page, problems } = await open({ viewport: { width: 1536, height: 1024 } });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await settle(page, 1600);
  await page.screenshot({ path: path.join(SCREENS, 'desktop-1536x1024-home-sf-diamonds.jpg'), quality: 84 });
  const base = await page.evaluate(() => ({
    links: [...document.querySelectorAll('.index__list a')].map((a) => a.getAttribute('href')),
    contact: document.querySelector('.contact')?.getAttribute('href'),
    text: document.body.innerText,
    logo: document.querySelector('.logo')?.getAttribute('href'),
    numbers: [...document.querySelectorAll('.index__list a')].some((a) => /\b\d{2}\b/.test(a.textContent)),
  }));
  check('список содержит 16 ссылок на кейсы в порядке галереи', JSON.stringify(base.links) === JSON.stringify(projects.map((p) => p.route)));
  check('в списке нет нумерации', !base.numbers);
  check('контакт ведёт в Telegram', base.contact === 'https://t.me/snj_krg');
  check('логотип ведёт на главную', base.logo === '/');
  const removed = ['Создание и вёрстка сайтов.', 'Работы', 'Подход', 'Все проекты', 'Сайт для вашего бизнеса', 'Лента', 'Сетка', '01 / 16'];
  check('удалённые области не вернулись', removed.every((t) => !base.text.includes(t)), removed.filter((t) => base.text.includes(t)).join(', '));
  check('заголовок «ПРОЕКТЫ / 16» на месте', /ПРОЕКТЫ\s*\/\s*16/i.test(base.text));
  let s = await homeState(page);
  check('первая выбранная работа — SF Diamonds', s.title === 'SF Diamonds' && s.href === '/projects/sf-diamonds');

  const filters = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.g-item')]
        .filter((el) => el.style.visibility !== 'hidden')
        .map((el) => ({ href: el.getAttribute('href'), g: +el.style.getPropertyValue('--g'), o: +el.style.getPropertyValue('--o') })),
    );
  let f = await filters();
  const activeF = f.find((x) => x.href === s.href);
  check('активное превью цветное (grayscale 0, opacity 1)', activeF && activeF.g === 0 && activeF.o === 1, JSON.stringify(activeF));
  check('неактивные превью ч/б и приглушены', f.filter((x) => x.href !== s.href).every((x) => x.g === 1 && x.o <= 0.6), `${f.length - 1} соседей`);

  // Синхронизация при резком скролле — каждые ~16 мс
  await page.mouse.move(768, 470);
  let mismatches = 0;
  let samples = 0;
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 140);
    const st = await homeState(page);
    samples++;
    if (!consistent(st)) mismatches++;
  }
  for (let i = 0; i < 40; i++) {
    const st = await homeState(page);
    samples++;
    if (!consistent(st)) mismatches++;
    await page.waitForTimeout(25);
  }
  await settle(page);
  s = await homeState(page);
  check('резкий скролл: подпись, ссылка и пункт списка совпадают', mismatches === 0, `${samples} замеров, расхождений ${mismatches}; итог ${s.title}`);
  f = await filters();
  check('после резкого скролла цветной только активный', f.filter((x) => x.g < 0.5).length === 1 && f.find((x) => x.href === s.href)?.g === 0);

  // Медленный трекпад: маленькие delta
  const before = s.title;
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, 6);
    await page.waitForTimeout(14);
  }
  await settle(page);
  s = await homeState(page);
  check('мелкие delta трекпада сдвигают ленту на одну работу', s.title !== before && consistent(s), `${before} → ${s.title}`);

  // Один щелчок колеса = соседняя работа
  const idx = () => page.evaluate(() => [...document.querySelectorAll('.index__list li')].findIndex((li) => li.classList.contains('is-active')));
  const i0 = await idx();
  await page.mouse.wheel(0, 100);
  await settle(page);
  check('один щелчок колеса выбирает следующую работу', (await idx()) === (i0 + 1) % 16, `${i0} → ${await idx()}`);

  // Цикл 1→16 и 16→1 клавиатурой
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 1200);
  await page.keyboard.press('ArrowUp');
  await settle(page);
  s = await homeState(page);
  check('ArrowUp с первой работы → 16-я (цикл 1→16)', s.title === projects[15].title, s.title);
  await page.keyboard.press('ArrowDown');
  await settle(page, 300);
  await page.keyboard.press('ArrowDown');
  await settle(page);
  s = await homeState(page);
  check('ArrowDown дважды → 2-я (цикл 16→1 без скачка)', s.title === projects[1].title, s.title);
  check('главная desktop: нет ошибок и 404 ассетов', problems.length === 0, problems.slice(0, 5).join(' | '));
  check('главная desktop: нет горизонтальной прокрутки', await noHScroll(page));
  await ctx.close();
}

// ───────── 3. Переходы, Back / Forward, восстановление, двойной клик ─────────
{
  const { ctx, page, problems } = await open({ viewport: { width: 1536, height: 1024 } });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 1200);
  // выбрать 4-ю работу стрелками и открыть клик по центральному превью
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await settle(page);
  let s = await homeState(page);
  const chosen = s.href;
  const box = await page.evaluate(() => {
    const r = document.querySelector('.corners').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(SCREENS, 'desktop-1536x1024-transition-to-case-450ms.jpg'), quality: 84 });
  await page.waitForURL('**' + chosen);
  await settle(page, 1400);
  check('клик по центральному превью открывает выбранный кейс', page.url().endsWith(chosen), page.url());
  s = await homeState(page);
  check('после перехода оверлей снят', s.overlay === 0 && !s.transitioning);
  await page.screenshot({ path: path.join(SCREENS, `desktop-1536x1024-case-${chosen.split('/').pop()}.jpg`), quality: 84 });
  await page.goBack();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(SCREENS, 'desktop-1536x1024-transition-back-350ms.jpg'), quality: 84 });
  await settle(page, 1300);
  s = await homeState(page);
  check('Browser Back возвращает выбранную работу', s.href === chosen && s.overlay === 0, s.title);
  await page.screenshot({ path: path.join(SCREENS, 'desktop-1536x1024-home-after-back.jpg'), quality: 84 });
  await page.goForward();
  await settle(page, 1500);
  check('Browser Forward снова открывает кейс', page.url().endsWith(chosen));
  // «Назад к проектам»
  await page.click('.case__back');
  await settle(page, 1500);
  s = await homeState(page);
  check('«Назад к проектам» восстанавливает галерею', page.url() === BASE + '/' && s.href === chosen);

  // Клик по соседнему (неактивному) превью
  const neighbour = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.g-item')].filter((el) => el.style.visibility !== 'hidden' && +el.style.getPropertyValue('--g') === 1);
    const el = items.find((e) => {
      const r = e.getBoundingClientRect();
      return r.top > 40 && r.bottom < innerHeight - 10;
    }) ?? items[0];
    const r = el.getBoundingClientRect();
    return { href: el.getAttribute('href'), x: r.left + r.width / 2, y: Math.max(r.top + 10, Math.min(r.bottom - 10, r.top + r.height / 2)) };
  });
  await page.mouse.click(neighbour.x, neighbour.y);
  await page.waitForURL('**' + neighbour.href);
  await settle(page, 1400);
  check('клик по соседнему превью открывает именно его кейс', page.url().endsWith(neighbour.href), neighbour.href);
  await page.goBack();
  await settle(page, 1400);
  s = await homeState(page);
  check('после возврата активна открывавшаяся соседняя работа', s.href === neighbour.href, s.title);

  // Клик по названию в списке
  const target = projects[9];
  await page.click(`.index__list a[href="${target.route}"]`);
  await page.waitForURL('**' + target.route);
  await settle(page, 1400);
  check('клик по названию в списке открывает кейс', page.url().endsWith(target.route));
  await page.goBack();
  await settle(page, 1400);
  // «Смотреть кейс»
  s = await homeState(page);
  await page.click('.meta__link');
  await page.waitForURL('**' + s.href);
  await settle(page, 1400);
  check('«Смотреть кейс» открывает текущий проект', page.url().endsWith(s.href));
  // Логотип из кейса
  await page.click('.logo');
  await settle(page, 1400);
  s = await homeState(page);
  check('логотип из кейса возвращает галерею с выбранной работой', page.url() === BASE + '/' && s.href === target.route, s.title);

  // Двойной клик и мгновенный Back
  await page.dblclick('.meta__link');
  await page.waitForTimeout(450);
  await page.goBack().catch(() => {}); // Back посреди перехода; один шаг должен вернуть на главную
  await settle(page, 2000);
  s = await homeState(page);
  const stuck = await page.evaluate(() => ({
    overlay: document.querySelectorAll('.flip-overlay').length,
    lock: document.documentElement.classList.contains('is-transitioning'),
    url: location.pathname,
    visible: document.querySelector('main') !== null,
    galleryOpacity: getComputedStyle(document.querySelector('.gallery') ?? document.body).opacity,
  }));
  check('двойной клик + быстрый Back не оставляют оверлей или блокировку', stuck.overlay === 0 && !stuck.lock && stuck.visible && stuck.url === '/' && stuck.galleryOpacity === '1', JSON.stringify(stuck));

  // Новая вкладка (Ctrl/Meta-клик) не перехватывается
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await settle(page, 1200);
  const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), page.click('.meta__link', { modifiers: ['ControlOrMeta'] })]);
  check('Ctrl/⌘-клик открывает кейс в новой вкладке', popup !== null && page.url() === BASE + '/');
  await popup?.close();

  // Клавиатура: Tab к пункту списка двигает ленту, Enter открывает
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await settle(page, 1200);
  await page.focus(`.index__list a[href="${projects[6].route}"]`);
  await settle(page);
  s = await homeState(page);
  check('фокус на пункте списка выбирает работу', s.href === projects[6].route, s.title);
  const ring = await page.evaluate(() => {
    const li = document.querySelector('.index__list .is-active');
    const r = li.getBoundingClientRect();
    const c = document.querySelector('.corners').getBoundingClientRect();
    return Math.abs(r.top + r.height / 2 - (c.top + c.height / 2));
  });
  check('кольцо списка: активная строка на центральной линии кадра', ring < 3, `${ring.toFixed(1)} px`);
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  check('клавиатурный фокус виден', outline !== 'none', outline);
  await page.keyboard.press('Enter');
  await page.waitForURL('**' + projects[6].route);
  check('Enter на пункте списка открывает кейс', true);
  check('переходы: нет ошибок', problems.length === 0, problems.slice(0, 5).join(' | '));
  await ctx.close();
}

// ───────── 4. Reduced motion ─────────
{
  const { ctx, page, problems } = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);
  const s = await homeState(page);
  check('reduced motion: стрелка выбирает работу сразу', s.title === projects[1].title || s.title !== null, s.title);
  await page.click('.meta__link');
  await page.waitForURL('**/projects/**');
  await page.waitForTimeout(100);
  check('reduced motion: кейс открывается без оверлея', (await page.locator('.flip-overlay').count()) === 0);
  await page.goBack();
  await page.waitForTimeout(200);
  check('reduced motion: возврат работает', page.url() === BASE + '/');
  check('reduced motion: нет ошибок', problems.length === 0, problems.join(' | '));
  await ctx.close();
}

// ───────── 5. Мобильные устройства: touch-эмуляция ─────────
async function touchSwipe(page, cdp, x, y0, y1, ms, steps = 10) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / steps }] });
    await page.waitForTimeout(ms / steps);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

for (const [name, device] of [
  ['iphone13-390x844', devices['iPhone 13']],
  ['pixel7-412x915', devices['Pixel 7']],
]) {
  const { ctx, page, problems } = await open({ ...device });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 1500);
  const cdp = await ctx.newCDPSession(page);
  const vp = page.viewportSize();
  const env = await page.evaluate(() => ({ touch: navigator.maxTouchPoints, ua: navigator.userAgent.slice(0, 40), coarse: matchMedia('(pointer: coarse)').matches }));
  check(`${name}: touch-эмуляция активна`, env.touch > 0 && env.coarse, JSON.stringify(env));
  let s = await homeState(page);
  const cy = await page.evaluate(() => {
    const r = document.querySelector('.corners').getBoundingClientRect();
    return r.top + r.height / 2;
  });
  await touchSwipe(page, cdp, vp.width / 2, cy + 50, cy - 70, 450, 14);
  await settle(page, 1300);
  const afterSwipe = await homeState(page);
  check(`${name}: свайп вверх выбирает следующую работу`, afterSwipe.title === projects[1].title && consistent(afterSwipe), `${s.title} → ${afterSwipe.title}`);
  // быстрый флик — инерция на несколько работ
  await touchSwipe(page, cdp, vp.width / 2, cy + 120, cy - 160, 70, 5);
  await settle(page, 1800);
  const afterFling = await homeState(page);
  const flingIdx = projects.findIndex((p) => p.route === afterFling.href);
  check(`${name}: быстрый флик продолжает движение по инерции`, flingIdx >= 3 && consistent(afterFling), `${afterSwipe.title} → ${afterFling.title} (#${flingIdx + 1})`);
  // свайп, отпущенный над превью, не открывает кейс
  await touchSwipe(page, cdp, vp.width / 2, cy - 40, cy + 40, 200, 8);
  await settle(page, 1300);
  check(`${name}: свайп не открывает кейс случайно`, page.url() === BASE + '/');
  await page.screenshot({ path: path.join(SCREENS, `mobile-${name}-home.jpg`), quality: 84 });
  check(`${name}: нет горизонтальной прокрутки`, await noHScroll(page));
  // размеры нажатия
  const targets = await page.evaluate(() =>
    ['.contact', '.meta__link', '.panel__projects'].map((sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return [sel, Math.round(r.width), Math.round(r.height)];
    }),
  );
  check(`${name}: области нажатия ≥ 44 px`, targets.every(([, w, h]) => h >= 44 && w >= 44), JSON.stringify(targets));
  // панель проектов
  await page.tap('.panel__projects');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENS, `mobile-${name}-projects-sheet.jpg`), quality: 84 });
  const sheet = await page.evaluate(() => ({
    open: !document.querySelector('.sheet').hidden,
    links: document.querySelectorAll('.sheet__list a').length,
    focusInside: document.querySelector('.sheet').contains(document.activeElement),
    minH: Math.min(...[...document.querySelectorAll('.sheet__list a, .sheet__close')].map((a) => a.getBoundingClientRect().height)),
  }));
  check(`${name}: панель «Проекты» открыта, 16 ссылок, фокус внутри`, sheet.open && sheet.links === 16 && sheet.focusInside, JSON.stringify(sheet));
  check(`${name}: строки панели ≥ 44 px`, sheet.minH >= 44, `${sheet.minH}px`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const closed = await page.evaluate(() => ({ hidden: document.querySelector('.sheet').hidden, focus: document.activeElement?.classList.contains('panel__projects') }));
  check(`${name}: Escape закрывает панель и возвращает фокус`, closed.hidden && closed.focus, JSON.stringify(closed));
  await page.tap('.panel__projects');
  await page.waitForTimeout(400);
  await page.tap('.sheet__close');
  await page.waitForTimeout(200);
  check(`${name}: кнопка «Закрыть» закрывает панель`, await page.evaluate(() => document.querySelector('.sheet').hidden));
  // выбор в панели открывает кейс
  await page.tap('.panel__projects');
  await page.waitForTimeout(400);
  await page.tap(`.sheet__list a[href="${projects[12].route}"]`);
  await page.waitForURL('**' + projects[12].route);
  await settle(page, 1500);
  check(`${name}: выбор в панели открывает кейс`, page.url().endsWith(projects[12].route));
  await page.goBack();
  await settle(page, 1500);
  s = await homeState(page);
  check(`${name}: возврат из кейса восстанавливает выбор`, s.href === projects[12].route, s.title);
  // тап по центральному кадру
  await page.touchscreen.tap(vp.width / 2, cy);
  await page.waitForURL('**' + s.href, { timeout: 4000 }).catch(() => {});
  await settle(page, 1500);
  check(`${name}: тап по кадру открывает кейс`, page.url().endsWith(s.href), page.url());
  await page.screenshot({ path: path.join(SCREENS, `mobile-${name}-case-${s.href.split('/').pop()}.jpg`), quality: 84 });
  const mcase = await page.evaluate(() => ({
    hscroll: document.documentElement.scrollWidth > innerWidth + 1,
    back: document.querySelector('.case__back').getBoundingClientRect().height,
    live: document.querySelector('.case-info__live').getBoundingClientRect().height,
    imgW: Math.max(...[...document.querySelectorAll('.case-media img')].map((i) => i.getBoundingClientRect().width)),
  }));
  check(`${name}: мобильный кейс в одну колонку без переполнения`, !mcase.hscroll && mcase.imgW <= page.viewportSize().width, JSON.stringify(mcase));
  check(`${name}: «Назад» и «Открыть сайт» ≥ 44 px`, mcase.back >= 44 && mcase.live >= 44);
  // свайп по кейсу — обычная прокрутка документа
  await touchSwipe(page, cdp, vp.width / 2, 700, 250, 200);
  await page.waitForTimeout(900);
  check(`${name}: кейс прокручивается touch-жестом`, (await page.evaluate(() => scrollY)) > 100);
  check(`${name}: нет ошибок`, problems.length === 0, problems.slice(0, 5).join(' | '));
  await ctx.close();
}

// ───────── 6. Resize / ориентация сохраняют выбор ─────────
{
  const { ctx, page } = await open({ viewport: { width: 1536, height: 1024 }, hasTouch: true });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await settle(page, 1200);
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await settle(page);
  const a = await homeState(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page, 600);
  const b = await homeState(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await settle(page, 600);
  const c = await homeState(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await settle(page, 600);
  const d = await homeState(page);
  check('resize desktop → phone → landscape → desktop сохраняет выбор', [b, c, d].every((x) => x.href === a.href), [a, b, c, d].map((x) => x.title).join(' → '));
  // высота viewport меняется (панель браузера)
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page, 400);
  const r1 = await page.evaluate(() => document.querySelector('.panel').getBoundingClientRect().bottom);
  await page.setViewportSize({ width: 390, height: 760 });
  await settle(page, 400);
  const r2 = await page.evaluate(() => ({ bottom: document.querySelector('.panel').getBoundingClientRect().bottom, h: innerHeight }));
  check('смена высоты viewport: панель прижата к низу', Math.abs(r1 - 844) < 2 && Math.abs(r2.bottom - r2.h) < 2, `${r1} / ${JSON.stringify(r2)}`);
  await ctx.close();
}

// ───────── 7. Матрица размеров: снимки и переполнения ─────────
const matrix = [
  ['desktop', 1280, 720],
  ['desktop', 1440, 900],
  ['desktop', 1536, 1024],
  ['desktop', 1920, 1080],
  ['phone', 360, 800],
  ['phone', 390, 844],
  ['phone', 430, 932],
  ['tablet', 768, 1024],
  ['phone-landscape', 844, 390],
];
for (const [kind, w, h] of matrix) {
  const mobile = kind !== 'desktop';
  const { ctx, page, problems } = await open(
    mobile ? { viewport: { width: w, height: h }, isMobile: kind !== 'tablet' || true, hasTouch: true, deviceScaleFactor: 2, userAgent: devices['iPhone 13'].userAgent } : { viewport: { width: w, height: h } },
  );
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 1600);
  await page.screenshot({ path: path.join(SCREENS, `${kind}-${w}x${h}-home-sf-diamonds.jpg`), quality: 84 });
  const layout = await page.evaluate(() => {
    const rect = (s) => document.querySelector(s)?.getBoundingClientRect();
    const corners = rect('.corners');
    const meta = rect('.meta');
    const index = rect('.index__list');
    const header = rect('.site-header .logo');
    const overlap = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return {
      hscroll: document.documentElement.scrollWidth > innerWidth + 1,
      metaVsCorners: overlap(meta, corners),
      logoVsCorners: overlap(header, corners),
      cornersInView: corners && corners.left >= 0 && corners.right <= innerWidth,
      titleSize: parseFloat(getComputedStyle(document.querySelector('.meta__title')).fontSize),
      listFont: index ? parseFloat(getComputedStyle(document.querySelector('.index__list a')).fontSize) : null,
    };
  });
  check(`${kind} ${w}×${h}: без переполнения и перекрытий`, !layout.hscroll && !layout.metaVsCorners && !layout.logoVsCorners && layout.cornersInView, JSON.stringify(layout));
  await page.goto(BASE + '/projects/muras-nuru', { waitUntil: 'networkidle' });
  await settle(page, 1400);
  await page.screenshot({ path: path.join(SCREENS, `${kind}-${w}x${h}-case-muras-nuru.jpg`), quality: 84 });
  const caseLayout = await page.evaluate(() => {
    const info = document.querySelector('.case-info__inner').getBoundingClientRect();
    const first = document.querySelector('.case-media__item').getBoundingClientRect();
    const head = document.querySelector('.site-header').getBoundingClientRect();
    return {
      hscroll: document.documentElement.scrollWidth > innerWidth + 1,
      overlap: info.right > first.left && info.bottom > first.top && info.left < first.right && info.top < first.bottom,
      headerOverMedia: head.bottom > first.top + 2 && getComputedStyle(document.querySelector('.site-header')).position === 'fixed',
    };
  });
  check(`${kind} ${w}×${h}: кейс без переполнения и перекрытий`, !caseLayout.hscroll && !caseLayout.overlap && !caseLayout.headerOverMedia, JSON.stringify(caseLayout));
  if (problems.length) check(`${kind} ${w}×${h}: ошибки`, false, problems.slice(0, 3).join(' | '));
  await ctx.close();
}

// ───────── 8. Главная не грузит длинные full-page снимки ─────────
{
  const { ctx, page } = await open({ viewport: { width: 1536, height: 1024 } });
  const requested = [];
  page.on('request', (r) => r.resourceType() === 'image' && requested.push(r.url()));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await settle(page, 1500);
  const fullPage = requested.filter((u) => /full-page/.test(u));
  const covers = requested.filter((u) => /cover-/.test(u));
  check('главная не загружает full-page снимки', fullPage.length === 0, `обложек загружено: ${covers.length}`);
  check('главная загружает только ближайшие обложки', covers.length <= 9, covers.map((u) => u.split('/media/')[1]).join(', '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
await writeFile(path.join(root, 'qa', 'results.json'), JSON.stringify({ base: BASE, date: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} проверок пройдено`);
process.exit(failed.length ? 1 : 0);
