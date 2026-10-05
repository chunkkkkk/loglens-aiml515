// Finds the part of a long test log that matters: the first strong failure
// signal plus surrounding context. Sending only this window keeps AI cost low
// and keeps unrelated data out of the prompt.

const FAILURE_PATTERNS = [
  /\bverdict\s*[:=]\s*fail/i,
  /\btest\s+(case\s+)?fail(ed|ure)?\b/i,
  /\breject\b/i,
  /\bradio link failure\b|\bRLF\b/i,
  /\bhandover\s*failure\b|\bHO\s*fail/i,
  /\bT3\d\d\b.*\bexpir/i,
  /\bFATAL EXCEPTION\b|\bmodem (crash|restart)\b|\bSSR\b/i,
  /\btimeout\b|\btimed out\b/i,
  /\b(error|failure|failed)\b/i,
];

const BEFORE = 30;
const AFTER = 15;
const MAX_LINES = 120;

export function extractFailureWindow(text) {
  const lines = text.split(/\r?\n/);
  let failIndex = -1;
  // Patterns are ordered strongest-first; the first pattern that matches anywhere wins.
  for (const re of FAILURE_PATTERNS) {
    const idx = lines.findIndex((l) => re.test(l));
    if (idx !== -1) {
      failIndex = idx;
      break;
    }
  }

  let start;
  let end;
  if (failIndex === -1) {
    start = Math.max(0, lines.length - MAX_LINES);
    end = lines.length;
  } else {
    start = Math.max(0, failIndex - BEFORE);
    end = Math.min(lines.length, failIndex + AFTER + 1);
  }
  if (end - start > MAX_LINES) start = end - MAX_LINES;

  const windowLines = [];
  for (let i = start; i < end; i++) {
    windowLines.push({ n: i + 1, text: lines[i].slice(0, 400) });
  }

  return {
    totalLines: lines.length,
    failureLine: failIndex === -1 ? null : failIndex + 1,
    lines: windowLines,
    numbered: windowLines.map((l) => `${l.n}: ${l.text}`).join('\n'),
  };
}
