import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PROJECTS } from '../data/projects';

type Props = {
  open: boolean;
  active: number;
  onClose: () => void;
  onOpen: (index: number) => void;
};

// Мобильная панель со списком всех 16 работ. Закрывается по Escape,
// кнопке и выбору; фокус удерживается внутри и возвращается на триггер.
// Рендерится в body: .home фиксирована и иначе заперла бы панель под шапкой.
export default function ProjectSheet({ open, active, onClose, onOpen }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const box = ref.current!;
    const focusables = () => [...box.querySelectorAll<HTMLElement>('a[href], button')];
    (box.querySelector<HTMLElement>('[aria-current="true"]') ?? focusables()[0])?.focus({ preventScroll: true });
    box.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'center' });
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        const list = focusables();
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <div ref={ref} className={`sheet${open ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-label="Все проекты" hidden={!open} data-own-scroll>
      <div className="sheet__head">
        <button type="button" className="sheet__close" onClick={onClose}>
          Закрыть <span aria-hidden="true">✕</span>
        </button>
      </div>
      <ol className="sheet__list">
        {PROJECTS.map((p, i) => (
          <li key={p.slug} className={i === active ? 'is-active' : undefined}>
            <a
              href={p.route}
              aria-current={i === active ? 'true' : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onOpen(i);
              }}
            >
              <span className="sheet__name">{p.title}</span>
              <span className="sheet__cat">{p.category}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>,
    document.body,
  );
}
