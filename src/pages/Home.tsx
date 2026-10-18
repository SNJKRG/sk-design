import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import GalleryScene, { type GalleryHandle, type Insets } from '../components/GalleryScene';
import ProjectIndex, { type IndexHandle } from '../components/ProjectIndex';
import ProjectMeta from '../components/ProjectMeta';
import ProjectSheet from '../components/ProjectSheet';
import { PROJECTS, PROJECT_COUNT, findProject } from '../data/projects';
import { galleryStore } from '../lib/galleryStore';
import { mod } from '../lib/math';
import { transition } from '../lib/transition';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { prefersReducedMotion, useLayout } from '../lib/useMedia';

const slugFromPath = (path: string) => /^\/projects\/([^/]+)\/?$/.exec(path)?.[1];

export default function Home() {
  const layout = useLayout();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<GalleryHandle>(null);
  const indexRef = useRef<IndexHandle>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initialPosition = useRef(galleryStore.position).current;
  const [active, setActive] = useState(() => mod(Math.round(initialPosition), PROJECT_COUNT));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [insets, setInsets] = useState<Insets>({ top: 0, bottom: 0, right: 0 });
  const leaving = useRef(false);

  useDocumentMeta('SK DESIGN — создание и вёрстка сайтов', 'SK DESIGN — создание и вёрстка сайтов. 16 работ: каталоги, рестораны, недвижимость, IT-продукты и веб-сервисы.', '/');

  useLayoutEffect(() => {
    document.documentElement.classList.add('is-home');
    return () => document.documentElement.classList.remove('is-home');
  }, []);

  // Мобильная композиция: область ленты между шапкой и панелью подписи.
  useLayoutEffect(() => {
    if (layout === 'desktop') {
      setInsets({ top: 0, bottom: 0, right: 0 });
      return;
    }
    const header = document.querySelector<HTMLElement>('.site-header');
    const panel = panelRef.current;
    const measure = () => {
      const landscape = window.innerWidth > window.innerHeight && window.innerHeight < 560;
      const top = header?.offsetHeight ?? 0;
      const bottom = landscape ? 0 : panel?.offsetHeight ?? 0;
      const right = landscape ? panel?.offsetWidth ?? 0 : 0;
      setInsets((prev) => (prev.top === top && prev.bottom === bottom && prev.right === right ? prev : { top, bottom, right }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (header) ro.observe(header);
    if (panel) ro.observe(panel);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [layout]);

  // Вход: обратный переход из кейса или мягкое появление.
  useLayoutEffect(() => {
    const root = rootRef.current!;
    const g = galleryRef.current!;
    const fades = root.querySelectorAll('[data-fade]');
    const back = transition.pendingFor('home');
    const project = findProject(back ?? undefined);
    if (project && !prefersReducedMotion()) {
      g.setHidden(project.index);
      // Кадр спустя: мобильные отступы ленты уже измерены, слот на своём месте.
      requestAnimationFrame(() =>
        transition.play(project.slug, 'home', g.slotTarget(project.index), {
          duration: 0.8,
          onDone: () => g.setHidden(null),
        }) || g.setHidden(null),
      );
      gsap.fromTo(root.querySelector('.gallery'), { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 0.35, ease: 'power2.out' });
      gsap.fromTo(fades, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 0.55, ease: 'power2.out' });
    } else {
      transition.cancel();
      if (!prefersReducedMotion()) {
        // Как у Obys: лента поднимается снизу, интерфейс проявляется следом.
        gsap.fromTo(root.querySelector('.gallery'), { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out' });
        gsap.fromTo(fades, { opacity: 0 }, { opacity: 1, duration: 0.7, delay: 0.35, ease: 'power2.out' });
      }
    }

    return () => {
      galleryStore.save(g.position());
      // Browser Forward / иная навигация в кейс без клика — тоже общий переход.
      const slug = slugFromPath(window.location.pathname);
      const target = findProject(slug);
      if (target && !leaving.current) {
        const v = g.visual(target.index);
        if (v) transition.capture(target.slug, v, 'case');
      }
    };
  }, []);

  const open = useCallback(
    (index: number) => {
      if (leaving.current) return; // двойной клик
      const project = PROJECTS[index];
      const g = galleryRef.current!;
      leaving.current = true;
      setSheetOpen(false);
      galleryStore.save(g.position());
      galleryStore.select(project.slug);
      const v = g.visual(index);
      const go = () => navigate(project.route, { state: { fromHome: true } });
      if (!v || prefersReducedMotion() || !transition.capture(project.slug, v, 'case')) {
        go();
        return;
      }
      g.setHidden(index);
      const root = rootRef.current!;
      gsap.to([root.querySelector('.gallery'), ...root.querySelectorAll('[data-fade]')], { opacity: 0, duration: 0.3, ease: 'power2.out' });
      window.setTimeout(go, 280);
    },
    [navigate],
  );

  const onFocusItem = useCallback((index: number) => galleryRef.current?.goTo(index), []);
  const onFrame = useCallback((pos: number) => indexRef.current?.update(pos), []);

  // Клавиатура: стрелки выбирают соседнюю работу, Enter без фокуса открывает текущую.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (sheetOpen || e.altKey || e.metaKey || e.ctrlKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const dir = e.key === 'ArrowDown' || e.key === 'PageDown' ? 1 : e.key === 'ArrowUp' || e.key === 'PageUp' ? -1 : 0;
      if (dir) {
        e.preventDefault();
        const g = galleryRef.current;
        if (!g) return;
        g.step(dir);
        // Фокус в списке переезжает на новую выбранную строку.
        if ((document.activeElement as HTMLElement | null)?.closest('.index__list')) {
          const next = mod(Math.round(g.position()), PROJECT_COUNT);
          rootRef.current?.querySelector<HTMLElement>(`.index__list li[data-index="${next}"] a`)?.focus({ preventScroll: true });
        }
        return;
      }
      if (e.key === 'Enter' && (document.activeElement === document.body || !document.activeElement)) {
        e.preventDefault();
        open(active);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen, open, active]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    triggerRef.current?.focus();
  }, []);

  const project = PROJECTS[active];

  return (
    <main ref={rootRef} className={`home home--${layout}`}>
      <GalleryScene ref={galleryRef} layout={layout} insets={insets} initialPosition={initialPosition} onActiveChange={setActive} onOpen={open} onFrame={onFrame} />
      {layout === 'desktop' ? (
        <>
          <ProjectIndex ref={indexRef} active={active} initialPosition={initialPosition} onOpen={open} onFocusItem={onFocusItem} />
          <ProjectMeta project={project} onOpen={() => open(active)} variant="desktop" />
        </>
      ) : (
        <>
          <div ref={panelRef} className="panel">
            <ProjectMeta project={project} onOpen={() => open(active)} variant="mobile">
              <button
                ref={triggerRef}
                type="button"
                className="panel__projects"
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                aria-label={`Все проекты, выбран ${project.title}`}
                onClick={() => setSheetOpen(true)}
              >
                <span className="index__mark" aria-hidden="true" />
                Проекты <span className="muted">/ {PROJECT_COUNT}</span>
              </button>
            </ProjectMeta>
          </div>
          <ProjectSheet open={sheetOpen} active={active} onClose={closeSheet} onOpen={open} />
        </>
      )}
    </main>
  );
}
