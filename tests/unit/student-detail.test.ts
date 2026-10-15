// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// Firestore palsu yang memahami where '==' dan 'array-contains'.
// A fake Firestore that understands where '==' and 'array-contains'.
const data: Record<string, Record<string, Record<string, unknown>>> = {
  users: { s1: { uid: 's1', name: 'Ani', email: 'ani@x.id', role: 'student', active: true, classId: 'k1' }, m1: { uid: 'm1', role: 'mentor' } },
  classes: { k1: { canonicalName: 'Semarang - Data', city: 'Semarang', programName: 'Data' } },
  sessions: {
    p1: { id: 'p1', classId: 'k1', title: 'Pertemuan 1', startsAt: '2026-01-01T02:00:00.000Z', endsAt: '2026-01-01T04:00:00.000Z' },
    p2: { id: 'p2', classId: 'k9', classIds: ['k9', 'k1'], title: 'Pertemuan gabungan', startsAt: '2026-01-02T02:00:00.000Z', endsAt: '2026-01-02T04:00:00.000Z' },
    p3: { id: 'p3', classId: 'k9', title: 'Kelas lain', startsAt: '2026-01-03T02:00:00.000Z', endsAt: '2026-01-03T04:00:00.000Z' },
  },
  attendance: { a1: { studentId: 's1', sessionId: 'p1' }, a2: { studentId: 's1', sessionId: 'p2', status: 'excused' } },
  tasks: { t1: { id: 't1', classId: 'k1', published: true, title: 'Tugas 1', kind: 'daily', dueAt: null, order: 1 } },
  submissions: { x9: { studentId: 's1', taskId: 't9', score: null, late: false, url: 'javascript:alert(1)', fileName: null, submittedAt: '2025-12-01T00:00:00.000Z', feedbackPreview: null }, x1: { studentId: 's1', taskId: 't1', score: 88, late: false, url: 'https://drive.google.com/x', fileName: null, submittedAt: '2026-01-01T06:00:00.000Z', feedbackPreview: 'Rapi' } },
  exams: { e1: { id: 'e1', classId: 'k1', published: true, title: 'Pretest', kind: 'pretest', sessionId: null, passingScore: 70, questionCount: 10 } },
  examAttempts: { at1: { studentId: 's1', examId: 'e1', status: 'selesai', score: 60, passed: false } },
  bookings: {
    b1: { studentId: 's1', mentorName: 'Galang', date: '2026-01-10', startTime: '10:00', endTime: '10:45', status: 'confirmed', phase: 'bootcamp' },
    b2: { studentId: 's1', mentorName: 'Galang', date: '2026-01-05', startTime: '10:00', endTime: '10:45', status: 'cancelled', phase: 'bootcamp' },
  },
  surveyResponses: {
    r1: { studentId: 's1', formTitle: 'Feedback', sessionTitle: 'Pertemuan 1', sessionDate: '2026-01-01', submittedAt: '2026-01-01T05:00:00.000Z', answers: [{ questionText: 'Kesan?', kind: 'teks', value: 'Seru' }] },
    r2: { studentId: 's1', formTitle: 'Feedback', sessionTitle: 'Pertemuan 2', sessionDate: '2026-01-02', submittedAt: '2026-01-02T05:00:00.000Z', answers: [] },
    r3: { studentId: 'lain', formTitle: 'Feedback', sessionTitle: 'X', sessionDate: '', submittedAt: '', answers: [] },
  },
  studentProfiles: { s1: { id: 's1', birthDate: '2000-01-01', gender: 'perempuan', disability: 'tidak-ada', disabilityNote: '', entryStatus: 'mahasiswa', phone: '0812345678' } },
  studentNotes: { s1: { note: 'Sering terlambat', followUp: '' } },
  assignments: { s1_bootcamp: { studentId: 's1', mentorId: 'mt1', phase: 'bootcamp' } },
  mentoringSlots: {},
};

function query(name: string, filters: [string, string, unknown][] = []) {
  return {
    where: (f: string, op: string, v: unknown) => query(name, [...filters, [f, op, v]]),
    select: () => query(name, filters),
    limit: () => query(name, filters),
    get: async () => {
      const docs = Object.entries(data[name] ?? {})
        .filter(([, d]) => filters.every(([f, op, v]) => (op === 'array-contains' ? ((d[f] as unknown[]) ?? []).includes(v) : d[f] === v)))
        .map(([id, d]) => ({ id, data: () => d }));
      return { docs, empty: docs.length === 0 };
    },
  };
}
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    collection: (name: string) => ({
      ...query(name),
      doc: (id: string) => ({ get: async () => ({ exists: !!data[name]?.[id], data: () => data[name]?.[id] }) }),
    }),
  }),
}));

import { getStudentDetail } from '../../src/features/dashboard/student-detail-service';

const admin = { uid: 'ad', email: 'a@x.id', name: 'Admin', role: 'admin' as const, classId: null };

describe('detail progres peserta', () => {
  it('menggabungkan pertemuan kelasnya sendiri dan pertemuan gabungan, beserta statusnya', async () => {
    const d = await getStudentDetail(admin, 's1');
    expect(d.student).toMatchObject({ name: 'Ani', className: 'Semarang - Data', city: 'Semarang' });
    expect(d.performance.attendance.map((a) => [a.sessionId, a.status])).toEqual([['p1', 'hadir'], ['p2', 'izin']]);
    expect(d.performance.tasks[0]).toMatchObject({ status: 'dinilai', score: 88 });
    expect(d.performance.quizzes[0]).toMatchObject({ kind: 'pretest', bestScore: 60 });
  });

  it('memuat mentoring, profil, dan feedback milik peserta itu saja, terbaru lebih dulu', async () => {
    const d = await getStudentDetail(admin, 's1');
    expect(d.mentoring.used).toBe(1);
    expect(d.mentoring.bookings.map((b) => b.status)).toEqual(['cancelled', 'confirmed']);
    expect(d.profile).toMatchObject({ gender: 'Perempuan', entryStatus: 'Mahasiswa' });
    expect(d.feedback!.map((f) => f.sessionTitle)).toEqual(['Pertemuan 2', 'Pertemuan 1']);
    expect(d.feedback![1].answers[0]).toEqual({ questionText: 'Kesan?', kind: 'teks', value: 'Seru' });
    expect(d.note).toEqual({ note: 'Sering terlambat', followUp: '' });
  });

  it('terbuka bagi mentornya tanpa feedback dan catatan admin', async () => {
    // Feedback ditujukan kepada penyelenggara; peserta tidak mengira mentornya ikut membaca.
    // Feedback is addressed to the organisers; participants do not expect their mentor to read it.
    const d = await getStudentDetail({ ...admin, uid: 'mt1', role: 'mentor' }, 's1');
    expect(d.performance.attendance).toHaveLength(2);
    expect(d.feedback).toBeNull();
    expect(d.note).toBeNull();
    // Hasil tugasnya tetap terlihat agar mentor punya konteks saat mentoring.
    // The task work stays visible so the mentor has context in the session.
    // Tautan selain https dari dokumen lama dibuang / Non-https links from old documents are dropped
    expect(d.submissions.find((x) => x.taskId === 't9')?.url).toBeNull();
    expect(d.submissions.filter((x) => x.taskId === 't1')).toEqual([{ taskId: 't1', url: 'https://drive.google.com/x', fileName: null, submittedAt: '2026-01-01T06:00:00.000Z', late: false, score: 88, feedbackPreview: 'Rapi' }]);
  });

  it('tertutup bagi mentor lain, peserta, dan akun bukan peserta', async () => {
    await expect(getStudentDetail({ ...admin, uid: 'mt2', role: 'mentor' }, 's1')).rejects.toThrow(/bukan peserta bimbingan/);
    await expect(getStudentDetail({ ...admin, role: 'student' }, 's1')).rejects.toThrow(/admin atau mentor/);
    await expect(getStudentDetail(admin, 'm1')).rejects.toThrow(/tidak ditemukan/);
  });
});
