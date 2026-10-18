import { useLayoutEffect } from 'react';
import { dict, localize, useLang } from '../i18n';
import { transition } from '../lib/transition';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export default function NotFound() {
  const lang = useLang();
  const t = dict(lang);
  useDocumentMeta(t.notFoundTitle, t.notFoundDescription, null, lang);
  useLayoutEffect(() => transition.cancel(), []);
  return (
    <main className="not-found">
      <p className="not-found__code">404</p>
      <h1 className="not-found__title">{t.notFoundHeading}</h1>
      <p className="not-found__text">{t.notFoundText}</p>
      <a className="link-arrow" href={localize('/', lang)}>
        {t.notFoundLink} <span aria-hidden="true">↗</span>
      </a>
    </main>
  );
}
