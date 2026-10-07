// Pengingat survei dan kuis yang belum dikerjakan peserta / Reminders for participant surveys and quizzes not yet done
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import type { SurveyFormDocument } from '../survey/types';
import { scopeCovers } from '../survey/policy';
import { canStartAttempt } from '../exams/policy';
import type { StudentReminders } from './types';

/**
 * Menyusun daftar survei dan kuis yang masih menunggu peserta.
 *
 * Survei hanya ditagih untuk pertemuan yang kehadirannya tercatat -- aturan
 * yang sama dengan halaman jadwal; peserta yang tidak hadir tidak punya
 * pengalaman pertemuan itu untuk dinilai. Kuis ditagih bila belum pernah
 * diselesaikan dan masih boleh dimulai, dan hanya setelah pertemuannya
 * dimulai: menagih kuis pertemuan yang belum berlangsung hanya menambah
 * derau.
 *
 * Dipanggil dari layout peserta, yang hanya berjalan saat aplikasi dibuka
 * atau dimuat ulang -- bukan pada setiap perpindahan halaman.
 *
 * Builds the list of surveys and quizzes still waiting on a participant.
 *
 * Surveys are asked only for meetings whose attendance is recorded -- the same
 * rule as the schedule page; someone who did not attend has no experience of
 * that meeting to rate. Quizzes are asked for when never finished and still
 * startable, and only once their meeting has begun: chasing a quiz for a
 * meeting that has not happened only adds noise.
 *
 * Called from the participant layout, which runs only when the app is opened
 * or reloaded -- not on every page change.
 */
export async function listStudentReminders(actor: Actor): Promise<StudentReminders> {
  if (!actor.classId) return { surveys: [], exams: [] };

  const db = getAdminDb();
  const classId = actor.classId;
  const [ownedSnap, sharedSnap, attendanceSnap, formSnap, responseSnap, examSnap, attemptSnap] = await Promise.all([
    // Dua kueri sesi seperti listSessionsForClass, tetapi hanya kolom yang dipakai.
    // Two session queries like listSessionsForClass, but only the columns used.
    db.collection('sessions').where('classId', '==', classId).select('id', 'title', 'startsAt').get(),
    db.collection('sessions').where('classIds', 'array-contains', classId).select('id', 'title', 'startsAt').get(),
    db.collection('attendance').where('classId', '==', classId).where('studentId', '==', actor.uid).select('sessionId').get(),
    db.collection('surveyForms').where('published', '==', true).get(),
    db.collection('surveyResponses').where('studentId', '==', actor.uid).select('formId', 'sessionId').get(),
    db
      .collection('exams')
      .where('classId', '==', classId)
      .where('published', '==', true)
      .select('id', 'title', 'sessionId', 'dueAt', 'questionCount')
      .get(),
    db.collection('examAttempts').where('studentId', '==', actor.uid).select('examId', 'status', 'passed').get(),
  ]);

  const sessions = new Map<string, { title: string; startsAt: string }>();
  for (const d of [...ownedSnap.docs, ...sharedSnap.docs]) {
    const s = d.data() as { id: string; title: string; startsAt: string };
    sessions.set(s.id, { title: s.title, startsAt: s.startsAt });
  }

  const attended = attendanceSnap.docs.map((d) => (d.data() as { sessionId: string }).sessionId).filter((id) => sessions.has(id));
  const answered = new Set(
    responseSnap.docs.map((d) => {
      const r = d.data() as { formId: string; sessionId: string };
      return `${r.formId}_${r.sessionId}`;
    })
  );
  const forms = formSnap.docs.map((d) => d.data() as SurveyFormDocument).filter((f) => f.questions.length > 0);

  const surveys: StudentReminders['surveys'] = [];
  for (const sessionId of attended) {
    for (const f of forms) {
      if (!scopeCovers(f.scope, classId, sessionId) || answered.has(`${f.id}_${sessionId}`)) continue;
      surveys.push({ formId: f.id, formTitle: f.title, sessionId, sessionTitle: sessions.get(sessionId)!.title });
    }
  }

  const attemptsByExam = new Map<string, { status: 'berlangsung' | 'selesai'; passed: boolean | null }[]>();
  for (const d of attemptSnap.docs) {
    const a = d.data() as { examId: string; status: 'berlangsung' | 'selesai'; passed: boolean | null };
    if (!attemptsByExam.has(a.examId)) attemptsByExam.set(a.examId, []);
    attemptsByExam.get(a.examId)!.push(a);
  }

  const nowIso = new Date().toISOString();
  const exams: StudentReminders['exams'] = examSnap.docs
    .map((d) => d.data() as { id: string; title: string; sessionId: string | null; dueAt: string | null; questionCount: number })
    .filter((e) => {
      if (e.questionCount <= 0) return false;
      if (e.sessionId) {
        const s = sessions.get(e.sessionId);
        if (!s || s.startsAt > nowIso) return false;
      }
      const attempts = attemptsByExam.get(e.id) ?? [];
      if (attempts.some((a) => a.status === 'selesai')) return false;
      return canStartAttempt({ attempts, dueAt: e.dueAt, nowIso }).allowed;
    })
    .map((e) => ({ id: e.id, title: e.title, dueAt: e.dueAt, sessionTitle: e.sessionId ? sessions.get(e.sessionId)!.title : null }));

  return { surveys, exams };
}
