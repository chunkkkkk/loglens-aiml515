import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { redactLog } from '../src/services/redact.js';
import { extractFailureWindow } from '../src/services/extract.js';
import { analyzeWithRules } from '../src/services/rulesAnalyzer.js';
import { TriageSchema } from '../src/services/schema.js';

const samples = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'sample-logs');
const read = (f) => fs.readFileSync(path.join(samples, f), 'utf8');

function triage(file) {
  const r = redactLog(read(file));
  return { redacted: r, result: TriageSchema.parse(analyzeWithRules(extractFailureWindow(r.text))) };
}

test('redacts IMEI, IMSI, phone and serial numbers', () => {
  const { text, counts } = redactLog('IMEI: 356938035643809 IMSI 001010123456789 MSISDN: +14255550142 ro.serialno=9A231FFAZ00412 call +1 425-555-0199');
  assert.ok(!/356938035643809|001010123456789|4255550142|9A231FFAZ00412|555-0199/.test(text));
  assert.equal(counts.IMEI, 1);
  assert.equal(counts.IMSI, 1);
});

test('extract window contains the failure line with original numbering', () => {
  const ex = extractFailureWindow(read('lte_rlf_t310.log'));
  assert.ok(ex.failureLine > 0);
  assert.ok(ex.lines.some((l) => l.n === ex.failureLine));
});

test('rules classify each sample correctly', () => {
  assert.equal(triage('lte_attach_reject_emm15.log').result.category, 'NAS_REGISTRATION_REJECT');
  assert.equal(triage('nr_handover_t304_expiry.log').result.category, 'HANDOVER_FAILURE');
  assert.equal(triage('adb_offline_setup_error.log').result.category, 'TEST_SETUP_ISSUE');
  assert.equal(triage('lte_rlf_t310.log').result.category, 'RADIO_LINK_FAILURE');
});

test('unknown log returns low-confidence UNKNOWN', () => {
  const r = TriageSchema.parse(analyzeWithRules(extractFailureWindow('hello\nworld\nall good')));
  assert.equal(r.category, 'UNKNOWN');
  assert.ok(r.confidence < 0.5);
});
