import { gsap } from 'gsap';
import { prefersReducedMotion } from './useMedia';

// Контроллер общего перехода превью ↔ кейс.
// Схема: capture() фиксирует реальный кадр в оверлее поверх страницы, затем
// меняется маршрут, новая страница вызывает play() со своим целевым элементом.
// Оверлей всегда показывает один и тот же источник изображения и снимается
// при любом прерывании (двойной клик, быстрый Back, таймаут).

export type Direction = 'case' | 'home';

export type Visual = {
  img: HTMLImageElement;
  rect: DOMRect;
  gray: number;
  opacity: number;
};

type Pending = { slug: string; to: Direction; overlay: HTMLDivElement; img: HTMLImageElement; createdAt: number };

let pending: Pending | null = null;
let tween: gsap.core.Timeline | null = null;
let revealTarget: HTMLElement | null = null;
let safety = 0;

function removeOverlay() {
  window.clearTimeout(safety);
  tween?.kill();
  tween = null;
  pending?.overlay.remove();
  pending = null;
  if (revealTarget) revealTarget.style.visibility = '';
  revealTarget = null;
  document.documentElement.classList.remove('is-transitioning');
}

function inViewport(r: DOMRect) {
  return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
}

export const transition = {
  get busy() {
    return pending !== null;
  },

  pendingFor(to: Direction) {
    return pending && pending.to === to ? pending.slug : null;
  },

  capture(slug: string, visual: Visual, to: Direction) {
    removeOverlay();
    if (!inViewport(visual.rect) || prefersReducedMotion()) return false;
    const overlay = document.createElement('div');
    overlay.className = 'flip-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'sync';
    img.src = visual.img.currentSrc || visual.img.src;
    overlay.appendChild(img);
    const { left, top, width, height } = visual.rect;
    Object.assign(overlay.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`, opacity: String(visual.opacity) });
    img.style.filter = `grayscale(${visual.gray})`;
    document.body.appendChild(overlay);
    document.documentElement.classList.add('is-transitioning');
    pending = { slug, to, overlay, img, createdAt: performance.now() };
    // Если новая страница так и не забрала оверлей — снять его.
    safety = window.setTimeout(removeOverlay, 2600);
    return true;
  },

  /**
   * Довести оверлей до целевого элемента. Возвращает false, если перехода нет
   * (прямое открытие URL, reduced motion, несоответствие маршрута).
   */
  play(slug: string, to: Direction, target: HTMLElement | null, opts: { duration?: number; onDone?: () => void } = {}) {
    if (!pending || pending.slug !== slug || pending.to !== to || !target) {
      removeOverlay();
      return false;
    }
    const p = pending;
    window.clearTimeout(safety);
    safety = window.setTimeout(removeOverlay, 3200);
    revealTarget = target;
    target.style.visibility = 'hidden';
    const r = target.getBoundingClientRect();
    const targetImg = target.querySelector('img');
    const duration = opts.duration ?? 0.85;
    tween = gsap
      .timeline({
        onComplete: () => {
          const finish = () => {
            if (pending !== p) return;
            target.style.visibility = '';
            revealTarget = null;
            gsap.to(p.overlay, {
              opacity: 0,
              duration: 0.18,
              onComplete: () => {
                if (pending === p) removeOverlay();
              },
            });
            opts.onDone?.();
          };
          // Показать настоящий кадр только после декодирования, чтобы не мигнуть.
          if (targetImg && !targetImg.complete) {
            const t = window.setTimeout(finish, 600);
            targetImg.decode().then(
              () => (window.clearTimeout(t), finish()),
              () => (window.clearTimeout(t), finish()),
            );
          } else finish();
        },
      })
      .to(p.overlay, { left: r.left, top: r.top, width: r.width, height: r.height, opacity: 1, duration, ease: 'power3.inOut' }, 0)
      .to(p.img, { filter: 'grayscale(0)', duration: duration * 0.7, ease: 'power2.out' }, 0);
    return true;
  },

  cancel: removeOverlay,
};

export function visualOf(img: HTMLImageElement | null | undefined, gray = 0, opacity = 1): Visual | null {
  if (!img) return null;
  return { img, rect: img.getBoundingClientRect(), gray, opacity };
}
