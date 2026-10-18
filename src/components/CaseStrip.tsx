import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { srcSet, type CaseMedia, type ImageSet, type Project } from '../data/projects';
import { captionText, textOf, useLang } from '../i18n';
import { clamp } from '../lib/math';
import { prefersReducedMotion, type Layout } from '../lib/useMedia';

// Лента кейса. Desktop: правая половина экрана, бесконечный цикл «досок» со
// снимками, движется от wheel/клавиатуры/touch с инерционным затуханием
// (один параметр положения, один requestAnimationFrame). Mobile: те же доски
// в обычном потоке документа.

const PAD = 0.075; // поля доски от ширины ленты
const INNER = 0.85; // ширина широкого снимка
const INNER_TALL = 0.56; // ширина длинного full-page снимка

const boardHeight = (m: CaseMedia, w: number) => (m.tall ? w * INNER_TALL : w * INNER) * (m.height / m.width) + 2 * w * PAD;

type Props = { project: Project; layout: Layout; label: string };

function Slide({ project, media, index, copy, set, eager, lazyManual }: { project: Project; media: CaseMedia; index: number; copy: number; set: ImageSet; eager: boolean; lazyManual: boolean }) {
  const lang = useLang();
  const original = copy === 0;
  const caption = captionText(media.caption, lang);
  const alt = original ? `${textOf(project, lang).title}${caption ? ` — ${caption}` : ''}` : '';
  const sizes = '(max-width: 1023px) 92vw, 45vw';
  const srcAttr = (list: ImageSet['sources']['webp']) => (lazyManual && !eager ? { 'data-srcset': srcSet(list) } : { srcSet: srcSet(list) });
  return (
    <figure className={`slide${index % 2 ? ' slide--light' : ' slide--dark'}${media.tall ? ' is-tall' : ''}`} data-slide={index} aria-hidden={original ? undefined : true}>
      <picture>
        {set.sources.avif && <source type="image/avif" sizes={sizes} {...srcAttr(set.sources.avif)} />}
        <source type="image/webp" sizes={sizes} {...srcAttr(set.sources.webp)} />
        <img
          {...(lazyManual && !eager ? { 'data-src': set.sources.webp[0].src } : { src: set.sources.webp[0].src })}
          alt={alt}
          width={media.width}
          height={media.height}
          loading={lazyManual || eager ? undefined : 'lazy'}
          decoding="async"
          draggable={false}
          fetchPriority={index === 0 && original ? 'high' : 'auto'}
        />
      </picture>
    </figure>
  );
}

export default function CaseStrip({ project, layout, label }: Props) {
  const desktop = layout === 'desktop';
  const stripRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState(() => ({ w: window.innerWidth / 2, h: window.innerHeight }));
  // Первый снимок — тот же файл, что обложка в галерее: источник не меняется при переходе.
  const sets = useMemo(() => project.media.map((m, i) => (i === 0 ? project.cover : m)), [project]);

  const heights = project.media.map((m) => boardHeight(m, geo.w));
  const setH = heights.reduce((a, b) => a + b, 0);
  const maxH = Math.max(...heights);
  // Копий столько, чтобы цикл всегда закрывал экран, включая длинные снимки.
  const copies = desktop ? Math.max(2, Math.ceil((2 * maxH + geo.h + 400) / setH)) : 1;
  const total = setH * copies;

  const st = useRef({ pos: 0, target: 0, lambda: 4.5, raf: 0, last: 0, loaded: new Set<number>(), pointer: null as null | { id: number; y: number; p: number; samples: [number, number][] } }).current;
  const geoRef = useRef({ heights, total, maxH, offsets: [] as number[], h0: heights[0] });
  const offsets: number[] = [];
  {
    let acc = 0;
    for (let c = 0; c < copies; c++)
      for (const h of heights) {
        offsets.push(acc);
        acc += h;
      }
  }
  geoRef.current = { heights, total, maxH, offsets, h0: heights[0] };

  function apply() {
    const strip = stripRef.current;
    if (!strip) return;
    const g = geoRef.current;
    const vh = window.innerHeight;
    const A = g.maxH + 200;
    const centre = vh / 2 - g.h0 / 2;
    const els = strip.children as HTMLCollectionOf<HTMLElement>;
    for (let k = 0; k < els.length; k++) {
      const h = g.heights[k % g.heights.length];
      const raw = g.offsets[k] - st.pos;
      const y = ((((raw + A) % g.total) + g.total) % g.total) - A + centre;
      const el = els[k];
      const visible = y + h > -40 && y < vh + 40;
      el.style.transform = `translate3d(0,${y.toFixed(2)}px,0)`;
      el.style.visibility = visible ? '' : 'hidden';
      if (y + h > -vh && y < 2 * vh && !st.loaded.has(k)) {
        st.loaded.add(k);
        el.querySelectorAll<HTMLElement>('[data-srcset]').forEach((n) => {
          n.setAttribute('srcset', n.dataset.srcset!);
          n.removeAttribute('data-srcset');
        });
        el.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((n) => {
          n.src = n.dataset.src!;
          n.removeAttribute('data-src');
        });
      }
    }
  }

  function frame(now: number) {
    const dt = Math.min(0.05, (now - st.last) / 1000);
    st.last = now;
    st.pos += (st.target - st.pos) * (1 - Math.exp(-(st.pointer ? 30 : st.lambda) * dt));
    if (!st.pointer && Math.abs(st.target - st.pos) < 0.1) st.pos = st.target;
    apply();
    st.raf = st.pointer || st.pos !== st.target ? requestAnimationFrame(frame) : 0;
  }

  function kick() {
    if (prefersReducedMotion() && !st.pointer) {
      st.pos = st.target;
      apply();
      return;
    }
    if (!st.raf) {
      st.last = performance.now();
      st.raf = requestAnimationFrame(frame);
    }
  }

  useLayoutEffect(() => {
    if (!desktop) return;
    apply();
  });

  useEffect(() => {
    if (!desktop) return;
    const onResize = () => setGeo({ w: stripRef.current?.clientWidth ?? window.innerWidth / 2, h: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || document.documentElement.classList.contains('is-transitioning')) return;
      let dy = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= window.innerHeight;
      st.target = clamp(st.target + dy * 0.9, st.pos - window.innerHeight * 2, st.pos + window.innerHeight * 2);
      st.lambda = 4.5;
      kick();
    }
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const vh = window.innerHeight;
      const step: Record<string, number> = { ArrowDown: 140, ArrowUp: -140, PageDown: vh * 0.85, PageUp: -vh * 0.85, ' ': e.shiftKey ? -vh * 0.85 : vh * 0.85 };
      if (e.key === 'Home') st.target = Math.round(st.target / geoRef.current.total) * geoRef.current.total;
      else if (e.key in step) st.target += step[e.key];
      else return;
      e.preventDefault();
      st.lambda = 5;
      kick();
    }
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(st.raf);
      st.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop]);

  // Touch на широких экранах (планшет в landscape): свайп с инерцией.
  function onPointerDown(e: React.PointerEvent) {
    if (!desktop || e.pointerType === 'mouse') return;
    st.pointer = { id: e.pointerId, y: e.clientY, p: st.pos, samples: [[performance.now(), e.clientY]] };
    stripRef.current?.setPointerCapture(e.pointerId);
    kick();
  }
  function onPointerMove(e: React.PointerEvent) {
    const p = st.pointer;
    if (!p || p.id !== e.pointerId) return;
    st.target = p.p - (e.clientY - p.y);
    const now = performance.now();
    p.samples.push([now, e.clientY]);
    while (p.samples.length > 2 && now - p.samples[0][0] > 110) p.samples.shift();
  }
  function onPointerUp(e: React.PointerEvent) {
    const p = st.pointer;
    if (!p || p.id !== e.pointerId) return;
    const [t0, y0] = p.samples[0];
    const [t1, y1] = p.samples[p.samples.length - 1];
    const v = performance.now() - t1 > 90 ? 0 : -(y1 - y0) / Math.max(0.016, (t1 - t0) / 1000);
    st.pointer = null;
    st.target += clamp(v * 0.35, -2500, 2500);
    st.lambda = 3.6;
    kick();
  }

  const slides = [];
  for (let c = 0; c < copies; c++)
    for (let i = 0; i < project.media.length; i++)
      slides.push(
        <Slide
          key={`${c}-${i}`}
          project={project}
          media={project.media[i]}
          set={sets[i]}
          index={i}
          copy={c}
          eager={c === 0 && i < 2}
          lazyManual={desktop}
        />,
      );

  return (
    <div
      ref={stripRef}
      className={`case-strip${desktop ? ' is-loop' : ''}`}
      role="region"
      aria-label={label}
      style={desktop ? ({ '--board-h0': `${heights[0]}px` } as React.CSSProperties) : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {slides.map((s, k) => (desktop ? <SlideBox key={k} h={heights[k % heights.length]}>{s}</SlideBox> : s))}
    </div>
  );
}

function SlideBox({ h, children }: { h: number; children: React.ReactNode }) {
  return (
    <div className="slide-box" style={{ height: h }}>
      {children}
    </div>
  );
}
