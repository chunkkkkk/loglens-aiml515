import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { z } from 'zod';
import { redactLog } from '../services/redact.js';
import { extractFailureWindow } from '../services/extract.js';
import { analyzeLog } from '../services/aiAnalyzer.js';
import { findSimilar } from '../services/similarity.js';
import { buildBugReport } from '../services/bugReport.js';
import { CATEGORIES } from '../services/schema.js';
import * as store from '../db.js';

const router = express.Router();
const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 2);
const ALLOWED_EXT = new Set(['.log', '.txt']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return cb(new HttpError(400, 'Only .log or .txt files are allowed.'));
    cb(null, true);
  },
});

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const safeText = (max) => z.string().trim().min(1).max(max).regex(/^[\w .:/#()+-]+$/, 'contains unsupported characters');

const MetaSchema = z.object({
  testCaseId: safeText(60),
  build: safeText(60),
  device: z.string().trim().max(60).regex(/^[\w .:/#()+-]*$/, 'contains unsupported characters').optional().default(''),
});

const ReviewSchema = z.object({
  status: z.enum(['confirmed', 'corrected']),
  finalCategory: z.enum(CATEGORIES).optional(),
  notes: z.string().trim().max(1000).optional(),
}).refine((v) => v.status !== 'corrected' || v.finalCategory, { message: 'finalCategory is required when correcting', path: ['finalCategory'] });

const IdSchema = z.coerce.number().int().positive();

function parseId(req) {
  const parsed = IdSchema.safeParse(req.params.id);
  if (!parsed.success) throw new HttpError(400, 'Invalid id.');
  return parsed.data;
}

function loadDto(id) {
  const row = store.getRun(id);
  if (!row) throw new HttpError(404, 'Test run not found.');
  return store.toDto(row, { includeExcerpt: true });
}

// Upload and triage a failed test log.
router.post('/', upload.single('logFile'), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'Please attach a log file.');
    const meta = MetaSchema.safeParse(req.body);
    if (!meta.success) {
      throw new HttpError(400, meta.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    }

    const raw = req.file.buffer.toString('utf8');
    if (!raw.trim()) throw new HttpError(400, 'The log file is empty.');
    if (raw.includes('\u0000')) throw new HttpError(400, 'The file looks binary. Please upload a text log.');

    // 1) Redact identifiers first, so nothing sensitive is stored or sent to AI.
    const redacted = redactLog(raw);
    // 2) Keep only the window around the failure.
    const excerpt = extractFailureWindow(redacted.text);
    // 3) Analyze (Claude, or rules fallback).
    const { result, engine, warning } = await analyzeLog(excerpt, meta.data);

    const id = store.insertRun(
      {
        ...meta.data,
        fileName: path.basename(req.file.originalname).slice(0, 120),
        totalLines: excerpt.totalLines,
        failureLine: excerpt.failureLine,
        excerptLines: excerpt.lines,
        redactions: { total: redacted.total, counts: redacted.counts },
      },
      { ...result, engine },
    );

    res.status(201).json({ id, warning, run: loadDto(id) });
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const q = z.string().trim().max(100).optional().parse(req.query.q || undefined);
    const category = z.enum(CATEGORIES).optional().parse(req.query.category || undefined);
    const rows = store.listRuns({ q, category, limit: 100 });
    res.json(rows.map((r) => store.toDto(r)));
  } catch (err) {
    if (err instanceof z.ZodError) return next(new HttpError(400, 'Invalid filter.'));
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const dto = loadDto(parseId(req));
    const candidates = store.listRuns({ limit: 300 }).map((r) => store.toDto(r));
    res.json({ ...dto, similar: findSimilar(dto, candidates) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/bug-report', (req, res, next) => {
  try {
    res.json({ text: buildBugReport(loadDto(parseId(req))) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/review', (req, res, next) => {
  try {
    const id = parseId(req);
    const body = ReviewSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, body.error.issues.map((i) => i.message).join('; '));
    if (!store.updateReview(id, body.data)) throw new HttpError(404, 'Test run not found.');
    res.json(loadDto(id));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    if (!store.deleteRun(parseId(req))) throw new HttpError(404, 'Test run not found.');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
