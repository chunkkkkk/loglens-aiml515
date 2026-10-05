import { CATEGORY_LABELS } from './schema.js';

// Builds an editable bug-report draft from a stored triage result.
export function buildBugReport(dto) {
  const t = dto.triage;
  const category = dto.review.finalCategory || t.category;
  const evidence = dto.excerpt
    .filter((l) => t.evidenceLines.includes(l.n))
    .map((l) => `    ${l.n}: ${l.text}`)
    .join('\n');

  return [
    `Title: [${dto.testCaseId}] ${CATEGORY_LABELS[category]} - ${t.failingStep} (build ${dto.build})`,
    '',
    `Test case: ${dto.testCaseId}`,
    `Build: ${dto.build}`,
    `Device: ${dto.device || 'n/a'}`,
    `Log file: ${dto.fileName}`,
    `Category: ${CATEGORY_LABELS[category]}`,
    `Defect type: ${t.defectType.replace('_', ' ').toLowerCase()}`,
    '',
    'Summary:',
    t.rootCause,
    '',
    t.causeCodes.length ? `Cause codes / timers: ${t.causeCodes.join(', ')}` : 'Cause codes / timers: none found',
    '',
    'Key log evidence:',
    evidence || '    (no evidence lines selected)',
    '',
    'Suggested next steps:',
    ...t.suggestedNextSteps.map((s, i) => `  ${i + 1}. ${s}`),
    '',
    `Triage engine: ${t.engine === 'claude' ? 'Claude (AI)' : 'LogLens rules'}; confidence ${Math.round(t.confidence * 100)}%.`,
    `Review status: ${dto.review.status}. Device identifiers were redacted before analysis.`,
  ].join('\n');
}
