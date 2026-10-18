import { Route, Routes } from 'react-router-dom';
import SiteHeader from './components/SiteHeader';
import Home from './pages/Home';
import ProjectPage from './pages/ProjectPage';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <>
      <SiteHeader />
      <Routes>
        {['', '/en', '/tr'].map((prefix) => [
          <Route key={`${prefix}-home`} path={prefix || '/'} element={<Home />} />,
          <Route key={`${prefix}-case`} path={`${prefix}/projects/:slug`} element={<ProjectPage />} />,
        ])}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
