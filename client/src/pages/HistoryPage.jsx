import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { CATEGORY_LABELS, formatDate } from '../constants.js';
import { CategoryBadge, EngineBadge, ErrorBanner, ReviewBadge, Spinner } from '../components/ui.jsx';

export default function HistoryPage() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError('');
    // Debounce the search box so we don't query on every keystroke.
    const timer = setTimeout(() => {
      api.listRuns({ q: q.trim(), category })
        .then((data) => { if (!cancelled) setRuns(data); })
        .catch((err) => { if (!cancelled) setError(err.message); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q, category, reloadKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Triage history</h1>
        <Link to="/" className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800">+ New triage</Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">Search</label>
          <input
            id="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100}
            placeholder="Search test case, build, cause code or root cause…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
          />
        </div>
        <div>
          <label htmlFor="category" className="sr-only">Category</label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-64">
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />

      {runs === null && !error && <Spinner />}

      {runs && runs.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
          {q || category ? 'No runs match your filters.' : 'No logs triaged yet. Upload one from the Triage page.'}
        </p>
      )}

      {runs && runs.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Triaged test runs</caption>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Test case</th>
                <th scope="col" className="px-4 py-3">Build</th>
                <th scope="col" className="px-4 py-3">Category</th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">Engine</th>
                <th scope="col" className="px-4 py-3">Review</th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium"><Link to={`/runs/${r.id}`} className="text-cyan-700 hover:underline">{r.testCaseId}</Link></td>
                  <td className="px-4 py-3 font-mono text-xs">{r.build}</td>
                  <td className="px-4 py-3"><CategoryBadge category={r.review.finalCategory || r.triage.category} /></td>
                  <td className="hidden px-4 py-3 md:table-cell"><EngineBadge engine={r.triage.engine} /></td>
                  <td className="px-4 py-3"><ReviewBadge status={r.review.status} /></td>
                  <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
