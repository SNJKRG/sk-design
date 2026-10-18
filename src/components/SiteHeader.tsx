import { useLocation, useNavigate } from 'react-router-dom';
import { BRAND, CONTACT } from '../data/projects';
import { dict, isHomePath, localize, useLang } from '../i18n';
import LangSwitch from './LangSwitch';

// Общая закреплённая шапка: не размонтируется между маршрутами, поэтому
// логотип, язык и контакт остаются на месте во время перехода.
export default function SiteHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const lang = useLang();
  const t = dict(lang);
  const isHome = isHomePath(location.pathname);
  const home = localize('/', lang);

  return (
    <header className={`site-header${isHome ? ' is-home' : ' is-inner'}`}>
      <a
        className="logo"
        href={home}
        aria-label={`${BRAND} — ${t.home}`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          if (isHome) return;
          // Пришли из галереи — возвращаемся по истории, чтобы Back/Forward остались чистыми.
          if ((location.state as { fromHome?: boolean } | null)?.fromHome) navigate(-1);
          else navigate(home);
        }}
      >
        <picture>
          <source type="image/webp" srcSet="/media/brand/logo-420.webp" />
          <img src="/media/brand/logo-420.png" alt={BRAND} width={420} height={272} />
        </picture>
      </a>
      <div className="site-header__end">
        <LangSwitch />
        <a className="link-arrow contact" href={CONTACT.href} target="_blank" rel="noopener noreferrer">
          {t.contact} <span aria-hidden="true">↗</span>
          <span className="sr-only">
            {' '}
            {t.contactSr} {CONTACT.handle}
          </span>
        </a>
      </div>
    </header>
  );
}
