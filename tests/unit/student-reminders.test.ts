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

  // Kuis ditagih mengikuti urutan pretest -> kuis sesi -> postest: hanya kuis
  // yang sudah terbuka, belum pernah selesai, dan masih boleh dimulai.
  // Quizzes are chased in pretest -> session quiz -> posttest order: only those
  // already open, never finished, and still startable.
  const baseExams: { id: string; title: string; kind: string; sessionId: string | null; dueAt: string | null; questionCount: number }[] = [
    { id: 'pre', title: 'Pretest', kind: 'pretest', sessionId: null, dueAt: null, questionCount: 5 },
    { id: 'k1', title: 'Kuis Sesi 1', kind: 'kuis', sessionId: 's1', dueAt: null, questionCount: 5 },
    { id: 'k2', title: 'Kuis Sesi 2', kind: 'kuis', sessionId: 's2', dueAt: null, questionCount: 5 },
    { id: 'k9', title: 'Kuis Sesi 9', kind: 'kuis', sessionId: 's9', dueAt: null, questionCount: 5 },
    { id: 'kosong', title: 'Tanpa soal', kind: 'kuis', sessionId: 's1', dueAt: null, questionCount: 0 },
    { id: 'post', title: 'Postest', kind: 'posttest', sessionId: null, dueAt: null, questionCount: 5 },
  ];
  const setup = (examAttempts: object[], exams = baseExams) =>
    Object.assign(data, {
      sessions: [
        { id: 's1', title: 'Pertemuan 1', startsAt: past },
        { id: 's2', title: 'Pertemuan 2', startsAt: past },
        { id: 's9', title: 'Pertemuan 9', startsAt: future },
      ],
      attendance: [],
      surveyForms: [],
      surveyResponses: [],
      exams,
      examAttempts,
    });

  it('menagih pretest lebih dulu selama belum dikerjakan', async () => {
    setup([]);
    expect((await listStudentReminders(actor)).exams.map((e) => e.id)).toEqual(['pre']);
  });

  it('menagih kuis sesi berikutnya setelah pretest, termasuk yang sedang berjalan', async () => {
    setup([{ examId: 'pre', status: 'selesai', passed: true }]);
    expect((await listStudentReminders(actor)).exams.map((e) => e.id)).toEqual(['k1']);
    setup([{ examId: 'pre', status: 'selesai', passed: true }, { examId: 'k1', status: 'berlangsung', passed: null }]);
    expect((await listStudentReminders(actor)).exams.map((e) => e.id)).toEqual(['k1']);
  });

  it('melewati kuis yang lewat batas waktu tanpa mengunci yang sesudahnya', async () => {
    setup([{ examId: 'pre', status: 'selesai', passed: true }], baseExams.map((e) => (e.id === 'k1' ? { ...e, dueAt: past } : e)));
    // Pertemuan 9 belum dimulai dan postest menunggu pertemuan terakhir.
    // Meeting 9 has not started and the posttest waits for the last meeting.
    expect((await listStudentReminders(actor)).exams.map((e) => e.id)).toEqual(['k2']);
  });

  it('tidak menagih apa pun bila peserta belum punya kelas', async () => {
    expect(await listStudentReminders({ ...actor, classId: null })).toEqual({ surveys: [], exams: [] });
  });
});
