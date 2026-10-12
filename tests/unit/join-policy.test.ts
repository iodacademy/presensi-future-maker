import { describe, expect, it } from 'vitest';
import { countsAfterJoin, joinMoment } from '../../src/features/users/join-policy';
import { buildStudentPerformance } from '../../src/features/dashboard/performance';

describe('peserta yang bergabung di tengah program', () => {
  it('memakai tanggal bergabung dari awal harinya (WIB), atau waktu akun dibuat', () => {
    expect(joinMoment({ joinedAt: '2026-10-05', createdAt: '2026-09-01T00:00:00.000Z' })).toBe('2026-10-04T17:00:00.000Z');
    expect(joinMoment({ createdAt: '2026-10-09T03:00:00.000Z' })).toBe('2026-10-09T03:00:00.000Z');
    expect(joinMoment({})).toBe('');
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

  it('melewatkan pertemuan, tugas, dan kuis sebelum bergabung di laporan performa', () => {
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
    expect(p.quizzes.map((q) => q.id)).toEqual(['q3']);
    expect(p.tasks.map((t) => t.id)).toEqual(['t3']);
  });
});
