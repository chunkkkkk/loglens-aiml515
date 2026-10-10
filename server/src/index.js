import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import logsRouter from './routes/logs.js';
import { stats } from './db.js';
import { aiMode } from './services/aiAnalyzer.js';
import { CATEGORIES, CATEGORY_LABELS } from './services/schema.js';
import { rateLimit } from './rateLimit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.join(__dirname, '..', '..', 'sample-logs');
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');

const app = express();
app.disable('x-powered-by');
// Behind the AWS load balancer / nginx proxy, trust the first proxy so client IPs are correct.
app.set('trust proxy', 1);
// The AWS URL is plain HTTP, so do not force browsers to upgrade requests to HTTPS.
app.use(helmet({
  contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
  strictTransportSecurity: false,
}));
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/] }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', aiMode: aiMode(), model: aiMode() === 'claude' ? (process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5') : null });
});

app.get('/api/meta', (req, res) => {
  res.json({ categories: CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })) });
});

app.get('/api/stats', (req, res) => res.json(stats()));

// Sample logs for demos (read-only, fixed list, no user-controlled paths).
app.get('/api/samples', (req, res) => {
  const files = fs.existsSync(SAMPLES_DIR) ? fs.readdirSync(SAMPLES_DIR).filter((f) => f.endsWith('.log')) : [];
  res.json(files.sort());
});
app.get('/api/samples/:name', (req, res) => {
  const files = fs.existsSync(SAMPLES_DIR) ? fs.readdirSync(SAMPLES_DIR) : [];
  if (!files.includes(req.params.name)) return res.status(404).json({ error: 'Sample not found.' });
  res.type('text/plain').send(fs.readFileSync(path.join(SAMPLES_DIR, req.params.name), 'utf8'));
});

// Limit AI analyses per visitor so a public URL cannot run up API costs.
app.post('/api/logs', rateLimit({ windowMs: 60 * 60 * 1000, max: Number(process.env.RATE_LIMIT_PER_HOUR || 20) }));
app.use('/api/logs', logsRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Serve the built React app if it exists (production mode).
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

// Central error handler: never leak stack traces to the browser.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `File is too large (max ${process.env.MAX_UPLOAD_MB || 2} MB).` : 'Upload error.';
    return res.status(400).json({ error: msg });
  }
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status === 500) console.error('[LogLens] Unexpected error:', err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong on the server.' : err.message });
});

const PORT = Number(process.env.PORT || 3001);
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`LogLens API running on http://localhost:${PORT}  (AI mode: ${aiMode()})`);
  });
}

export default app;
