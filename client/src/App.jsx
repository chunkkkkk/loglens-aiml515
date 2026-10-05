import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api } from './api.js';
import TriagePage from './pages/TriagePage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import RunDetailPage from './pages/RunDetailPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';

const navClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-white/15 text-white' : 'text-cyan-100 hover:bg-white/10 hover:text-white'}`;

export default function App() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: 'down' }));
  }, []);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="bg-gradient-to-r from-cyan-900 to-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2" aria-label="LogLens home">
            <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
              <circle cx="14" cy="14" r="9" fill="none" stroke="#67e8f9" strokeWidth="4" />
              <path d="M21 21l7 7" stroke="#67e8f9" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <div>
              <div className="text-lg font-bold leading-tight">LogLens</div>
              <div className="text-xs text-cyan-200">AI test-log triage for LTE / 5G QA</div>
            </div>
          </NavLink>
          <nav aria-label="Main" className="flex flex-wrap gap-1">
            <NavLink to="/" end className={navClass}>Triage</NavLink>
            <NavLink to="/history" className={navClass}>History</NavLink>
            <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
          </nav>
          <AiStatus health={health} />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<TriagePage health={health} />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/runs/:id" element={<RunDetailPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<p className="text-slate-600">Page not found.</p>} />
        </Routes>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-500">
        LogLens · AIML-515 Workshop 5 · AI results are suggestions; an engineer confirms every triage. Device identifiers are redacted before analysis.
      </footer>
    </div>
  );
}

function AiStatus({ health }) {
  if (!health) return <span className="text-xs text-cyan-200">Checking server…</span>;
  if (health.status !== 'ok') return <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200">Server offline</span>;
  const isAi = health.aiMode === 'claude';
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${isAi ? 'bg-emerald-400/20 text-emerald-200' : 'bg-amber-400/20 text-amber-200'}`}
      title={isAi ? `Model: ${health.model}` : 'Set ANTHROPIC_API_KEY in server/.env to enable Claude'}
    >
      {isAi ? '● Claude AI connected' : '● Rules mode (no API key)'}
    </span>
  );
}
