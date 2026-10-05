import { useEffect, useRef } from 'react';
import { CATEGORY_COLORS, CATEGORY_LABELS, DEFECT_LABELS } from '../constants.js';

export function CategoryBadge({ category }) {
  const color = CATEGORY_COLORS[category] || '#94a3b8';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

export function DefectBadge({ type }) {
  return (
    <span className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-600">
      {DEFECT_LABELS[type] || type}
    </span>
  );
}

export function EngineBadge({ engine }) {
  const isAi = engine === 'claude';
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${isAi ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-200 text-slate-700'}`}>
      {isAi ? 'Claude AI' : 'Rules engine'}
    </span>
  );
}

export function ReviewBadge({ status }) {
  const styles = {
    pending: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-emerald-100 text-emerald-800',
    corrected: 'bg-indigo-100 text-indigo-800',
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[status] || ''}`}>{status}</span>;
}

export function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="AI confidence">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium tabular-nums">{pct}%</span>
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex items-center gap-2 text-slate-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-700 border-t-transparent" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function Card({ title, children, className = '', actions }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-slate-800">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function LogExcerpt({ lines, evidence = [], failureLine }) {
  const ev = new Set(evidence);
  const box = useRef(null);
  // Scroll the first evidence line into view inside the log box.
  useEffect(() => {
    const el = box.current?.querySelector('[data-evidence="true"]');
    if (el && box.current) box.current.scrollTop = Math.max(0, el.offsetTop - 60);
  }, [lines, evidence]);
  return (
    <div ref={box} className="relative max-h-[420px] overflow-auto rounded-lg bg-slate-900 py-2 font-mono text-xs leading-relaxed text-slate-200" tabIndex={0} aria-label="Log excerpt">
      {lines.map((l) => {
        const isEv = ev.has(l.n);
        const isFail = l.n === failureLine;
        return (
          <div key={l.n} data-evidence={isEv} className={`flex gap-3 px-3 ${isEv ? 'bg-amber-400/20' : ''}`}>
            <span className={`w-10 shrink-0 select-none text-right ${isEv ? 'font-bold text-amber-300' : 'text-slate-500'}`}>{l.n}</span>
            <span className={`whitespace-pre-wrap break-all ${isFail ? 'text-rose-300' : ''}`}>
              {l.text}
              {isEv && <span className="sr-only"> (evidence line)</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
