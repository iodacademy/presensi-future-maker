// Pembatas laju in-memory per proses / Per-process in-memory rate limiter

const hits = new Map<string, { count: number; resetAt: number }>();

/**
 * Mengembalikan false bila `key` sudah melewati `limit` panggilan dalam
 * `windowMs` terakhir.
 *
 * ponytail: state disimpan di memori proses. Cukup untuk satu instance Node
 * di Hostinger; bila nanti berjalan multi-instance, pindahkan ke Firestore
 * atau Redis dengan tanda tangan fungsi yang sama.
 *
 * Returns false when `key` has exceeded `limit` calls within the last
 * `windowMs`.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });

    // Buang entri kedaluwarsa agar Map tidak tumbuh tanpa batas dari IP acak.
    // Drop expired entries so the Map cannot grow unbounded from random IPs.
    if (hits.size > 10_000) {
      for (const [k, v] of hits) {
        if (v.resetAt <= now) hits.delete(k);
      }
    }
    return true;
  }

  entry.count += 1;
  return entry.count <= limit;
}
