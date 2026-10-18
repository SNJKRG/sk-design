import { memo } from 'react';
import type { Project } from '../data/projects';

type Props = { project: Project; onOpen: () => void; variant: 'desktop' | 'mobile'; children?: React.ReactNode };

// Название, категория и «Смотреть кейс» активной работы. Все три берутся из
// одного объекта project, поэтому подпись и ссылка не расходятся.
function ProjectMeta({ project, onOpen, variant, children }: Props) {
  const long = project.title.length > 16;
  return (
    <div className={`meta meta--${variant}`} data-fade aria-live="polite">
      <div className="meta__title-box">
        <h1 key={project.slug} className={`meta__title${long ? ' is-long' : ''}`}>
          <span>{project.title}</span>
        </h1>
      </div>
      <span className="meta__rule" aria-hidden="true" />
      <p key={`c-${project.slug}`} className="meta__category">
        <span>{project.category}</span>
      </p>
      <div className="meta__actions">
        <a
          className="link-arrow meta__link"
          href={project.route}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            onOpen();
          }}
        >
          Смотреть кейс <span aria-hidden="true">↗</span>
          <span className="sr-only">: {project.title}</span>
        </a>
        {children}
      </div>
    </div>
  );
}

export default memo(ProjectMeta);
