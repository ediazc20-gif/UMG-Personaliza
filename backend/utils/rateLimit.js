/** Rate limit en memoria (por proceso). Suficiente para lab / single-node. */
function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 5 } = {}) {
  const hits = new Map();

  function prune(now) {
    for (const [key, entry] of hits.entries()) {
      if (now - entry.start >= windowMs) hits.delete(key);
    }
  }

  return function check(key) {
    const now = Date.now();
    prune(now);
    const k = String(key || 'anon');
    let entry = hits.get(k);
    if (!entry || now - entry.start >= windowMs) {
      entry = { start: now, count: 0 };
      hits.set(k, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      return {
        ok: false,
        retryAfterSec: Math.ceil((windowMs - (now - entry.start)) / 1000),
      };
    }
    return { ok: true, remaining: max - entry.count };
  };
}

module.exports = { createRateLimiter };
