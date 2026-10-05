// Finds previously triaged failures that look like the current one.
// MVP approach: weighted overlap of category, failing step and cause-code tokens.
// (A production version would use embeddings, e.g. pgvector.)

function tokens(dto) {
  const t = dto.triage;
  const text = [t.failingStep, ...t.causeCodes].join(' ').toLowerCase();
  return new Set(text.split(/[^a-z0-9#]+/).filter((w) => w.length > 2));
}

export function findSimilar(target, candidates, limit = 5) {
  const targetTokens = tokens(target);
  const targetCategory = target.review.finalCategory || target.triage.category;

  return candidates
    .filter((c) => c.id !== target.id)
    .map((c) => {
      const cTokens = tokens(c);
      const shared = [...targetTokens].filter((x) => cTokens.has(x)).length;
      const union = new Set([...targetTokens, ...cTokens]).size || 1;
      const sameCategory = (c.review.finalCategory || c.triage.category) === targetCategory;
      const score = (sameCategory ? 0.6 : 0) + 0.4 * (shared / union) + (c.testCaseId === target.testCaseId ? 0.1 : 0);
      return { id: c.id, testCaseId: c.testCaseId, build: c.build, category: c.review.finalCategory || c.triage.category, failingStep: c.triage.failingStep, reviewStatus: c.review.status, createdAt: c.createdAt, score: Math.round(score * 100) / 100 };
    })
    .filter((s) => s.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
