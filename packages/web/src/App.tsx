import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PageSelection from './pages/PageSelection';
import AuditProgress from './pages/AuditProgress';
import Results from './pages/Results';

export default function App() {
  return (
    <BrowserRouter>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-white focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Aller au contenu principal
      </a>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/selection" element={<PageSelection />} />
        <Route path="/progress/:sessionId" element={<AuditProgress />} />
        <Route path="/results/:sessionId" element={<Results />} />
      </Routes>
    </BrowserRouter>
  );
}
