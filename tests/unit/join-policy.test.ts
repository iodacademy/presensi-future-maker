import { describe, expect, it } from 'vitest';
import { countsAfterJoin, effectiveDueAt, isValidJoinDate, joinMoment } from '../../src/features/users/join-policy';
import { buildStudentPerformance } from '../../src/features/dashboard/performance';

describe('peserta yang bergabung di tengah program', () => {
  it('memakai tanggal bergabung dari awal harinya (WIB), atau waktu akun dibuat', () => {
    expect(joinMoment({ joinedAt: '2026-10-05', createdAt: '2026-09-01T00:00:00.000Z' })).toBe('2026-10-04T17:00:00.000Z');
    expect(joinMoment({ createdAt: '2026-10-09T03:00:00.000Z' })).toBe('2026-10-09T03:00:00.000Z');
    expect(joinMoment({})).toBe('');
  });

  it('mengabaikan tanggal yang tidak ada alih-alih menggagalkan dashboard', () => {
    // 2026-13-45 cocok dengan pola, tetapi toISOString() atasnya melempar galat.
    // 2026-13-45 matches the pattern, but toISOString() on it throws.
    expect(isValidJoinDate('2026-13-45')).toBe(false);
    expect(isValidJoinDate('2026-02-30')).toBe(false);
    expect(isValidJoinDate('2026-02-28')).toBe(true);
    expect(joinMoment({ joinedAt: '2026-13-45', createdAt: '2026-10-01T00:00:00.000Z' })).toBe('2026-10-01T00:00:00.000Z');
  });

  it('tidak menghitung yang berakhir sebelum bergabung, kecuali dikerjakan', () => {
    const join = '2026-10-05T00:00:00.000Z';
    expect(countsAfterJoin('2026-10-01T04:00:00.000Z', join, false)).toBe(false);
    expect(countsAfterJoin('2026-10-01T04:00:00.000Z', join, true)).toBe(true);
    expect(countsAfterJoin('2026-10-06T04:00:00.000Z', join, false)).toBe(true);
    // Tanpa tenggat masih dapat dikerjakan / With no deadline it can still be done
    expect(countsAfterJoin(null, join, false)).toBe(true);
    expect(countsAfterJoin('2026-10-01T04:00:00.000Z', '', false)).toBe(true);
  });

  it('menghapus tenggat yang lewat sebelum bergabung, sehingga pengumpulan dianggap tepat waktu', () => {
    const join = '2026-10-05T00:00:00.000Z';
    expect(effectiveDueAt('2026-10-01T16:59:00.000Z', join)).toBeNull();
    expect(effectiveDueAt('2026-10-09T16:59:00.000Z', join)).toBe('2026-10-09T16:59:00.000Z');
    expect(effectiveDueAt(null, join)).toBeNull();
    expect(effectiveDueAt('2026-10-01T16:59:00.000Z', '')).toBe('2026-10-01T16:59:00.000Z');
  });

  it('melewatkan pertemuan sebelum bergabung, tetapi tugas dan kuisnya tetap wajib tanpa tenggat', () => {
    const p = buildStudentPerformance({
      sessions: [
        { id: 'p1', title: 'P1', startsAt: '2026-10-01T02:00:00.000Z', endsAt: '2026-10-01T04:00:00.000Z' },
        { id: 'p2', title: 'P2', startsAt: '2026-10-02T02:00:00.000Z', endsAt: '2026-10-02T04:00:00.000Z' },
        { id: 'p3', title: 'P3', startsAt: '2026-10-08T02:00:00.000Z', endsAt: '2026-10-08T04:00:00.000Z' },
      ],
      // Ia tetap tercatat di P2 (mis. dicatat manual), jadi P2 tetap dihitung
      // He is still recorded at P2 (e.g. manually), so P2 still counts
      attendance: [{ sessionId: 'p2', status: 'present' }],
      exams: [
        { id: 'q1', title: 'Kuis 1', kind: 'kuis', sessionId: 'p1', passingScore: 70, questionCount: 5 },
        { id: 'q3', title: 'Kuis 3', kind: 'kuis', sessionId: 'p3', passingScore: 70, questionCount: 5 },
      ],
      attempts: [],
      tasks: [
        { id: 't1', title: 'T1', kind: 'daily', dueAt: '2026-10-01T16:59:00.000Z', order: 1 },
        { id: 't3', title: 'T3', kind: 'daily', dueAt: '2026-10-09T16:59:00.000Z', order: 3 },
      ],
      submissions: [],
      nowIso: '2026-10-10T00:00:00.000Z',
      joinIso: '2026-10-05T00:00:00.000Z',
    });
    expect(p.attendance.map((a) => a.sessionId)).toEqual(['p2', 'p3']);
    // Kuis dan tugas lama tetap ada; tugas lama tanpa tenggat sehingga belum "lewat".
    // Old quizzes and tasks stay; the old task has no deadline so it is not "lewat".
    expect(p.quizzes.map((q) => q.id)).toEqual(['q1', 'q3']);
    expect(p.tasks.map((t) => [t.id, t.dueAt, t.status])).toEqual([['t3', '2026-10-09T16:59:00.000Z', 'lewat'], ['t1', null, 'belum']]);
  });
});
