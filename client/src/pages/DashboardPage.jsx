import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api.js';
import { CATEGORY_COLORS, CATEGORY_LABELS, DEFECT_LABELS } from '../constants.js';
import { Card, ErrorBanner, Spinner } from '../components/ui.jsx';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.stats().then(setData).catch((err) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return <Spinner label="Loading dashboard…" />;

  const { totals } = data;
  const byCategory = data.byCategory.map((c) => ({ ...c, label: CATEGORY_LABELS[c.category] || c.category }));
  const agreement = totals.aiAgreementRate == null ? '—' : `${Math.round(totals.aiAgreementRate * 100)}%`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Failure dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Logs triaged" value={totals.total || 0} />
        <Stat label="Pending review" value={totals.pending || 0} />
        <Stat label="AI agreement" value={agreement} hint="Confirmed ÷ reviewed (target ≥ 85%)" />
        <Stat label="Avg. confidence" value={totals.avgConfidence == null ? '—' : `${Math.round(totals.avgConfidence * 100)}%`} />
      </div>

      {totals.total === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">No data yet. Triage a few logs to fill the dashboard.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Failures by category">
            <div className="h-72" role="img" aria-label={`Failures by category: ${byCategory.map((c) => `${c.label} ${c.count}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory} layout="vertical" margin={{ left: 20, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Failures" radius={[0, 4, 4, 0]}>
                    {byCategory.map((c) => <Cell key={c.category} fill={CATEGORY_COLORS[c.category] || '#94a3b8'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Failures by build">
            <div className="h-72" role="img" aria-label={`Failures by build: ${data.byBuild.map((b) => `${b.build} ${b.count}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byBuild} margin={{ right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="build" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Failures" fill="#0e7490" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Defect type split" className="lg:col-span-2">
            <ul className="flex flex-wrap gap-3">
              {data.byDefect.map((d) => (
                <li key={d.defectType} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
                  <span className="font-semibold">{d.count}</span> {DEFECT_LABELS[d.defectType] || d.defectType}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
