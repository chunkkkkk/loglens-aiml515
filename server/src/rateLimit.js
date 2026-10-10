// Small in-memory rate limiter (one app instance, no extra dependency).
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      res.set('Retry-After', String(Math.ceil((windowMs - (now - recent[0])) / 1000)));
      return res.status(429).json({ error: `Too many analyses from this address. Please try again later (limit ${max} per hour).` });
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    next();
  };
}
