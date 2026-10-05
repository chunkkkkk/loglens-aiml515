import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Card, ErrorBanner, Spinner } from '../components/ui.jsx';

const MAX_MB = 2;
const FIELD_RE = /^[\w .:/#()+-]*$/;

const SAMPLE_META = {
  'lte_attach_reject_emm15.log': { testCaseId: 'TC_LTE_NAS_0112', build: 'AP3A.261005.001', device: 'Pixel test unit' },
  'nr_handover_t304_expiry.log': { testCaseId: 'TC_NR_MOB_0430', build: 'AP3A.261005.001', device: 'Pixel test unit' },
  'adb_offline_setup_error.log': { testCaseId: 'TC_IMS_VOLTE_0021', build: 'AP3A.261005.001', device: 'Pixel test unit' },
  'lte_rlf_t310.log': { testCaseId: 'TC_LTE_RRM_0217', build: 'AP3A.260928.002', device: 'Pixel test unit' },
};

function validate(form, file) {
  const errors = {};
  if (!file) errors.file = 'Choose a .log or .txt file.';
  else if (!/\.(log|txt)$/i.test(file.name)) errors.file = 'Only .log or .txt files are allowed.';
  else if (file.size > MAX_MB * 1024 * 1024) errors.file = `File is larger than ${MAX_MB} MB.`;
  else if (file.size === 0) errors.file = 'File is empty.';
  if (!form.testCaseId.trim()) errors.testCaseId = 'Test case ID is required.';
  else if (!FIELD_RE.test(form.testCaseId)) errors.testCaseId = 'Use letters, numbers, spaces and . _ - : / # ( ) + only.';
  if (!form.build.trim()) errors.build = 'Build number is required.';
  else if (!FIELD_RE.test(form.build)) errors.build = 'Use letters, numbers, spaces and . _ - : / # ( ) + only.';
  if (!FIELD_RE.test(form.device)) errors.device = 'Use letters, numbers, spaces and . _ - : / # ( ) + only.';
  return errors;
}

export default function TriagePage({ health }) {
  const navigate = useNavigate();
  const fileInput = useRef(null);
  const [form, setForm] = useState({ testCaseId: '', build: '', device: '' });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [samples, setSamples] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    api.samples().then(setSamples).catch(() => setSamples([]));
  }, []);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function pickFile(f) {
    setFile(f || null);
    setErrors((e) => ({ ...e, file: undefined }));
  }

  async function loadSample(name) {
    setServerError('');
    try {
      const text = await api.sample(name);
      pickFile(new File([text], name, { type: 'text/plain' }));
      setForm(SAMPLE_META[name] || { testCaseId: name.replace('.log', ''), build: 'DEMO', device: '' });
      setErrors({});
    } catch (err) {
      setServerError(err.message);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setServerError('');
    const v = validate(form, file);
    setErrors(v);
    if (Object.keys(v).length) return;

    const data = new FormData();
    data.append('logFile', file);
    data.append('testCaseId', form.testCaseId.trim());
    data.append('build', form.build.trim());
    data.append('device', form.device.trim());

    setSubmitting(true);
    try {
      const res = await api.upload(data);
      navigate(`/runs/${res.id}`, { state: { warning: res.warning, fresh: true } });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card title="Triage a failed test log">
          <p className="mb-4 text-sm text-slate-600">
            Upload a failed LTE/5G test log. LogLens redacts device identifiers, finds the failure window,
            and asks {health?.aiMode === 'claude' ? 'Claude' : 'the rules engine'} for a category, root cause and evidence lines.
          </p>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
              className={`rounded-lg border-2 border-dashed p-6 text-center transition ${dragOver ? 'border-cyan-600 bg-cyan-50' : 'border-slate-300'}`}
            >
              <label htmlFor="logFile" className="block cursor-pointer">
                <span className="block font-medium text-slate-800">{file ? file.name : 'Drop a log file here or click to browse'}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : `.log or .txt, up to ${MAX_MB} MB`}
                </span>
              </label>
              <input
                id="logFile" ref={fileInput} type="file" accept=".log,.txt" className="sr-only"
                aria-describedby={errors.file ? 'file-error' : undefined}
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              {errors.file && <p id="file-error" className="mt-2 text-sm text-rose-700">{errors.file}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="testCaseId" label="Test case ID *" value={form.testCaseId} onChange={update('testCaseId')} error={errors.testCaseId} placeholder="TC_LTE_NAS_0112" />
              <Field id="build" label="Build *" value={form.build} onChange={update('build')} error={errors.build} placeholder="AP3A.261005.001" />
              <Field id="device" label="Device" value={form.device} onChange={update('device')} error={errors.device} placeholder="Pixel test unit" />
            </div>

            <ErrorBanner message={serverError} />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit" disabled={submitting}
                className="rounded-lg bg-cyan-700 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Analyzing…' : 'Analyze log'}
              </button>
              {submitting && <Spinner label="Redacting, extracting and analyzing…" />}
              {!submitting && file && (
                <button type="button" className="text-sm text-slate-600 underline" onClick={() => { pickFile(null); if (fileInput.current) fileInput.current.value = ''; }}>
                  Clear file
                </button>
              )}
            </div>
          </form>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Try a sample log">
          {samples.length === 0 ? (
            <p className="text-sm text-slate-500">No sample logs found.</p>
          ) : (
            <ul className="space-y-2">
              {samples.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => loadSample(s)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-left font-mono text-xs hover:border-cyan-600 hover:bg-cyan-50">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="How it works">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>IMEI, IMSI, phone and serial numbers are redacted.</li>
            <li>Only the window around the failure is analyzed.</li>
            <li>AI output is validated against a strict schema.</li>
            <li>An engineer confirms or corrects every result.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}

function Field({ id, label, error, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        id={id} name={id} maxLength={60}
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm ${error ? 'border-rose-400' : 'border-slate-300'}`}
        {...props}
      />
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
