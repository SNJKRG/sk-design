// Запись движения: node scripts/record.mjs [baseUrl] → qa/video/*.mp4
import { chromium, devices } from 'playwright';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const out = path.resolve(import.meta.dirname, '..', 'qa', 'video');
await mkdir(out, { recursive: true });
const browser = await chromium.launch();

async function record(name, ctxOpts, script) {
  const tmp = path.join(out, `tmp-${name}`);
  await rm(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({ ...ctxOpts, recordVideo: { dir: tmp, size: ctxOpts.viewport } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await script(page, ctx);
  await ctx.close();
  const [file] = await readdir(tmp);
  const webm = path.join(out, `${name}.webm`);
  await rename(path.join(tmp, file), webm);
  await rm(tmp, { recursive: true, force: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', path.join(out, `${name}.mp4`)]);
  await rm(webm);
  console.log('✓', name);
}

await record('desktop-1536x1024-scroll-and-case', { viewport: { width: 1536, height: 1024 } }, async (page) => {
  await page.waitForTimeout(1800);
  await page.mouse.move(768, 470);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 100); // медленно: по щелчку
    await page.waitForTimeout(1100);
  }
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 130); // резкий скролл
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(1800);
  for (let i = 0; i < 50; i++) {
    await page.mouse.wheel(0, -9); // трекпад назад
    await page.waitForTimeout(14);
  }
  await page.waitForTimeout(1500);
  await page.mouse.click(768, 476); // переход в кейс
  await page.waitForTimeout(2200);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 160);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1200);
  await page.click('.case__back');
  await page.waitForTimeout(2200);
});

await record('mobile-iphone13-390x844-touch', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }, async (page, ctx) => {
  const cdp = await ctx.newCDPSession(page);
  const swipe = async (y0, y1, ms, steps = 12) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: y0 }] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: y0 + ((y1 - y0) * i) / steps }] });
      await page.waitForTimeout(ms / steps);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await page.waitForTimeout(1600);
  await swipe(470, 350, 450);
  await page.waitForTimeout(1200);
  await swipe(470, 350, 450);
  await page.waitForTimeout(1200);
  await swipe(560, 260, 90, 5); // флик
  await page.waitForTimeout(1800);
  await swipe(300, 520, 400);
  await page.waitForTimeout(1300);
  const cy = await page.evaluate(() => {
    const r = document.querySelector('.corners').getBoundingClientRect();
    return r.top + r.height / 2;
  });
  await page.touchscreen.tap(195, cy);
  await page.waitForTimeout(2300);
  await swipe(700, 250, 300);
  await page.waitForTimeout(1200);
  await page.goBack();
  await page.waitForTimeout(2200);
  await page.tap('.panel__projects');
  await page.waitForTimeout(1200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
});

await browser.close();
