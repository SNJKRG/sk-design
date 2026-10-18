import { forwardRef, memo, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { PROJECTS, PROJECT_COUNT } from '../data/projects';
import { smoothstep, wrapDelta } from '../lib/math';
import { dict, localize, textOf, useLang } from '../i18n';

export type IndexHandle = { update: (pos: number) => void };

type Props = {
  active: number;
  initialPosition: number;
  onOpen: (index: number) => void;
  onFocusItem: (index: number) => void;
};

// Список работ слева — бесконечное кольцо, как у Obys: строки едут вместе с
// лентой от того же параметра положения, активная стоит на центральной линии
// кадра, дальние растворяются, поэтому стык 16→1 не виден.
const ProjectIndex = forwardRef<IndexHandle, Props>(function ProjectIndex({ active, initialPosition, onOpen, onFocusItem }, ref) {
  const lang = useLang();
  const ringRef = useRef<HTMLOListElement>(null);
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const state = useRef({ pos: initialPosition, rowH: 33, last: [] as string[] }).current;

  function update(pos: number) {
    state.pos = pos;
    const h = state.rowH;
    for (let i = 0; i < PROJECT_COUNT; i++) {
      const el = rows.current[i];
      if (!el) continue;
      const d = wrapDelta(i - pos, PROJECT_COUNT);
      const ad = Math.abs(d);
      const op = 1 - smoothstep(PROJECT_COUNT / 2 - 3.6, PROJECT_COUNT / 2 - 0.35, ad);
      const style = `${(d * h - h / 2).toFixed(2)}|${op.toFixed(3)}`;
      if (style === state.last[i]) continue;
      state.last[i] = style;
      el.style.transform = `translate3d(0,${style.split('|')[0]}px,0)`;
      el.style.opacity = style.split('|')[1];
      el.style.visibility = op < 0.01 ? 'hidden' : '';
    }
  }

  useLayoutEffect(() => {
    const measure = () => {
      const first = rows.current[0];
      if (first) state.rowH = first.offsetHeight || 33;
      state.last = [];
      update(state.pos);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (ringRef.current) ro.observe(ringRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({ update }));

  return (
    <nav className="index" aria-label={dict(lang).projects} data-fade>
      <ol className="index__list" ref={ringRef}>
        {PROJECTS.map((p, i) => (
          <li
            key={p.slug}
            ref={(el) => {
              rows.current[i] = el;
            }}
            data-index={i}
            className={i === active ? 'is-active' : undefined}
          >
            <a
              href={localize(p.route, lang)}
              aria-current={i === active ? 'true' : undefined}
              onFocus={() => onFocusItem(i)}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onOpen(i);
              }}
            >
              <span className="index__name">{textOf(p, lang).shortTitle}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
});

export default memo(ProjectIndex);
