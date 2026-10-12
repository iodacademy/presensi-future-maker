import { describe, expect, it } from 'vitest';
import { numberSessions } from '../../src/features/mentoring/progress';

describe('nomor sesi mentoring', () => {
  const b = (id: string, studentId: string, startsAt: string, status = 'confirmed', phase = 'bootcamp') => ({ id, studentId, startsAt, status, phase });

  it('menomori booking aktif per peserta menurut waktunya', () => {
    const n = numberSessions([b('x2', 'a', '2026-10-22'), b('x1', 'a', '2026-10-12'), b('y1', 'c', '2026-10-15')], 'bootcamp');
    expect([n.get('x1'), n.get('x2'), n.get('y1')]).toEqual([1, 2, 1]);
  });

  it('melewati booking yang dibatalkan dan fase lain', () => {
    // Setelah sesi pertama dibatalkan, sesi berikutnya menjadi sesi pertama.
    // Once the first session is cancelled, the next one becomes the first.
    const n = numberSessions([b('x1', 'a', '2026-10-12', 'cancelled'), b('x2', 'a', '2026-10-22'), b('z', 'a', '2026-10-01', 'confirmed', 'internship')], 'bootcamp');
    expect(n.get('x2')).toBe(1);
    expect(n.has('x1')).toBe(false);
    expect(n.has('z')).toBe(false);
  });
});
