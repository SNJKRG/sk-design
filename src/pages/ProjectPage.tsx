import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { gsap } from 'gsap';
import NotFound from './NotFound';
import { findProject, largest, srcSet, type CaseMedia, type Project } from '../data/projects';
import { galleryStore } from '../lib/galleryStore';
import { transition, visualOf } from '../lib/transition';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { prefersReducedMotion } from '../lib/useMedia';

const DEMO_STATUS = 'demo';

function CaseImage({ project, media, index, hero }: { project: Project; media: CaseMedia; index: number; hero?: boolean }) {
  // Первый кадр — тот же файл, что в галерее, чтобы источник не менялся при переходе.
  const set = hero ? project.cover : media;
  const sizes = '(max-width: 1023px) calc(100vw - 32px), 60vw';
  const alt = `${project.title} — ${media.caption.charAt(0).toLowerCase()}${media.caption.slice(1)}`;
  return (
    <figure className={`case-media__item${media.tall ? ' is-tall' : ''}${hero ? ' is-hero' : ''}`} data-hero={hero ? '' : undefined}>
      <a className="case-media__link" href={largest(media)} target="_blank" rel="noopener" aria-label={`${alt}. Открыть в полном размере`}>
        <picture>
          {set.sources.avif && <source type="image/avif" sizes={sizes} srcSet={srcSet(set.sources.avif)} />}
          <source type="image/webp" sizes={sizes} srcSet={srcSet(set.sources.webp)} />
          <img
            src={set.sources.webp[0].src}
            alt={alt}
            width={media.width}
            height={media.height}
            loading={index < 2 ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={hero ? 'high' : 'auto'}
          />
        </picture>
      </a>
    </figure>
  );
}

function CaseView({ project }: { project: Project }) {
  const location = useLocation();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLElement>(null);
  const fromHome = Boolean((location.state as { fromHome?: boolean } | null)?.fromHome);

  useDocumentMeta(`${project.title} — кейс SK DESIGN`, project.summary, project.route);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    galleryStore.select(project.slug);
    const root = rootRef.current!;
    const hero = root.querySelector<HTMLElement>('[data-hero]');
    const reveal = root.querySelectorAll('[data-reveal]');
    const rest = root.querySelectorAll('.case-media__item:not(.is-hero)');
    const reduced = prefersReducedMotion();
    const played = transition.play(project.slug, 'case', hero, { duration: 0.85 });
    if (!reduced) {
      gsap.fromTo(reveal, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.05, delay: played ? 0.45 : 0.1, ease: 'power3.out' });
      // Лента кейса въезжает справа, как у Obys.
      gsap.fromTo(rest, { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 0.9, stagger: 0.08, delay: played ? 0.55 : 0.2, ease: 'expo.out' });
      if (!played && hero) gsap.fromTo(hero, { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 0.9, delay: 0.05, ease: 'expo.out' });
    }
    return () => {
      // Возврат в галерею (кнопка, логотип, Browser Back): кадр летит обратно.
      if (window.location.pathname === '/') {
        const v = visualOf(hero?.querySelector('img'));
        if (v) transition.capture(project.slug, v, 'home');
      }
    };
  }, [project.slug]);

  const backToGallery = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (fromHome) navigate(-1);
    else navigate('/');
  };

  const [hero, ...rest] = project.media;
  const isDemo = project.status === DEMO_STATUS;

  return (
    <main ref={rootRef} className="case">
      <a className="case__back" href="/" onClick={backToGallery} data-reveal>
        <span aria-hidden="true">←</span> Назад к проектам
      </a>
      <section className="case-info" aria-labelledby="case-title">
        <div className="case-info__inner">
          <h1 id="case-title" className="case-info__title" data-reveal>
            {project.title}
            {isDemo && <span className="tag">Демо</span>}
          </h1>
          <span className="meta__rule" aria-hidden="true" data-reveal />
          <p className="case-info__category" data-reveal>
            {project.category}
          </p>
          <p className="case-info__kind" data-reveal>
            {project.industry}, {project.type.toLowerCase()}
          </p>
          <p className="case-info__text" data-reveal>
            {project.description}
          </p>
          {project.designCredit && (
            <p className="case-info__note" data-reveal>
              Дизайн сайта: {project.designCredit}
            </p>
          )}
          <a className="link-arrow case-info__live" href={project.url} target="_blank" rel="noopener noreferrer" data-reveal>
            Открыть сайт <span aria-hidden="true">↗</span>
            <span className="sr-only"> {project.title} в новой вкладке</span>
          </a>
        </div>
      </section>
      <section className="case-media" aria-label={`Снимки сайта ${project.title}`}>
        <CaseImage project={project} media={hero} index={0} hero />
        {rest.map((m, i) => (
          <CaseImage key={m.sources.webp[0].src} project={project} media={m} index={i + 1} />
        ))}
      </section>
    </main>
  );
}

export default function ProjectPage() {
  const { slug } = useParams();
  const project = findProject(slug);
  if (!project) return <NotFound />;
  return <CaseView key={project.slug} project={project} />;
}
