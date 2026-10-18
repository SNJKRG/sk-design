import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter/index.css';
import './styles/global.css';
import App from './App';

// Положение страниц восстанавливает приложение (галерея — из своего состояния).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function setScale() {
  // Типографика и поля масштабируются от desktop-макета 1536×1024.
  const s = Math.min(1.3, Math.max(0.8, window.innerWidth / 1536));
  document.documentElement.style.setProperty('--s', s.toFixed(4));
}
setScale();
window.addEventListener('resize', setScale);

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
