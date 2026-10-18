// Готовит public/media и src/data/projects.generated.json из пакета материалов.
// Исходники в projects/ и assets/ не изменяются.
import { readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public', 'media');
const portfolio = JSON.parse(await readFile(path.join(root, 'portfolio.json'), 'utf8'));
// Переводы и SEO-заголовки: content/translations.json (ru — уточнения к portfolio.json).
const translations = JSON.parse(await readFile(path.join(root, 'content', 'translations.json'), 'utf8'));
const LOCALES = ['ru', 'en', 'tr'];
const TEXT_FIELDS = ['title', 'shortTitle', 'category', 'industry', 'type', 'summary', 'description', 'seoTitle'];
const config = JSON.parse(await readFile(path.join(root, 'site-config.json'), 'utf8'));

const COVER_WIDTHS = [480, 960, 1600];
const CASE_WIDTHS = [960, 1600];

// --clean пересобирает всё; без флага существующие файлы переиспользуются.
if (process.argv.includes('--clean')) await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const exists = (f) => access(f).then(() => true, () => false);

// Короткие подписи для списка, как в макете SK DESIGN.
const SHORT = {
  '11-muras-nuru': 'Muras Nuru',
  '14-tochno-merch': 'ТОЧНО / ORBIT',
  '06-ai-consultant': 'AI Consultant',
};

async function variants(src, destBase, widths, formats) {
  const meta = await sharp(src).metadata();
  const list = [...new Set(widths.map((w) => Math.min(w, meta.width)))];
  const result = { width: meta.width, height: meta.height, sources: {} };
  for (const fmt of formats) {
    result.sources[fmt] = [];
    for (const w of list) {
      const file = `${destBase}-${w}.${fmt}`;
      result.sources[fmt].push({ src: `/media/${file}`, w });
      if (await exists(path.join(out, file))) continue;
      let img = sharp(src, { limitInputPixels: false }).resize({ width: w, withoutEnlargement: true });
      img = fmt === 'avif' ? img.avif({ quality: 52, effort: 4 }) : img.webp({ quality: 78, effort: 5 });
      await img.toFile(path.join(out, file));
    }
  }
  return result;
}

const byId = new Map(portfolio.projects.map((p) => [p.id, p]));
const order = config.gallery.order;
if (order.length !== 16 || new Set(order).size !== 16) throw new Error('gallery order must contain 16 unique ids');

const projects = [];
for (const [index, id] of order.entries()) {
  const p = byId.get(id);
  if (!p) throw new Error(`missing project ${id}`);
  const dir = path.join(out, p.slug);
  await mkdir(dir, { recursive: true });
  const cover = await variants(path.join(root, p.gallery_cover), `${p.slug}/cover`, COVER_WIDTHS, ['avif', 'webp']);
  // Кейс: сначала тот же кадр, что в галерее, затем остальные снимки в исходном порядке.
  const shots = [p.gallery_cover, ...p.screenshots.map((s) => s.path).filter((s) => s !== p.gallery_cover)];
  const media = [];
  for (const shot of shots) {
    const info = p.screenshots.find((s) => s.path === shot);
    const name = path.basename(shot, path.extname(shot));
    const v = await variants(path.join(root, shot), `${p.slug}/${name}`, CASE_WIDTHS, ['webp']);
    media.push({ ...v, caption: info?.caption ?? '', tall: v.height / v.width > 1.2 });
  }
  const base = {
    title: p.title,
    shortTitle: SHORT[p.id] ?? p.title,
    category: p.display_category,
    industry: p.industry,
    type: p.project_type,
    summary: p.summary,
    description: p.description,
  };
  const i18n = {};
  for (const lang of LOCALES) {
    const tr = translations[p.id]?.[lang] ?? {};
    const text = lang === 'ru' ? { ...base, ...tr } : tr;
    const missing = TEXT_FIELDS.filter((f) => !text[f]);
    if (missing.length) throw new Error(`${p.id}: нет перевода ${lang}: ${missing.join(', ')}`);
    i18n[lang] = Object.fromEntries(TEXT_FIELDS.map((f) => [f, text[f]]));
  }
  projects.push({
    id: p.id,
    index,
    slug: p.slug,
    route: p.case_route,
    url: p.source_url,
    designCredit: p.id === '08-mstarter' ? 'copylobby.art' : null,
    i18n,
    cover,
    media,
  });
  console.log(`✓ ${p.slug}: cover + ${media.length} снимков`);
}

// Логотип: обрезка по alpha, оригинал сохраняется.
await mkdir(path.join(out, 'brand'), { recursive: true });
const logoSrc = path.join(root, config.logo);
const trimmed = await sharp(logoSrc).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
await sharp(trimmed.data).png({ compressionLevel: 9 }).toFile(path.join(out, 'brand', 'logo.png'));
await sharp(trimmed.data).resize({ width: 420 }).png({ compressionLevel: 9 }).toFile(path.join(out, 'brand', 'logo-420.png'));
await sharp(trimmed.data).resize({ width: 420 }).webp({ quality: 90 }).toFile(path.join(out, 'brand', 'logo-420.webp'));
await sharp(trimmed.data).resize(64, 64, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toFile(path.join(root, 'public', 'favicon.png'));
console.log(`✓ logo ${trimmed.info.width}×${trimmed.info.height}`);

await mkdir(path.join(root, 'src', 'data'), { recursive: true });
await writeFile(
  path.join(root, 'src', 'data', 'projects.generated.json'),
  JSON.stringify({ brand: config.brand, contact: config.contact, logo: { width: trimmed.info.width, height: trimmed.info.height }, initial: config.gallery.initial_project_id, projects }, null, 2),
);
console.log('✓ src/data/projects.generated.json');

