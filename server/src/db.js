import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dataDir, 'loglens.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS test_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id    TEXT NOT NULL,
  build           TEXT NOT NULL,
  device          TEXT,
  file_name       TEXT NOT NULL,
  total_lines     INTEGER NOT NULL,
  failure_line    INTEGER,
  excerpt_json    TEXT NOT NULL,
  redactions_json TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS triage_results (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id            INTEGER NOT NULL UNIQUE REFERENCES test_runs(id) ON DELETE CASCADE,
  engine            TEXT NOT NULL,
  category          TEXT NOT NULL,
  defect_type       TEXT NOT NULL,
  failing_step      TEXT NOT NULL,
  root_cause        TEXT NOT NULL,
  confidence        REAL NOT NULL,
  evidence_json     TEXT NOT NULL,
  cause_codes_json  TEXT NOT NULL,
  next_steps_json   TEXT NOT NULL,
  review_status     TEXT NOT NULL DEFAULT 'pending',
  final_category    TEXT,
  reviewer_notes    TEXT,
  reviewed_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_results_category ON triage_results(category);
CREATE INDEX IF NOT EXISTS idx_runs_build ON test_runs(build);
`);

export function insertRun(run, triage) {
  const tx = db.transaction(() => {
    const info = db.prepare(`INSERT INTO test_runs
      (test_case_id, build, device, file_name, total_lines, failure_line, excerpt_json, redactions_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      run.testCaseId, run.build, run.device || null, run.fileName, run.totalLines,
      run.failureLine, JSON.stringify(run.excerptLines), JSON.stringify(run.redactions),
    );
    const runId = info.lastInsertRowid;
    db.prepare(`INSERT INTO triage_results
      (run_id, engine, category, defect_type, failing_step, root_cause, confidence, evidence_json, cause_codes_json, next_steps_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      runId, triage.engine, triage.category, triage.defectType, triage.failingStep, triage.rootCause,
      triage.confidence, JSON.stringify(triage.evidenceLines), JSON.stringify(triage.causeCodes),
      JSON.stringify(triage.suggestedNextSteps),
    );
    return Number(runId);
  });
  return tx();
}

const SELECT_JOINED = `
  SELECT r.id, r.test_case_id, r.build, r.device, r.file_name, r.total_lines, r.failure_line,
         r.excerpt_json, r.redactions_json, r.created_at,
         t.engine, t.category, t.defect_type, t.failing_step, t.root_cause, t.confidence,
         t.evidence_json, t.cause_codes_json, t.next_steps_json, t.review_status,
         t.final_category, t.reviewer_notes, t.reviewed_at
  FROM test_runs r JOIN triage_results t ON t.run_id = r.id`;

export function toDto(row, { includeExcerpt = false } = {}) {
  if (!row) return null;
  const dto = {
    id: row.id,
    testCaseId: row.test_case_id,
    build: row.build,
    device: row.device,
    fileName: row.file_name,
    totalLines: row.total_lines,
    failureLine: row.failure_line,
    createdAt: row.created_at,
    redactions: JSON.parse(row.redactions_json),
    triage: {
      engine: row.engine,
      category: row.category,
      defectType: row.defect_type,
      failingStep: row.failing_step,
      rootCause: row.root_cause,
      confidence: row.confidence,
      evidenceLines: JSON.parse(row.evidence_json),
      causeCodes: JSON.parse(row.cause_codes_json),
      suggestedNextSteps: JSON.parse(row.next_steps_json),
    },
    review: {
      status: row.review_status,
      finalCategory: row.final_category,
      notes: row.reviewer_notes,
      reviewedAt: row.reviewed_at,
    },
  };
  if (includeExcerpt) dto.excerpt = JSON.parse(row.excerpt_json);
  return dto;
}

export function getRun(id) {
  return db.prepare(`${SELECT_JOINED} WHERE r.id = ?`).get(id);
}

export function listRuns({ q, category, limit = 50 }) {
  const where = [];
  const params = [];
  if (category) {
    where.push('COALESCE(t.final_category, t.category) = ?');
    params.push(category);
  }
  if (q) {
    where.push('(r.test_case_id LIKE ? OR r.build LIKE ? OR t.root_cause LIKE ? OR t.failing_step LIKE ? OR t.cause_codes_json LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  const sql = `${SELECT_JOINED} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.id DESC LIMIT ?`;
  params.push(limit);
  return db.prepare(sql).all(...params);
}

export function updateReview(id, { status, finalCategory, notes }) {
  const info = db.prepare(`UPDATE triage_results
    SET review_status = ?, final_category = ?, reviewer_notes = ?, reviewed_at = datetime('now')
    WHERE run_id = ?`).run(status, finalCategory || null, notes || null, id);
  return info.changes > 0;
}

export function deleteRun(id) {
  return db.prepare('DELETE FROM test_runs WHERE id = ?').run(id).changes > 0;
}

export function stats() {
  const byCategory = db.prepare(`SELECT COALESCE(final_category, category) AS category, COUNT(*) AS count
    FROM triage_results GROUP BY 1 ORDER BY count DESC`).all();
  const byBuild = db.prepare(`SELECT r.build, COUNT(*) AS count FROM test_runs r GROUP BY r.build ORDER BY MAX(r.id) DESC LIMIT 10`).all();
  const byDefect = db.prepare(`SELECT defect_type AS defectType, COUNT(*) AS count FROM triage_results GROUP BY 1`).all();
  const totals = db.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN review_status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN review_status = 'corrected' THEN 1 ELSE 0 END) AS corrected,
      SUM(CASE WHEN review_status = 'pending' THEN 1 ELSE 0 END) AS pending,
      AVG(confidence) AS avgConfidence
    FROM triage_results`).get();
  const reviewed = (totals.confirmed || 0) + (totals.corrected || 0);
  return {
    totals: { ...totals, aiAgreementRate: reviewed ? (totals.confirmed || 0) / reviewed : null },
    byCategory,
    byBuild,
    byDefect,
  };
}
