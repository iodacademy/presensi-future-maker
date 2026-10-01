// Layanan formulir survei dan jawabannya / Survey form and response service
import crypto from 'crypto';
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import {
  canPublishForm,
  scopeCovers,
  summariseAnswers,
  validateResponses,
  validateSurveyQuestion,
} from './policy';
import type {
  SurveyFormDocument,
  SurveyQuestion,
  SurveyQuestionKind,
  SurveyResponseDocument,
  SurveyScope,
} from './types';

function requireAdmin(actor: Actor): void {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan mengubah formulir survei');
  }
}

export async function listSurveyForms(): Promise<SurveyFormDocument[]> {
  const db = getAdminDb();
  const snap = await db.collection('surveyForms').get();
  return snap.docs
    .map((d) => d.data() as SurveyFormDocument)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getSurveyForm(formId: string): Promise<SurveyFormDocument | null> {
  const db = getAdminDb();
  const snap = await db.collection('surveyForms').doc(formId).get();
  return snap.exists ? (snap.data() as SurveyFormDocument) : null;
}

/**
 * Membuat formulir baru dalam keadaan belum terbit dan tanpa pertanyaan.
 *
 * Cakupannya kosong, yang berarti seluruh kelas dan seluruh pertemuan. Bawaan
 * yang paling longgar dipilih agar formulir baru tidak diam-diam tidak
 * mengenai siapa pun; cakupan yang terlalu luas terlihat, cakupan kosong
 * tidak.
 *
 * Creates a new form, unpublished and without questions.
 *
 * Its scope is empty, meaning every class and every meeting. The widest default
 * is chosen so a new form does not quietly cover nobody; too wide a scope is
 * visible, an empty one is not.
 */
export async function createSurveyForm(
  actor: Actor,
  input: { title: string; description?: string }
): Promise<{ id: string }> {
  requireAdmin(actor);

  const title = input.title.trim();
  if (!title) throw new Error('Judul survei wajib diisi');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const form: SurveyFormDocument = {
    id,
    title,
    description: (input.description ?? '').trim(),
    questions: [],
    scope: { classIds: [], sessionIds: [] },
    published: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  await getAdminDb().collection('surveyForms').doc(id).set(form);
  return { id };
}

/**
 * Menyimpan perubahan formulir.
 *
 * Versi dinaikkan setiap kali pertanyaannya berubah, dan dicatat pada tiap
 * jawaban agar rekapnya dapat memisahkan jawaban atas pertanyaan lama dari
 * yang baru. Mengubah judul atau cakupan tidak menaikkannya: keduanya tidak
 * mengubah apa yang dibaca penjawabnya.
 *
 * Saves a change to a form.
 *
 * The version rises whenever the questions change, and is recorded on every
 * response so a report can separate answers to the old questions from the new.
 * Changing the title or scope does not raise it: neither changes what the
 * respondent read.
 */
export async function updateSurveyForm(
  actor: Actor,
  formId: string,
  patch: {
    title?: string;
    description?: string;
    questions?: SurveyQuestion[];
    scope?: SurveyScope;
    published?: boolean;
  }
): Promise<void> {
  requireAdmin(actor);

  const current = await getSurveyForm(formId);
  if (!current) throw new Error('Survei tidak ditemukan');

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
    scope: patch.scope ?? current.scope,
    published: patch.published ?? current.published,
    version: berubah ? current.version + 1 : current.version,
    updatedAt: new Date().toISOString(),
  };

  await getAdminDb().collection('surveyForms').doc(formId).set(next);
}

export async function addSurveyQuestion(
  actor: Actor,
  formId: string,
  input: { kind: SurveyQuestionKind; text: string; options: string[]; required: boolean }
): Promise<void> {
  requireAdmin(actor);

  const validated = validateSurveyQuestion(input);
  const current = await getSurveyForm(formId);
  if (!current) throw new Error('Survei tidak ditemukan');

  const question: SurveyQuestion = {
    id: crypto.randomUUID(),
    ...validated,
    required: input.required,
    order: current.questions.length + 1,
  };

  await updateSurveyForm(actor, formId, { questions: [...current.questions, question] });
}

/**
 * Mengubah satu pertanyaan.
 *
 * Id-nya dipertahankan, sehingga jawaban yang sudah masuk tetap menunjuk
 * pertanyaan yang sama. Teksnya sendiri sudah disalin ke tiap jawaban saat
 * dikirim, jadi rekap lama tetap menampilkan kalimat yang benar-benar dibaca
 * penjawabnya -- bukan kalimat yang baru.
 *
 * Changes one question.
 *
 * Its id is kept, so responses already in still point at the same question.
 * The text itself was copied onto each response when it was submitted, so old
 * reports still show the sentence its author actually read -- not the new one.
 */
export async function updateSurveyQuestion(
  actor: Actor,
  formId: string,
  questionId: string,
  input: { kind: SurveyQuestionKind; text: string; options: string[]; required: boolean }
): Promise<void> {
  requireAdmin(actor);

  const validated = validateSurveyQuestion(input);
  const current = await getSurveyForm(formId);
  if (!current) throw new Error('Survei tidak ditemukan');

  const ada = current.questions.some((q) => q.id === questionId);
  if (!ada) throw new Error('Pertanyaan tidak ditemukan');

  const questions = current.questions.map((q) =>
    q.id === questionId ? { ...q, ...validated, required: input.required } : q
  );

  await updateSurveyForm(actor, formId, { questions });
}

/**
 * Memindahkan sebuah pertanyaan satu posisi ke atas atau ke bawah.
 *
 * Urutannya ditulis ulang seluruhnya setelah ditukar, bukan hanya pada dua
 * pertanyaan yang berpindah: nomor urut yang bolong setelah penghapusan
 * membuat pertukaran berikutnya melompati posisi.
 *
 * Moves a question one position up or down.
 *
 * The whole order is rewritten after the swap rather than only the two that
 * moved: gaps left by a deletion would make the next swap skip a position.
 */
export async function moveSurveyQuestion(
  actor: Actor,
  formId: string,
  questionId: string,
  direction: 'up' | 'down'
): Promise<void> {
  requireAdmin(actor);

  const current = await getSurveyForm(formId);
  if (!current) throw new Error('Survei tidak ditemukan');

  const urut = [...current.questions].sort((a, b) => a.order - b.order);
  const i = urut.findIndex((q) => q.id === questionId);
  if (i === -1) throw new Error('Pertanyaan tidak ditemukan');

  const j = direction === 'up' ? i - 1 : i + 1;
  // Di luar batas berarti tidak ada yang perlu dilakukan, bukan galat: tombol
  // naik pada pertanyaan pertama sudah dinonaktifkan di layar, dan menolaknya
  // di sini hanya memunculkan pesan galat untuk ketukan yang tidak berakibat.
  //
  // Out of range means nothing to do rather than an error: the up button on the
  // first question is already disabled on screen, and refusing here would only
  // raise an error for a tap that changes nothing.
  if (j < 0 || j >= urut.length) return;

  [urut[i], urut[j]] = [urut[j], urut[i]];

  await updateSurveyForm(actor, formId, {
    questions: urut.map((q, n) => ({ ...q, order: n + 1 })),
  });
}

export async function removeSurveyQuestion(
  actor: Actor,
  formId: string,
  questionId: string
): Promise<void> {
  requireAdmin(actor);

  const current = await getSurveyForm(formId);
  if (!current) throw new Error('Survei tidak ditemukan');

  const questions = current.questions
    .filter((q) => q.id !== questionId)
    .map((q, i) => ({ ...q, order: i + 1 }));

  // Formulir yang kehilangan pertanyaan terakhirnya tidak boleh tetap terbit:
  // peserta akan diminta mengisi layar kosong.
  //
  // A form that loses its last question must not stay published: participants
  // would be asked to fill in an empty screen.
  await updateSurveyForm(actor, formId, {
    questions,
    ...(questions.length === 0 ? { published: false } : {}),
  });
}

/**
 * Menghapus sebuah formulir beserta jawabannya.
 *
 * Jawabannya ikut dihapus: jawaban yang formulirnya hilang tidak dapat
 * ditampilkan pada rekap mana pun lagi, dan membiarkannya hanya menyisakan
 * dokumen yang tidak pernah terbaca.
 *
 * Deletes a form together with its responses.
 *
 * The responses go too: an answer whose form is gone can no longer appear on
 * any report, and keeping it only leaves a document nothing ever reads.
 */
export async function deleteSurveyForm(actor: Actor, formId: string): Promise<void> {
  requireAdmin(actor);

  const db = getAdminDb();
  const responses = await db.collection('surveyResponses').where('formId', '==', formId).get();

  const batch = db.batch();
  for (const d of responses.docs) batch.delete(d.ref);
  batch.delete(db.collection('surveyForms').doc(formId));
  await batch.commit();
}

/**
 * Formulir yang berlaku bagi satu pertemuan, beserta keadaan pengisiannya.
 *
 * The forms that apply to one meeting, with whether each has been filled in.
 */
export async function listSurveysForSession(
  studentId: string,
  classId: string,
  sessionId: string
): Promise<{ formId: string; formTitle: string; questionCount: number; submitted: boolean }[]> {
  const forms = (await listSurveyForms()).filter(
    (f) => f.published && f.questions.length > 0 && scopeCovers(f.scope, classId, sessionId)
  );
  if (forms.length === 0) return [];

  const db = getAdminDb();
  const snap = await db
    .collection('surveyResponses')
    .where('studentId', '==', studentId)
    .where('sessionId', '==', sessionId)
    .get();

  const sudah = new Set(snap.docs.map((d) => (d.data() as SurveyResponseDocument).formId));

  return forms.map((f) => ({
    formId: f.id,
    formTitle: f.title,
    questionCount: f.questions.length,
    submitted: sudah.has(f.id),
  }));
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
  formId: string,
  sessionId: string,
  raw: Record<string, string>
): Promise<void> {
  if (actor.role !== 'student' || !actor.classId) {
    throw new Error('Hanya peserta yang dapat mengisi survei');
  }

  const db = getAdminDb();
  const [formSnap, sessionSnap, attendanceSnap] = await Promise.all([
    db.collection('surveyForms').doc(formId).get(),
    db.collection('sessions').doc(sessionId).get(),
    db.collection('attendance').doc(`${sessionId}_${actor.uid}`).get(),
  ]);

  if (!formSnap.exists) throw new Error('Survei tidak ditemukan');
  const form = formSnap.data() as SurveyFormDocument;
  if (!form.published) throw new Error('Survei ini belum dibuka');

  if (!sessionSnap.exists) throw new Error('Pertemuan tidak ditemukan');
  const session = sessionSnap.data() as { title: string; date: string; className?: string };

  // Cakupannya diperiksa di sini, bukan hanya dengan menyembunyikan barisnya:
  // baris yang disembunyikan tidak menahan siapa pun yang memanggil
  // endpointnya langsung dengan id pertemuan lain.
  //
  // The scope is checked here rather than only by hiding the row: a hidden row
  // holds back nobody who calls the endpoint directly with another meeting's
  // id.
  if (!scopeCovers(form.scope, actor.classId, sessionId)) {
    throw new Error('Survei ini tidak berlaku untuk pertemuan tersebut');
  }

  if (!attendanceSnap.exists) {
    throw new Error('Survei terbuka setelah kehadiran Anda pada pertemuan ini tercatat');
  }

  const answers = validateResponses(form.questions, raw);
  // Satu jawaban per formulir per peserta per pertemuan. Id gabungan membuat
  // pengiriman ulang menimpa jawabannya sendiri alih-alih menambah baris
  // kedua, sehingga ketukan ganda tidak menggandakan rekapnya.
  //
  // One response per form per participant per meeting. The compound id makes a
  // resend overwrite their own answer rather than add a second row, so a double
  // tap does not double the report.
  const id = `${formId}_${sessionId}_${actor.uid}`;

  const response: SurveyResponseDocument = {
    id,
    formId,
    formTitle: form.title,
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
 * Rekap jawaban sebuah formulir, dapat disaring menurut kelas atau pertemuan.
 *
 * One form's report, filterable by class or meeting.
 */
export async function getSurveyReport(
  actor: Actor,
  formId: string,
  filters: { classId?: string; sessionId?: string } = {}
): Promise<{
  responseCount: number;
  sessions: { sessionId: string; sessionTitle: string; sessionDate: string; count: number }[];
  summary: ReturnType<typeof summariseAnswers>;
}> {
  requireAdmin(actor);

  const db = getAdminDb();
  // Disaring menurut formulirnya lebih dulu. Tanpa itu, rekap sebuah formulir
  // akan ikut menghitung jawaban atas formulir lain yang kebetulan mengenai
  // pertemuan yang sama.
  //
  // Filtered by form first. Without it, one form's report would count answers
  // to another form that happened to cover the same meeting.
  let query = db.collection('surveyResponses').where('formId', '==', formId) as FirebaseFirestore.Query;
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
