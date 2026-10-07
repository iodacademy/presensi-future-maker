// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// Firestore palsu: setiap koleksi mengembalikan isi yang sudah disaring, sebab
// yang diuji di sini adalah penyaringan di dalam layanan, bukan kuerinya.
// Fake Firestore: each collection returns pre-filtered contents, since what is
// tested here is the service's own filtering, not its queries.
const data: Record<string, object[]> = {};
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    collection: (name: string) => {
      const query = {
        where: () => query,
        select: () => query,
        get: async () => ({ docs: (data[name] ?? []).map((d) => ({ data: () => d })) }),
      };
      return query;
    },
  }),
}));

import { listStudentReminders } from '../../src/features/dashboard/reminder-service';

const actor = { uid: 'u1', email: 'a@b.c', name: 'Rama', role: 'student' as const, classId: 'k1' };
const past = '2026-01-01T00:00:00.000Z';
const future = '2999-01-01T00:00:00.000Z';
const allScope = { classIds: [], sessionIds: [] };

describe('pengingat peserta', () => {
  it('menagih survei hanya untuk pertemuan yang dihadiri dan belum diisi', async () => {
    Object.assign(data, {
      sessions: [
        { id: 's1', title: 'Pertemuan 1', startsAt: past },
        { id: 's2', title: 'Pertemuan 2', startsAt: past },
        { id: 's3', title: 'Pertemuan 3', startsAt: past },
      ],
      attendance: [{ sessionId: 's1' }, { sessionId: 's2' }],
      surveyForms: [
        { id: 'f1', title: 'Evaluasi', scope: allScope, questions: [{}] },
        { id: 'f2', title: 'Kelas lain', scope: { classIds: ['k9'], sessionIds: [] }, questions: [{}] },
        { id: 'f3', title: 'Kosong', scope: allScope, questions: [] },
      ],
      surveyResponses: [{ formId: 'f1', sessionId: 's2' }],
      exams: [],
      examAttempts: [],
    });
    const { surveys } = await listStudentReminders(actor);
    // s2 sudah diisi, s3 tidak dihadiri, f2 di luar cakupan, f3 tanpa pertanyaan.
    // s2 is answered, s3 not attended, f2 out of scope, f3 has no questions.
    expect(surveys).toEqual([{ formId: 'f1', formTitle: 'Evaluasi', sessionId: 's1', sessionTitle: 'Pertemuan 1' }]);
  });

  it('menagih kuis yang belum pernah selesai dan masih boleh dimulai', async () => {
    Object.assign(data, {
      sessions: [
        { id: 's1', title: 'Pertemuan 1', startsAt: past },
        { id: 's9', title: 'Pertemuan 9', startsAt: future },
      ],
      attendance: [],
      surveyForms: [],
      surveyResponses: [],
      exams: [
        { id: 'e-baru', title: 'Belum dikerjakan', sessionId: 's1', dueAt: null, questionCount: 5 },
        { id: 'e-jalan', title: 'Sedang berjalan', sessionId: 's1', dueAt: null, questionCount: 5 },
        { id: 'e-selesai', title: 'Sudah selesai', sessionId: 's1', dueAt: null, questionCount: 5 },
        { id: 'e-lewat', title: 'Batas lewat', sessionId: 's1', dueAt: past, questionCount: 5 },
        { id: 'e-depan', title: 'Pertemuan mendatang', sessionId: 's9', dueAt: null, questionCount: 5 },
        { id: 'e-kosong', title: 'Tanpa soal', sessionId: 's1', dueAt: null, questionCount: 0 },
        { id: 'e-pretest', title: 'Pretest', sessionId: null, dueAt: null, questionCount: 5 },
      ],
      examAttempts: [
        { examId: 'e-jalan', status: 'berlangsung', passed: null },
        { examId: 'e-selesai', status: 'selesai', passed: false },
      ],
    });
    const { exams } = await listStudentReminders(actor);
    expect(exams.map((e) => e.id).sort()).toEqual(['e-baru', 'e-jalan', 'e-pretest']);
  });

  it('tidak menagih apa pun bila peserta belum punya kelas', async () => {
    expect(await listStudentReminders({ ...actor, classId: null })).toEqual({ surveys: [], exams: [] });
  });
});
