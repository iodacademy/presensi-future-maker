import { describe, expect, it } from 'vitest';
import { checkRateLimit } from '../../src/lib/rate-limit';

describe('checkRateLimit', () => {
  it('mengizinkan tepat sebanyak limit lalu menolak', () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000)).toBe(true);
    }
    expect(checkRateLimit(key, 3, 60_000)).toBe(false);
  });

  it('memulai jendela baru setelah waktu habis', async () => {
    const key = `t-${Math.random()}`;
    expect(checkRateLimit(key, 1, 10)).toBe(true);
    expect(checkRateLimit(key, 1, 10)).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(checkRateLimit(key, 1, 10)).toBe(true);
  });

  it('menghitung tiap key secara terpisah', () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(checkRateLimit(a, 1, 60_000)).toBe(true);
    expect(checkRateLimit(a, 1, 60_000)).toBe(false);
    expect(checkRateLimit(b, 1, 60_000)).toBe(true);
  });
});
