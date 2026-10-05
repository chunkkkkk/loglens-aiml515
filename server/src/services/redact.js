// Removes device and subscriber identifiers from a log BEFORE it is stored
// or sent to any AI service. Order matters: labeled patterns run first so
// we can report what kind of identifier was removed.

const RULES = [
  { type: 'IMEI', re: /\b(IMEI(?:SV)?\s*[:=#]?\s*)(\d{14,16})\b/gi, keepPrefix: true },
  { type: 'IMSI', re: /\b(IMSI\s*[:=#]?\s*)(\d{14,15})\b/gi, keepPrefix: true },
  { type: 'ICCID', re: /\b(ICCID\s*[:=#]?\s*)(\d{18,20}F?)\b/gi, keepPrefix: true },
  { type: 'MSISDN', re: /\b(MSISDN\s*[:=#]?\s*)(\+?\d{10,15})\b/gi, keepPrefix: true },
  { type: 'SERIAL', re: /\b((?:serial(?:no)?|ro\.serialno|adb serial)\s*[:=#]?\s*)([A-Z0-9]{8,20})\b/gi, keepPrefix: true },
  // Unlabeled phone numbers such as +1 425-555-0199 or +14255550199
  { type: 'PHONE', re: /\+\d{1,3}[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}\b/g, keepPrefix: false },
  // Any remaining bare 15-digit number is almost always an IMEI or IMSI
  { type: 'ID', re: /\b\d{15}\b/g, keepPrefix: false },
];

export function redactLog(text) {
  const counts = {};
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.re, (match, prefix) => {
      counts[rule.type] = (counts[rule.type] || 0) + 1;
      return rule.keepPrefix ? `${prefix}[${rule.type}_REDACTED]` : `[${rule.type}_REDACTED]`;
    });
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { text: out, counts, total };
}
