import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { CATEGORY_LABELS, formatDate } from '../constants.js';
import {
  Card, CategoryBadge, ConfidenceBar, DefectBadge, EngineBadge, ErrorBanner, LogExcerpt, ReviewBadge, Spinner,
} from '../components/ui.jsx';

export default function RunDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRun(await api.getRun(id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function onDelete() {
    if (!window.confirm('Delete this test run and its triage result?')) return;
    try {
      await api.deleteRun(id);
      navigate('/history');
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading && !run) return <Spinner label="Loading triage result…" />;
  if (error && !run) return <ErrorBanner message={error} onRetry={load} />;
  if (!run) return null;

  const t = run.triage;
  const warning = location.state?.warning;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/history" className="text-sm text-cyan-700 hover:underline">← All runs</Link>
          <h1 className="mt-1 text-2xl font-bold">{run.testCaseId}</h1>
          <p className="text-sm text-slate-600">
            Build {run.build}{run.device ? ` · ${run.device}` : ''} · {run.fileName} · {run.totalLines} lines · {formatDate(run.createdAt)}
          </p>
        </div>
        <button type="button" onClick={onDelete} className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50">
          Delete run
        </button>
      </div>

      {warning && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{warning}</div>}
      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="AI triage result" className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <CategoryBadge category={t.category} />
            <DefectBadge type={t.defectType} />
            <EngineBadge engine={t.engine} />
            <ReviewBadge status={run.review.status} />
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Failing step</dt>
              <dd className="mt-1 font-medium">{t.failingStep}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confidence</dt>
              <dd className="mt-1"><ConfidenceBar value={t.confidence} /></dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Root cause</dt>
              <dd className="mt-1 leading-relaxed text-slate-800">{t.rootCause}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cause codes / timers</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {t.causeCodes.length ? t.causeCodes.map((c) => (
                  <code key={c} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{c}</code>
                )) : <span className="text-sm text-slate-500">None found</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Privacy</dt>
              <dd className="mt-1 text-sm text-slate-700">
                {run.redactions.total} identifier{run.redactions.total === 1 ? '' : 's'} redacted
                {run.redactions.total > 0 && ` (${Object.entries(run.redactions.counts).map(([k, v]) => `${k} ×${v}`).join(', ')})`}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested next steps</dt>
              <dd>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
                  {t.suggestedNextSteps.map((s) => <li key={s}>{s}</li>)}
                </ol>
              </dd>
            </div>
          </dl>
        </Card>

        <ReviewPanel run={run} onSaved={setRun} />
      </div>

      <Card title={`Log evidence (lines ${run.excerpt[0]?.n}–${run.excerpt[run.excerpt.length - 1]?.n})`}>
        <p className="mb-2 text-xs text-slate-500">Highlighted lines are the evidence the analysis cited. The failure line is shown in red.</p>
        <LogExcerpt lines={run.excerpt} evidence={t.evidenceLines} failureLine={run.failureLine} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <SimilarPanel similar={run.similar} />
        <BugReportPanel id={run.id} reviewStatus={run.review.status} />
      </div>
    </div>
  );
}

function ReviewPanel({ run, onSaved }) {
  const [mode, setMode] = useState('confirm');
  const [finalCategory, setFinalCategory] = useState(run.review.finalCategory || run.triage.category);
  const [notes, setNotes] = useState(run.review.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    if (mode === 'correct' && finalCategory === run.triage.category) {
      setError('Pick a different category to correct the AI, or choose Confirm.');
      return;
    }
    setSaving(true);
    try {
      const body = mode === 'confirm'
        ? { status: 'confirmed', notes: notes || undefined }
        : { status: 'corrected', finalCategory, notes: notes || undefined };
      const updated = await api.review(run.id, body);
      onSaved({ ...run, ...updated });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Engineer review">
      {run.review.status !== 'pending' && (
        <p className="mb-3 text-sm text-slate-600">
          Last review: <ReviewBadge status={run.review.status} />
          {run.review.finalCategory && <> → {CATEGORY_LABELS[run.review.finalCategory]}</>}
        </p>
      )}
      <form onSubmit={save} className="space-y-3">
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">Is the AI result correct?</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" name="mode" checked={mode === 'confirm'} onChange={() => setMode('confirm')} /> Confirm</label>
            <label className="flex items-center gap-1.5"><input type="radio" name="mode" checked={mode === 'correct'} onChange={() => setMode('correct')} /> Correct it</label>
          </div>
        </fieldset>
        {mode === 'correct' && (
          <div>
            <label htmlFor="finalCategory" className="mb-1 block text-sm font-medium text-slate-700">Correct category</label>
            <select id="finalCategory" value={finalCategory} onChange={(e) => setFinalCategory(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">Notes (optional)</label>
          <textarea id="notes" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <ErrorBanner message={error} />
        {saved && <p role="status" className="text-sm text-emerald-700">Review saved.</p>}
        <button type="submit" disabled={saving} className="w-full rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-900 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save review'}
        </button>
      </form>
    </Card>
  );
}

function SimilarPanel({ similar = [] }) {
  return (
    <Card title="Similar past failures">
      {similar.length === 0 ? (
        <p className="text-sm text-slate-500">No similar failures yet. As more logs are triaged, matches will appear here.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {similar.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <Link to={`/runs/${s.id}`} className="font-medium text-cyan-700 hover:underline">{s.testCaseId}</Link>
                <div className="text-xs text-slate-500">Build {s.build} · {s.failingStep}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ReviewBadge status={s.reviewStatus} />
                <span className="text-xs tabular-nums text-slate-500">{Math.round(s.score * 100)}% match</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BugReportPanel({ id, reviewStatus }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const res = await api.bugReport(id);
      setText(res.text);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed. Select the text and copy it manually.');
    }
  }

  return (
    <Card
      title="Draft bug report"
      actions={text && <button type="button" onClick={copy} className="text-sm font-medium text-cyan-700 hover:underline">{copied ? 'Copied!' : 'Copy'}</button>}
    >
      {reviewStatus === 'pending' && <p className="mb-2 text-xs text-amber-700">Tip: confirm or correct the triage first so the report uses the reviewed category.</p>}
      {!text && (
        <button type="button" onClick={generate} disabled={loading} className="rounded-lg border border-cyan-700 px-4 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-60">
          {loading ? 'Generating…' : 'Generate draft'}
        </button>
      )}
      <ErrorBanner message={error} />
      {text && (
        <>
          <label htmlFor="bugText" className="sr-only">Bug report draft</label>
          <textarea id="bugText" value={text} onChange={(e) => setText(e.target.value)} rows={14} className="w-full rounded-md border border-slate-300 p-3 font-mono text-xs" />
        </>
      )}
    </Card>
  );
}
