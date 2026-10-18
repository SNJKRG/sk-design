import { forwardRef, memo, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { PROJECTS, PROJECT_COUNT, srcSet, type Project } from '../data/projects';
import { clamp, mod, smoothstep, wrapDelta } from '../lib/math';
import { prefersReducedMotion, type Layout } from '../lib/useMedia';
import type { Visual } from '../lib/transition';

// Вертикальная бесконечная лента. Один непрерывный параметр `pos` (в единицах
// работ) — из него вычисляются transform, цвет, прозрачность и выбранный индекс.
// Wheel/trackpad/touch/клавиатура меняют только `target`; `pos` догоняет его
// экспоненциальным затуханием в одном requestAnimationFrame.

export type Insets = { top: number; bottom: number; right: number };

export type GalleryHandle = {
  step: (dir: 1 | -1) => void;
  goTo: (index: number) => void;
  position: () => number;
  /** Видимый кадр работы (для перехода в кейс) либо кадр в центральном слоте. */
  visual: (index: number) => Visual | null;
  /** Целевой элемент для обратного перехода: центральный кадр работы. */
  slotTarget: (index: number) => HTMLElement | null;
  setHidden: (index: number | null) => void;
};

type Props = {
  layout: Layout;
  insets: Insets;
  initialPosition: number;
  onActiveChange: (index: number) => void;
  onOpen: (index: number) => void;
  /** Каждый кадр движения: положение ленты для синхронных элементов (список). */
  onFrame?: (pos: number) => void;
};

type Geo = {
  W: number;
  H: number;
  cx: number;
  cy: number;
  sMin: number;
  gap: number;
  spacing: number;
  range: number;
  inactiveOpacity: number;
};

const INACTIVE_OPACITY = 0.5; // site-config.json → gallery.inactive_opacity
const DESKTOP_ASPECT = 818 / 428; // активный кадр макета
const MOBILE_ASPECT = 16 / 9; // исходное соотношение снимков

// Масштаб соседей и интеграл расстояний: соседние кадры всегда разделены
// одинаковым зазором, какой бы ни была дробная позиция.
const scaleAt = (ad: number, sMin: number) => sMin + (1 - sMin) * (1 - smoothstep(0, 1, ad));
function offsetAt(ad: number, g: Geo) {
  const x = Math.min(ad, 1);
  const smoothInt = x * x * x - (x * x * x * x) / 2; // ∫ smoothstep
  const i1 = g.sMin * x + (1 - g.sMin) * (x - smoothInt);
  const extra = Math.max(0, ad - 1) * g.sMin;
  return g.H * (i1 + extra) + g.gap * ad;
}

function computeGeo(layout: Layout, w: number, h: number, ins: Insets): Geo {
  let W: number, H: number, cx: number, cy: number, sMin: number, gap: number;
  if (layout === 'desktop') {
    W = Math.min(w * 0.5326, h * 0.418 * DESKTOP_ASPECT);
    H = W / DESKTOP_ASPECT;
    cx = w / 2;
    cy = h * 0.4658;
    sMin = 0.64;
    gap = Math.max(10, W * 0.0183);
  } else {
    const availW = w - ins.right;
    const availH = h - ins.top - ins.bottom;
    const landscape = ins.right > 0;
    W = Math.min(availW - 40, availH * (landscape ? 0.66 : 0.42) * MOBILE_ASPECT, 640);
    H = W / MOBILE_ASPECT;
    cx = availW / 2;
    cy = ins.top + availH / 2;
    sMin = 0.74;
    gap = 10;
  }
  const g: Geo = { W, H, cx, cy, sMin, gap, spacing: H * (1 + sMin) / 2 + gap, range: 1, inactiveOpacity: INACTIVE_OPACITY };
  // Сколько кадров по вертикали реально видно (запас на половину кадра).
  const reach = Math.max(cy, h - cy) + 40;
  let ad = 0;
  while (ad < PROJECT_COUNT / 2 - 0.5 && offsetAt(ad, g) - (H * scaleAt(ad, sMin)) / 2 < reach) ad += 0.05;
  g.range = Math.min(PROJECT_COUNT / 2 - 0.5, ad + 0.05);
  return g;
}

function Cover({ project, eager }: { project: Project; eager: boolean }) {
  const { avif, webp } = project.cover.sources;
  const sizes = '(max-width: 1023px) 92vw, 54vw';
  // Дальние кадры получают srcset только при приближении (data-srcset).
  const attr = (list: typeof webp) => (eager ? { srcSet: srcSet(list) } : { 'data-srcset': srcSet(list) });
  return (
    <picture>
      {avif && <source type="image/avif" sizes={sizes} {...attr(avif)} />}
      <source type="image/webp" sizes={sizes} {...attr(webp)} />
      <img
        {...(eager ? { src: webp[1]?.src ?? webp[0].src } : { 'data-src': webp[1]?.src ?? webp[0].src })}
        alt=""
        width={project.cover.width}
        height={project.cover.height}
        draggable={false}
        decoding="async"
        fetchPriority={eager ? 'high' : 'auto'}
      />
    </picture>
  );
}

const GalleryScene = forwardRef<GalleryHandle, Props>(function GalleryScene({ layout, insets, initialPosition, onActiveChange, onOpen, onFrame }, ref) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cornersRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const cbRef = useRef({ onActiveChange, onOpen, onFrame });
  cbRef.current = { onActiveChange, onOpen, onFrame };

  const st = useRef({
    pos: initialPosition,
    target: initialPosition,
    lambda: 6,
    raf: 0,
    last: 0,
    active: mod(Math.round(initialPosition), PROJECT_COUNT),
    hidden: null as number | null,
    geo: null as Geo | null,
    visible: new Array<boolean>(PROJECT_COUNT).fill(true),
    lastStyle: new Array<string>(PROJECT_COUNT).fill(''),
    loaded: new Array<boolean>(PROJECT_COUNT).fill(false),
    // wheel
    lastWheel: 0,
    gestureFrom: 0,
    snapTimer: 0,
    // pointer
    pointer: null as null | { id: number; x0: number; y0: number; p0: number; moved: boolean; type: string; samples: [number, number][] },
    dragging: false,
    suppressClick: false,
  }).current;

  const initialEager = (i: number) => Math.abs(wrapDelta(i - initialPosition, PROJECT_COUNT)) <= 2.5;

  function load(i: number) {
    const idx = mod(i, PROJECT_COUNT);
    if (st.loaded[idx]) return;
    st.loaded[idx] = true;
    const el = itemRefs.current[idx];
    el?.querySelectorAll<HTMLElement>('[data-srcset]').forEach((n) => {
      n.setAttribute('srcset', n.dataset.srcset!);
      n.removeAttribute('data-srcset');
    });
    el?.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((n) => {
      n.src = n.dataset.src!;
      n.removeAttribute('data-src');
    });
  }

  function apply() {
    const g = st.geo;
    if (!g) return;
    for (let i = 0; i < PROJECT_COUNT; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const d = wrapDelta(i - st.pos, PROJECT_COUNT);
      const ad = Math.abs(d);
      const inRange = ad <= g.range;
      const show = inRange && st.hidden !== i;
      if (show !== st.visible[i]) {
        el.style.visibility = show ? '' : 'hidden';
        st.visible[i] = show;
      }
      // Скрытый на время перехода кадр сохраняет геометрию — по ней летит оверлей.
      if (!inRange) continue;
      load(i);
      const s = scaleAt(ad, g.sMin);
      const y = g.cy + Math.sign(d) * offsetAt(ad, g);
      const c = 1 - smoothstep(0.08, 0.58, ad);
      const style = `translate3d(${(g.cx - g.W / 2).toFixed(2)}px,${(y - g.H / 2).toFixed(2)}px,0) scale(${s.toFixed(4)})|${(1 - c).toFixed(3)}|${(g.inactiveOpacity + (1 - g.inactiveOpacity) * c).toFixed(3)}`;
      if (style === st.lastStyle[i]) continue;
      st.lastStyle[i] = style;
      const [tf, gray, op] = style.split('|');
      el.style.transform = tf;
      el.style.setProperty('--g', gray);
      el.style.setProperty('--o', op);
    }
    cbRef.current.onFrame?.(st.pos);
    const idx = mod(Math.round(st.pos), PROJECT_COUNT);
    if (idx !== st.active) {
      st.active = idx;
      // Ближайшие соседи подгружаются заранее.
      for (let k = -3; k <= 3; k++) load(idx + k);
      cbRef.current.onActiveChange(idx);
    }
  }

  function frame(now: number) {
    const dt = Math.min(0.05, (now - st.last) / 1000);
    st.last = now;
    const lambda = st.dragging ? 30 : st.lambda;
    st.pos += (st.target - st.pos) * (1 - Math.exp(-lambda * dt));
    if (!st.dragging && Math.abs(st.target - st.pos) < 0.0005) st.pos = st.target;
    apply();
    st.raf = st.dragging || st.pos !== st.target ? requestAnimationFrame(frame) : 0;
  }

  function kick() {
    if (prefersReducedMotion() && !st.dragging) {
      st.pos = st.target;
      apply();
      return;
    }
    if (!st.raf) {
      st.last = performance.now();
      st.raf = requestAnimationFrame(frame);
    }
  }

  function snap() {
    const from = st.gestureFrom;
    let s = Math.round(st.target);
    const moved = st.target - from;
    // Короткий жест (один щелчок колеса, лёгкий свайп) всё равно ведёт к соседу.
    if (s === from && Math.abs(moved) > 0.1) s = from + Math.sign(moved);
    st.target = s;
    st.lambda = 5.2;
    kick();
  }

  function layoutGeo() {
    const stage = stageRef.current;
    if (!stage) return;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const g = computeGeo(layout, w, h, insets);
    st.geo = g;
    st.lastStyle.fill('');
    stage.style.setProperty('--item-w', `${g.W}px`);
    stage.style.setProperty('--item-h', `${g.H}px`);
    // Геометрия центрального слота нужна списку, подписи и уголкам.
    const root = stage.parentElement;
    const slot = { left: g.cx - g.W / 2, top: g.cy - g.H / 2, right: g.cx + g.W / 2, bottom: g.cy + g.H / 2 };
    root?.style.setProperty('--slot-left', `${slot.left}px`);
    root?.style.setProperty('--slot-top', `${slot.top}px`);
    root?.style.setProperty('--slot-right', `${slot.right}px`);
    root?.style.setProperty('--slot-bottom', `${slot.bottom}px`);
    root?.style.setProperty('--slot-h', `${g.H}px`);
    root?.style.setProperty('--slot-cy', `${g.cy}px`);
    root?.style.setProperty('--slot-w', `${g.W}px`);
    const corners = cornersRef.current;
    if (corners) {
      const k = layout === 'desktop' ? g.W / 818 : 1;
      const off = layout === 'desktop' ? 15 * k : 8;
      const len = layout === 'desktop' ? Math.max(14, 23 * k) : 14;
      Object.assign(corners.style, {
        left: `${slot.left - off}px`,
        top: `${slot.top - off}px`,
        width: `${g.W + off * 2}px`,
        height: `${g.H + off * 2}px`,
      });
      corners.style.setProperty('--corner', `${len}px`);
    }
    apply();
  }

  useLayoutEffect(() => {
    layoutGeo();
    const stage = stageRef.current!;
    const ro = new ResizeObserver(() => layoutGeo());
    ro.observe(stage);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, insets.top, insets.bottom, insets.right]);

  // Wheel / trackpad
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || !st.geo) return;
      const own = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-own-scroll]');
      if (own && own.scrollHeight > own.clientHeight + 1) return;
      if (document.documentElement.classList.contains('is-transitioning')) return;
      let dy = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= window.innerHeight;
      const now = performance.now();
      if (now - st.lastWheel > 240) st.gestureFrom = Math.round(st.target);
      st.lastWheel = now;
      const units = clamp((dy * 1.2) / st.geo.spacing, -1.1, 1.1);
      st.target = clamp(st.target + units, st.pos - 3, st.pos + 3);
      st.lambda = 6;
      window.clearTimeout(st.snapTimer);
      st.snapTimer = window.setTimeout(snap, 180);
      kick();
    }
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.clearTimeout(st.snapTimer);
      cancelAnimationFrame(st.raf);
      st.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pointer: свайп с инерцией и различение drag / tap.
  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || !st.geo) return;
    st.suppressClick = false;
    window.clearTimeout(st.snapTimer);
    st.pointer = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: st.pos, moved: false, type: e.pointerType, samples: [[performance.now(), e.clientY]] };
  }
  function onPointerMove(e: React.PointerEvent) {
    const p = st.pointer;
    if (!p || p.id !== e.pointerId || !st.geo) return;
    const dy = e.clientY - p.y0;
    const dx = e.clientX - p.x0;
    if (!p.moved) {
      const threshold = p.type === 'mouse' ? 6 : 10;
      if (Math.abs(dy) < threshold || Math.abs(dy) < Math.abs(dx)) {
        if (Math.abs(dx) > threshold * 2) st.pointer = null; // горизонтальный жест — не наш
        return;
      }
      p.moved = true;
      p.y0 = e.clientY; // без рывка на величину порога
      p.p0 = st.pos;
      st.dragging = true;
      st.suppressClick = true;
      st.gestureFrom = Math.round(st.pos);
      stageRef.current?.setPointerCapture(e.pointerId);
      stageRef.current?.classList.add('is-dragging');
    }
    st.target = p.p0 - (e.clientY - p.y0) / st.geo.spacing;
    const now = performance.now();
    p.samples.push([now, e.clientY]);
    while (p.samples.length > 2 && now - p.samples[0][0] > 110) p.samples.shift();
    kick();
  }
  function onPointerUp(e: React.PointerEvent) {
    const p = st.pointer;
    if (!p || p.id !== e.pointerId) return;
    st.pointer = null;
    if (!p.moved || !st.geo) return;
    stageRef.current?.classList.remove('is-dragging');
    const [t0, y0] = p.samples[0];
    const [t1, y1] = p.samples[p.samples.length - 1];
    const dt = Math.max(16, t1 - t0) / 1000;
    const released = performance.now() - t1 > 90; // палец остановился перед отпусканием
    const v = released ? 0 : -(y1 - y0) / dt / st.geo.spacing; // работ в секунду
    st.dragging = false;
    const projected = st.target + clamp(v * 0.26, -6, 6);
    let s = Math.round(projected);
    const moved = st.target - st.gestureFrom;
    if (s === st.gestureFrom && Math.abs(moved) > 0.12) s = st.gestureFrom + Math.sign(moved);
    st.target = s;
    st.lambda = 4.4;
    kick();
  }

  function onItemClick(e: React.MouseEvent, i: number) {
    if (st.suppressClick) {
      e.preventDefault();
      st.suppressClick = false;
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // новая вкладка
    e.preventDefault();
    cbRef.current.onOpen(i);
  }

  useImperativeHandle(ref, () => ({
    step(dir) {
      window.clearTimeout(st.snapTimer);
      st.target = Math.round(st.target) + dir;
      st.lambda = 5.2;
      kick();
    },
    goTo(index) {
      window.clearTimeout(st.snapTimer);
      const k = Math.round(st.target);
      st.target = k + wrapDelta(index - mod(k, PROJECT_COUNT), PROJECT_COUNT);
      st.lambda = 4.6;
      kick();
    },
    position: () => st.target,
    visual(index) {
      const el = itemRefs.current[index];
      const img = el?.querySelector('img');
      if (!el || !img || !st.geo) return null;
      const ad = Math.abs(wrapDelta(index - st.pos, PROJECT_COUNT));
      if (ad > st.geo.range) return null;
      const c = 1 - smoothstep(0.08, 0.58, ad);
      return { img, rect: img.getBoundingClientRect(), gray: 1 - c, opacity: st.geo.inactiveOpacity + (1 - st.geo.inactiveOpacity) * c };
    },
    slotTarget(index) {
      return itemRefs.current[index] ?? null;
    },
    setHidden(index) {
      st.hidden = index;
      st.lastStyle.fill('');
      apply();
    },
  }));

  return (
    <>
      <div
        ref={stageRef}
        className="gallery"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDragStart={(e) => e.preventDefault()}
      >
        {PROJECTS.map((p, i) => (
          <a
            key={p.slug}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="g-item"
            href={p.route}
            tabIndex={-1}
            aria-hidden="true"
            draggable={false}
            onClick={(e) => onItemClick(e, i)}
          >
            <Cover project={p} eager={initialEager(i)} />
          </a>
        ))}
      </div>
      <div ref={cornersRef} className="corners" aria-hidden="true" data-fade>
        <i />
        <i />
        <i />
        <i />
      </div>
    </>
  );
});

export default memo(GalleryScene);
