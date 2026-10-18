import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { LANGS, LANG_CODES, LANG_NAMES, dict, localize, stripLang, useLang } from '../i18n';

// Выпадающий список языков в шапке. Меню рендерится в body: шапка на desktop
// смешивается с фоном (mix-blend-mode), а список должен оставаться читаемым.
export default function LangSwitch() {
  const lang = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const t = dict(lang);
  const base = stripLang(location.pathname);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right - 14) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current!;
    const items = () => [...menu.querySelectorAll<HTMLAnchorElement>('a')];
    (menu.querySelector<HTMLAnchorElement>('[aria-current="true"]') ?? items()[0])?.focus({ preventScroll: true });
    function close(focusTrigger: boolean) {
      setOpen(false);
      if (focusTrigger) triggerRef.current?.focus();
    }
    function onKey(e: KeyboardEvent) {
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLAnchorElement);
      if (e.key === 'Escape') {
        e.preventDefault();
        close(true);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
      } else if (e.key === 'Tab') {
        close(false);
      }
    }
    function onPointer(e: PointerEvent) {
      if (!menu.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) close(false);
    }
    const onResize = () => close(false);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="lang"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${t.language}: ${LANG_NAMES[lang]}`}
        onClick={() => setOpen((v) => !v)}
      >
        {LANG_CODES[lang]}
        <svg className="lang__chevron" width="9" height="6" viewBox="0 0 9 6" aria-hidden="true">
          <path d="M.5.75 4.5 4.75 8.5.75" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      {open &&
        createPortal(
          <ul ref={menuRef} className="lang-menu" style={{ top: pos.top, right: pos.right }} aria-label={t.language}>
            {LANGS.map((l) => (
              <li key={l}>
                <a
                  href={localize(base, l)}
                  hrefLang={l}
                  lang={l}
                  aria-current={l === lang ? 'true' : undefined}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    setOpen(false);
                    triggerRef.current?.focus({ preventScroll: true });
                    if (l !== lang) navigate(localize(base, l));
                  }}
                >
                  <span className="lang-menu__code">{LANG_CODES[l]}</span>
                  {LANG_NAMES[l]}
                </a>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
