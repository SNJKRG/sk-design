import { memo } from 'react';
import type { Project } from '../data/projects';
import { dict, localize, textOf, useLang } from '../i18n';

type Props = { project: Project; onOpen: () => void; variant: 'desktop' | 'mobile'; children?: React.ReactNode };

// Название, категория и «Смотреть кейс» активной работы. Все три берутся из
// одного объекта project, поэтому подпись и ссылка не расходятся.
function ProjectMeta({ project, onOpen, variant, children }: Props) {
  const lang = useLang();
  const t = dict(lang);
  const text = textOf(project, lang);
  const long = text.title.length > 16;
  return (
    <div className={`meta meta--${variant}`} data-fade aria-live="polite">
      <div className="meta__title-box">
        <h1 key={`${project.slug}-${lang}`} className={`meta__title${long ? ' is-long' : ''}`}>
          <span>{text.title}</span>
        </h1>
      </div>
      <span className="meta__rule" aria-hidden="true" />
      <p key={`c-${project.slug}-${lang}`} className="meta__category">
        <span>{text.category}</span>
      </p>
      <div className="meta__actions">
        <a
          className="link-arrow meta__link"
          href={localize(project.route, lang)}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            onOpen();
          }}
        >
          {t.viewCase} <span aria-hidden="true">↗</span>
          <span className="sr-only">: {text.title}</span>
        </a>
        {children}
      </div>
    </div>
  );
}

export default memo(ProjectMeta);
