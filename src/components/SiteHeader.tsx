import { useLocation, useNavigate } from 'react-router-dom';
import { BRAND, CONTACT } from '../data/projects';

// Общая шапка: не размонтируется между маршрутами, поэтому логотип и контакт
// остаются на месте во время перехода.
export default function SiteHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  return (
    <header className={`site-header${isHome ? ' is-home' : ' is-inner'}`}>
      <a
        className="logo"
        href="/"
        aria-label={`${BRAND} — на главную`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          if (isHome) return;
          // Пришли из галереи — возвращаемся по истории, чтобы Back/Forward остались чистыми.
          if ((location.state as { fromHome?: boolean } | null)?.fromHome) navigate(-1);
          else navigate('/');
        }}
      >
        <picture>
          <source type="image/webp" srcSet="/media/brand/logo-420.webp" />
          <img src="/media/brand/logo-420.png" alt={BRAND} width={420} height={272} />
        </picture>
      </a>
      <a className="link-arrow contact" href={CONTACT.href} target="_blank" rel="noopener noreferrer">
        Обсудить проект <span aria-hidden="true">↗</span>
        <span className="sr-only"> в Telegram {CONTACT.handle}</span>
      </a>
    </header>
  );
}
