import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PageSelection from './pages/PageSelection';
import AuditProgress from './pages/AuditProgress';
import Results from './pages/Results';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/selection" element={<PageSelection />} />
        <Route path="/progress/:sessionId" element={<AuditProgress />} />
        <Route path="/results/:sessionId" element={<Results />} />
      </Routes>
    </BrowserRouter>
  );
}
