// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildStudentPerformance } from '../../src/features/dashboard/performance';

const now = '2026-10-07T12:00:00.000Z';
const base = {
  sessions: [
    { id: 's2', title: 'P2', startsAt: '2026-10-02T02:00:00.000Z', endsAt: '2026-10-02T09:00:00.000Z' },
    { id: 's1', title: 'P1', startsAt: '2026-10-01T02:00:00.000Z', endsAt: '2026-10-01T09:00:00.000Z' },
    { id: 's3', title: 'P3', startsAt: '2026-10-03T02:00:00.000Z', endsAt: '2026-10-03T09:00:00.000Z' },
    { id: 's4', title: 'P4', startsAt: '2026-10-09T02:00:00.000Z', endsAt: '2026-10-09T09:00:00.000Z' },
  ],
  attendance: [
    { sessionId: 's1', status: undefined },
    { sessionId: 's2', status: 'sick' as const },
  ],
  exams: [],
  attempts: [],
  tasks: [],
  submissions: [],
  nowIso: now,
};

describe('laporan performa peserta', () => {
  it('memberi status presensi per pertemuan, urut waktu', () => {
    const { attendance } = buildStudentPerformance(base);
    // Catatan lama tanpa status berarti hadir; pertemuan lewat tanpa catatan
    // berarti tidak hadir; yang belum berakhir masih mendatang.
    // Old records without a status mean present; a past meeting with no record
    // means absent; one not yet ended is still upcoming.
    expect(attendance.map((a) => [a.sessionId, a.status])).toEqual([
      ['s1', 'hadir'],
      ['s2', 'sakit'],
      ['s3', 'alpa'],
      ['s4', 'mendatang'],
    ]);
  });

  it('mengambil nilai terbaik dari percobaan yang selesai saja', () => {
    const { quizzes } = buildStudentPerformance({
      ...base,
      exams: [
        { id: 'k2', title: 'Kuis 2', kind: 'kuis', sessionId: 's2', passingScore: 70, questionCount: 5 },
        { id: 'pre', title: 'Pretest', kind: 'pretest', sessionId: null, passingScore: 0, questionCount: 5 },
        { id: 'kosong', title: 'Tanpa soal', kind: 'kuis', sessionId: 's1', passingScore: 70, questionCount: 0 },
      ],
      attempts: [
        { examId: 'k2', status: 'selesai', score: 60, passed: false },
        { examId: 'k2', status: 'selesai', score: 85, passed: true },
        { examId: 'k2', status: 'berlangsung', score: null, passed: null },
      ],
    });
    expect(quizzes.map((q) => q.id)).toEqual(['pre', 'k2']);
    expect(quizzes[1]).toMatchObject({ bestScore: 85, passed: true, attempts: 3 });
    expect(quizzes[0].bestScore).toBeNull();
  });

  it('membedakan tugas dinilai, menunggu nilai, belum, dan lewat tenggat', () => {
    const { tasks } = buildStudentPerformance({
      ...base,
      tasks: [
        { id: 'a', title: 'A', kind: 'daily', dueAt: '2026-10-01T16:59:00.000Z', order: 1 },
        { id: 'b', title: 'B', kind: 'daily', dueAt: '2026-10-02T16:59:00.000Z', order: 2 },
        { id: 'c', title: 'C', kind: 'daily', dueAt: '2026-10-03T16:59:00.000Z', order: 3 },
        { id: 'd', title: 'D', kind: 'daily', dueAt: '2026-10-20T16:59:00.000Z', order: 4 },
      ],
      submissions: [
        { taskId: 'a', score: 90, late: false },
        { taskId: 'b', score: null, late: true },
      ],
    });
    expect(tasks.map((t) => [t.id, t.status])).toEqual([
      ['a', 'dinilai'],
      ['b', 'menunggu'],
      ['c', 'lewat'],
      ['d', 'belum'],
    ]);
    expect(tasks[1].late).toBe(true);
  });
});
