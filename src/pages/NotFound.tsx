import { useLayoutEffect } from 'react';
import { transition } from '../lib/transition';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export default function NotFound() {
  useDocumentMeta('Страница не найдена — SK DESIGN', 'Такой страницы нет в портфолио SK DESIGN.', window.location.pathname);
  useLayoutEffect(() => transition.cancel(), []);
  return (
    <main className="not-found">
      <p className="not-found__code">404</p>
      <h1 className="not-found__title">Такой страницы нет</h1>
      <p className="not-found__text">Возможно, ссылка устарела. Все 16 работ собраны на главной.</p>
      <a className="link-arrow" href="/">
        К проектам <span aria-hidden="true">↗</span>
      </a>
    </main>
  );
}
