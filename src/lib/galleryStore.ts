import { INITIAL_INDEX, PROJECT_COUNT, findProject } from '../data/projects';
import { mod, wrapDelta } from './math';

// Единственное сохраняемое состояние галереи: непрерывная позиция ленты.
// Выбранная работа = mod(round(position), 16). Переживает переходы и refresh вкладки.
const KEY = 'sk-gallery-position';

function read(): number {
  try {
    const v = Number(sessionStorage.getItem(KEY));
    if (Number.isFinite(v) && sessionStorage.getItem(KEY) !== null) return v;
  } catch {
    /* storage недоступен */
  }
  return INITIAL_INDEX;
}

let position = read();

export const galleryStore = {
  get position() {
    return position;
  },
  get index() {
    return mod(Math.round(position), PROJECT_COUNT);
  },
  save(p: number) {
    position = Math.round(p);
    try {
      sessionStorage.setItem(KEY, String(position));
    } catch {
      /* ignore */
    }
  },
  /** Выбрать работу, не прокручивая ленту через весь круг. */
  select(slug: string) {
    const project = findProject(slug);
    if (!project) return;
    const k = Math.round(position);
    this.save(k + wrapDelta(project.index - mod(k, PROJECT_COUNT), PROJECT_COUNT));
  },
};
