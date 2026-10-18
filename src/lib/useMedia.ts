import { useSyncExternalStore } from 'react';

export type Layout = 'desktop' | 'mobile';

// Трёхколоночная композиция требует ширины от 1024 и высоты от 560 px,
// иначе включается самостоятельная мобильная композиция.
const query = '(min-width: 1024px) and (min-height: 560px)';

function subscribe(cb: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, () => (window.matchMedia(query).matches ? 'desktop' : 'mobile'), () => 'desktop');
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
