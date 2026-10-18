import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { gsap } from 'gsap';
import NotFound from './NotFound';
import CaseStrip from '../components/CaseStrip';
import { findProject, type Project } from '../data/projects';
import { dict, isHomePath, localize, textOf, useLang } from '../i18n';
import { galleryStore } from '../lib/galleryStore';
import { transition, visualOf } from '../lib/transition';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { prefersReducedMotion, useLayout } from '../lib/useMedia';

// Кейс по образцу Obys: страница неподвижна, справа бесконечная лента
// снимков, слева на центральной линии — название, категории и ссылка.
// На телефоне — одна колонка с обычной прокруткой документа.
function CaseView({ project }: { project: Project }) {
  const location = useLocation();
  const navigate = useNavigate();
  const layout = useLayout();
  const lang = useLang();
  const t = dict(lang);
  const text = textOf(project, lang);
  const rootRef = useRef<HTMLElement>(null);
  const fromHome = Boolean((location.state as { fromHome?: boolean } | null)?.fromHome);

  useDocumentMeta(text.seoTitle, text.summary, project.route, lang);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('is-case', layout === 'desktop');
    return () => document.documentElement.classList.remove('is-case');
  }, [layout]);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    galleryStore.select(project.slug);
    const root = rootRef.current!;
    const hero = root.querySelector<HTMLElement>('[data-slide="0"] picture');
    const reveal = root.querySelectorAll('[data-reveal]');
    const strip = root.querySelector('.case-strip');
    const played = transition.play(project.slug, 'case', hero, { duration: 0.85 });
    if (!prefersReducedMotion()) {
      gsap.fromTo(reveal, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.05, delay: played ? 0.45 : 0.15, ease: 'power3.out' });
      // Лента въезжает справа, как у Obys; при общем переходе кадр уже на месте.
      if (!played) gsap.fromTo(strip, { x: 120, opacity: 0 }, { x: 0, opacity: 1, duration: 1.1, ease: 'expo.out' });
      gsap.fromTo(root.querySelector('.case-marker'), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.8, delay: played ? 0.6 : 0.3, ease: 'expo.out' });
    }
    return () => {
      // Возврат в галерею (кнопка, логотип, Browser Back): летит первый кадр,
      // если он в кадре — это тот же файл, что и обложка в галерее.
      if (isHomePath(window.location.pathname)) {
        const imgs = [...root.querySelectorAll<HTMLImageElement>('[data-slide="0"] img')];
        const centre = window.innerHeight / 2;
        const best = imgs
          .map((img) => ({ img, r: img.getBoundingClientRect() }))
          .filter(({ r }) => r.bottom > 0 && r.top < window.innerHeight && r.width > 0)
          .sort((a, b) => Math.abs(a.r.top + a.r.height / 2 - centre) - Math.abs(b.r.top + b.r.height / 2 - centre))[0];
        const v = visualOf(best?.img);
        if (v) transition.capture(project.slug, v, 'home');
      }
    };
  }, [project.slug]);

  const backToGallery = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (fromHome) navigate(-1);
    else navigate(localize('/', lang));
  };

  return (
    <main ref={rootRef} className={`case case--${layout}`}>
      <section className="case-info" aria-labelledby="case-title">
        <h1 id="case-title" className="case-info__title" data-reveal>
          {text.title}
        </h1>
        <div className="case-info__meta">
          <p className="case-info__category" data-reveal>
            {text.category}
          </p>
          <p className="case-info__kind" data-reveal>
            {text.industry}, {text.type.toLowerCase()}
          </p>
          <p className="case-info__text" data-reveal>
            {text.description}
          </p>
          {project.designCredit && (
            <p className="case-info__note" data-reveal>
              {t.designCredit}: {project.designCredit}
            </p>
          )}
          <a className="link-arrow case-info__live" href={project.url} target="_blank" rel="noopener noreferrer" data-reveal>
            {t.visitSite} <span aria-hidden="true">↗</span>
            <span className="sr-only">
              {' '}
              {text.title}, {t.visitSiteSr}
            </span>
          </a>
        </div>
      </section>
      <a className="case__back" href={localize('/', lang)} onClick={backToGallery} data-reveal>
        <span aria-hidden="true">←</span> {t.back}
      </a>
      <CaseStrip key={layout} project={project} layout={layout} label={`${t.screenshots} ${text.title}`} />
      {layout === 'desktop' && (
        <div className="corners case-marker" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      )}
    </main>
  );
}

export default function ProjectPage() {
  const { slug } = useParams();
  const project = findProject(slug);
  if (!project) return <NotFound />;
  return <CaseView key={project.slug} project={project} />;
}
