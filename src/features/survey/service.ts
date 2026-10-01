// Layanan formulir survei dan jawabannya / Survey form and response service
import crypto from 'crypto';
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import { canPublishForm, summariseAnswers, validateResponses, validateSurveyQuestion } from './policy';
import type {
  SurveyFormDocument,
  SurveyQuestion,
  SurveyQuestionKind,
  SurveyResponseDocument,
} from './types';

/** Hanya ada satu formulir; id-nya tetap / There is only one form; its id is fixed */
const FORM_ID = 'default';

function requireAdmin(actor: Actor): void {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan mengubah formulir survei');
  }
}

const KOSONG: SurveyFormDocument = {
  id: FORM_ID,
  title: 'Umpan Balik Pertemuan',
  description: 'Masukan Anda dipakai untuk memperbaiki pertemuan berikutnya.',
  questions: [],
  published: false,
  version: 1,
  updatedAt: '',
};

/**
 * Mengambil formulir survei, atau bentuk kosongnya bila belum pernah disusun.
 *
 * Mengembalikan bentuk kosong alih-alih null: halaman pengaturan menampilkan
 * formulir yang sama baik sudah ada maupun belum, dan null akan memaksa setiap
 * pemanggil menanganinya sendiri.
 *
 * Reads the survey form, or an empty one if it has never been written.
 *
 * Returns an empty form rather than null: the settings page renders the same
 * form whether or not it exists yet, and null would force every caller to
 * handle that case itself.
 */
export async function getSurveyForm(): Promise<SurveyFormDocument> {
  const db = getAdminDb();
  const snap = await db.collection('surveyForms').doc(FORM_ID).get();
  if (!snap.exists) return KOSONG;
  return snap.data() as SurveyFormDocument;
}

/**
 * Menyimpan perubahan formulir.
 *
 * Versi dinaikkan setiap kali pertanyaannya berubah, dan dicatat pada tiap
 * jawaban agar rekapnya dapat memisahkan jawaban atas pertanyaan lama dari
 * yang baru.
 *
 * Saves a change to the form.
 *
 * The version rises whenever the questions change, and is recorded on every
 * response so a report can separate answers to the old questions from the new.
 */
export async function updateSurveyForm(
  actor: Actor,
  patch: { title?: string; description?: string; questions?: SurveyQuestion[]; published?: boolean }
): Promise<void> {
  requireAdmin(actor);

  const current = await getSurveyForm();
  const questions = patch.questions ?? current.questions;

  if (patch.published === true) {
    const { allowed, reason } = canPublishForm(questions);
    if (!allowed) throw new Error(reason);
  }

  const berubah = patch.questions !== undefined;
  const next: SurveyFormDocument = {
    ...current,
    title: patch.title?.trim() || current.title,
    description: patch.description !== undefined ? patch.description.trim() : current.description,
    questions,
    published: patch.published ?? current.published,
    version: berubah ? current.version + 1 : current.version,
    updatedAt: new Date().toISOString(),
  };

  await getAdminDb().collection('surveyForms').doc(FORM_ID).set(next);
}

export async function addSurveyQuestion(
  actor: Actor,
  input: { kind: SurveyQuestionKind; text: string; options: string[]; required: boolean }
): Promise<void> {
  requireAdmin(actor);

  const validated = validateSurveyQuestion(input);
  const current = await getSurveyForm();

  const question: SurveyQuestion = {
    id: crypto.randomUUID(),
    ...validated,
    required: input.required,
    order: current.questions.length + 1,
  };

  await updateSurveyForm(actor, { questions: [...current.questions, question] });
}

export async function removeSurveyQuestion(actor: Actor, questionId: string): Promise<void> {
  requireAdmin(actor);

  const current = await getSurveyForm();
  const questions = current.questions
    .filter((q) => q.id !== questionId)
    .map((q, i) => ({ ...q, order: i + 1 }));

  // Formulir yang kehilangan pertanyaan terakhirnya tidak boleh tetap terbit:
  // peserta akan diminta mengisi layar kosong.
  //
  // A form that loses its last question must not stay published: participants
  // would be asked to fill in an empty screen.
  await updateSurveyForm(actor, {
    questions,
    ...(questions.length === 0 ? { published: false } : {}),
  });
}

/**
 * Mengirimkan jawaban survei sebuah pertemuan.
 *
 * Kehadiran diperiksa lebih dulu: peserta yang tidak hadir tidak punya
 * pengalaman pertemuan itu untuk dinilai, dan jawabannya akan mencemari rekap
 * dengan penilaian atas sesi yang tidak diikutinya.
 *
 * Submits a meeting's survey response.
 *
 * Attendance is checked first: someone who did not attend has no experience of
 * that meeting to rate, and their answers would pollute the report with
 * judgements of a session they were not at.
 */
export async function submitSurveyResponse(
  actor: Actor,
  sessionId: string,
  raw: Record<string, string>
): Promise<void> {
  if (actor.role !== 'student' || !actor.classId) {
    throw new Error('Hanya peserta yang dapat mengisi survei');
  }

  const db = getAdminDb();
  const [formSnap, sessionSnap, attendanceSnap] = await Promise.all([
    db.collection('surveyForms').doc(FORM_ID).get(),
    db.collection('sessions').doc(sessionId).get(),
    db.collection('attendance').doc(`${sessionId}_${actor.uid}`).get(),
  ]);

  if (!formSnap.exists) throw new Error('Formulir survei belum tersedia');
  const form = formSnap.data() as SurveyFormDocument;
  if (!form.published) throw new Error('Formulir survei belum dibuka');

  if (!sessionSnap.exists) throw new Error('Pertemuan tidak ditemukan');
  const session = sessionSnap.data() as { title: string; date: string; className?: string };

  if (!attendanceSnap.exists) {
    throw new Error('Survei terbuka setelah kehadiran Anda pada pertemuan ini tercatat');
  }

  const answers = validateResponses(form.questions, raw);
  const id = `${sessionId}_${actor.uid}`;

  // Satu jawaban per peserta per pertemuan. Id gabungan membuat pengiriman
  // ulang menimpa jawabannya sendiri alih-alih menambah baris kedua, sehingga
  // ketukan ganda tidak menggandakan rekapnya.
  //
  // One response per participant per meeting. The compound id makes a resend
  // overwrite their own answer rather than add a second row, so a double tap
  // does not double the report.
  const response: SurveyResponseDocument = {
    id,
    sessionId,
    sessionTitle: session.title,
    sessionDate: session.date,
    classId: actor.classId,
    className: session.className ?? '',
    studentId: actor.uid,
    studentName: actor.name,
    formVersion: form.version,
    answers,
    submittedAt: new Date().toISOString(),
  };

  await db.collection('surveyResponses').doc(id).set(response);
}

/**
 * Rekap jawaban survei, disaring menurut kelas atau pertemuan.
 *
 * The survey report, filterable by class or meeting.
 */
export async function getSurveyReport(
  actor: Actor,
  filters: { classId?: string; sessionId?: string } = {}
): Promise<{
  responseCount: number;
  sessions: { sessionId: string; sessionTitle: string; sessionDate: string; count: number }[];
  summary: ReturnType<typeof summariseAnswers>;
}> {
  requireAdmin(actor);

  const db = getAdminDb();
  let query = db.collection('surveyResponses') as FirebaseFirestore.Query;
  if (filters.sessionId) query = query.where('sessionId', '==', filters.sessionId);
  else if (filters.classId) query = query.where('classId', '==', filters.classId);

  const snap = await query.get();
  const responses = snap.docs.map((d) => d.data() as SurveyResponseDocument);

  const perSesi = new Map<string, { sessionId: string; sessionTitle: string; sessionDate: string; count: number }>();
  for (const r of responses) {
    const ada = perSesi.get(r.sessionId);
    if (ada) ada.count += 1;
    else perSesi.set(r.sessionId, { sessionId: r.sessionId, sessionTitle: r.sessionTitle, sessionDate: r.sessionDate, count: 1 });
  }

  return {
    responseCount: responses.length,
    sessions: [...perSesi.values()].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)),
    summary: summariseAnswers(responses.flatMap((r) => r.answers)),
  };
}
