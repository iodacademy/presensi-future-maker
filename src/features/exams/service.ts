// Layanan ujian: penyusunan soal, pengerjaan, dan penilaian
// Exam service: authoring, running, and grading
import crypto from 'crypto';
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import {
  applyRemedialRule,
  attemptDeadline,
  calculateScore,
  canPublishExam,
  canStartAttempt,
  gradeAnswer,
  isSubmissionLate,
  seededShuffle,
  validateQuestion,
} from './policy';
import {
  DEFAULT_PASSING_SCORE,
  MAX_ATTEMPTS,
  type AnswerDocument,
  type AnswerKeyDocument,
  type AttemptDocument,
  type ExamDocument,
  type ExamKind,
  type QuestionDocument,
  type QuestionKind,
  type StudentExamSummary,
} from './types';

function requireAdmin(actor: Actor): void {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan menyusun ujian');
  }
}

/**
 * Membuat ujian baru dalam keadaan belum terbit.
 *
 * Ujian lahir tanpa soal, dan ujian kosong yang terbit menolak setiap peserta
 * yang membukanya.
 *
 * Creates a new exam, unpublished.
 *
 * An exam is born with no questions, and a published empty exam turns away
 * everyone who opens it.
 */
export async function createExam(
  actor: Actor,
  input: {
    classId: string;
    kind: ExamKind;
    sessionId?: string | null;
    title: string;
    description?: string;
    durationMinutes?: number | null;
    passingScore?: number;
    dueAt?: string | null;
  }
): Promise<{ id: string }> {
  requireAdmin(actor);

  const title = input.title.trim();
  if (!title) throw new Error('Judul ujian wajib diisi');

  // Kuis melekat pada satu pertemuan; tanpa sesi induknya peserta tidak punya
  // tempat menemukannya.
  //
  // A quiz hangs off one meeting; with no parent session participants have
  // nowhere to find it.
  if (input.kind === 'kuis' && !input.sessionId) {
    throw new Error('Kuis harus terikat pada satu pertemuan');
  }

  const db = getAdminDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const exam: ExamDocument = {
    id,
    classId: input.classId,
    kind: input.kind,
    sessionId: input.kind === 'kuis' ? input.sessionId! : null,
    title,
    description: (input.description ?? '').trim(),
    durationMinutes: input.durationMinutes ?? null,
    passingScore: input.passingScore ?? DEFAULT_PASSING_SCORE,
    dueAt: input.dueAt ?? null,
    questionCount: 0,
    published: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('exams').doc(id).set(exam);
  return { id };
}

export async function updateExam(
  actor: Actor,
  examId: string,
  patch: Partial<Pick<ExamDocument, 'title' | 'description' | 'durationMinutes' | 'passingScore' | 'dueAt' | 'published'>>
): Promise<void> {
  requireAdmin(actor);

  const db = getAdminDb();
  const ref = db.collection('exams').doc(examId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Ujian tidak ditemukan');

  const exam = snap.data() as ExamDocument;

  if (patch.published === true) {
    const { allowed, reason } = canPublishExam(exam);
    if (!allowed) throw new Error(reason);
  }

  await ref.update({ ...patch, updatedAt: new Date().toISOString() });
}

/**
 * Menambahkan soal beserta kuncinya.
 *
 * Soal dan kuncinya ditulis sebagai dua dokumen dalam satu batch. Firestore
 * tidak mengenal izin per-kolom, sehingga satu dokumen yang memuat keduanya
 * akan terkirim utuh begitu soalnya dikirim ke peserta.
 *
 * Adds a question together with its key.
 *
 * The question and its key are written as two documents in one batch. Firestore
 * has no per-field permissions, so a single document holding both would travel
 * whole the moment the question is sent to a participant.
 */
export async function createQuestion(
  actor: Actor,
  examId: string,
  input: {
    kind: QuestionKind;
    text: string;
    options: { text: string }[];
    correctIndex: number;
    explanation?: string;
  }
): Promise<{ id: string }> {
  requireAdmin(actor);

  const db = getAdminDb();
  const examRef = db.collection('exams').doc(examId);
  const examSnap = await examRef.get();
  if (!examSnap.exists) throw new Error('Ujian tidak ditemukan');

  const exam = examSnap.data() as ExamDocument;
  const options = input.options.map((o) => ({ id: crypto.randomUUID(), text: o.text.trim() }));
  const correct = options[input.correctIndex];

  validateQuestion({
    kind: input.kind,
    text: input.text,
    options,
    correctOptionId: correct?.id ?? '',
  });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const question: QuestionDocument = {
    id,
    examId,
    kind: input.kind,
    text: input.text.trim(),
    options,
    order: exam.questionCount + 1,
    createdAt: now,
    updatedAt: now,
  };

  const key: AnswerKeyDocument = {
    id,
    examId,
    correctOptionId: correct.id,
    explanation: (input.explanation ?? '').trim(),
    updatedAt: now,
  };

  const batch = db.batch();
  batch.set(db.collection('examQuestions').doc(id), question);
  batch.set(db.collection('examAnswerKeys').doc(id), key);
  batch.update(examRef, { questionCount: exam.questionCount + 1, updatedAt: now });
  await batch.commit();

  return { id };
}

export async function deleteQuestion(actor: Actor, questionId: string): Promise<void> {
  requireAdmin(actor);

  const db = getAdminDb();
  const qRef = db.collection('examQuestions').doc(questionId);
  const qSnap = await qRef.get();
  if (!qSnap.exists) throw new Error('Soal tidak ditemukan');

  const question = qSnap.data() as QuestionDocument;
  const examRef = db.collection('exams').doc(question.examId);
  const examSnap = await examRef.get();
  const count = (examSnap.data()?.questionCount as number) || 0;
  const now = new Date().toISOString();

  const batch = db.batch();
  batch.delete(qRef);
  // Kunci yang tertinggal tanpa soalnya tidak pernah terbaca lagi, tetapi tetap
  // memuat jawaban benar yang dapat dibaca siapa pun yang berwenang membaca
  // koleksi itu kelak.
  //
  // A key left behind without its question is never read again, yet still holds
  // a correct answer readable by whoever may later read that collection.
  batch.delete(db.collection('examAnswerKeys').doc(questionId));
  batch.update(examRef, { questionCount: Math.max(0, count - 1), updatedAt: now });

  // Ujian yang kehilangan soal terakhirnya tidak boleh tetap terbit.
  // An exam that loses its last question must not stay published.
  if (count - 1 < 1) {
    batch.update(examRef, { published: false });
  }

  await batch.commit();
}

/** Daftar soal beserta kuncinya, untuk admin saja / Questions with their keys, admin only */
export async function listQuestionsForAdmin(
  actor: Actor,
  examId: string
): Promise<(QuestionDocument & { correctOptionId: string; explanation: string })[]> {
  requireAdmin(actor);

  const db = getAdminDb();
  const [qSnap, kSnap] = await Promise.all([
    db.collection('examQuestions').where('examId', '==', examId).get(),
    db.collection('examAnswerKeys').where('examId', '==', examId).get(),
  ]);

  const keys = new Map<string, AnswerKeyDocument>();
  for (const d of kSnap.docs) {
    const k = d.data() as AnswerKeyDocument;
    keys.set(k.id, k);
  }

  return qSnap.docs
    .map((d) => d.data() as QuestionDocument)
    .sort((a, b) => a.order - b.order)
    .map((q) => ({
      ...q,
      correctOptionId: keys.get(q.id)?.correctOptionId ?? '',
      explanation: keys.get(q.id)?.explanation ?? '',
    }));
}

export async function listExamsForClass(classId: string): Promise<ExamDocument[]> {
  const db = getAdminDb();
  const snap = await db.collection('exams').where('classId', '==', classId).get();
  return snap.docs
    .map((d) => d.data() as ExamDocument)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Daftar ujian peserta beserta riwayat percobaannya.
 *
 * Lists a participant's exams with their attempt history.
 */
export async function listExamsForStudent(actor: Actor): Promise<StudentExamSummary[]> {
  if (actor.role !== 'student' || !actor.classId) return [];

  const db = getAdminDb();
  const [examSnap, attemptSnap] = await Promise.all([
    db.collection('exams').where('classId', '==', actor.classId).where('published', '==', true).get(),
    db.collection('examAttempts').where('studentId', '==', actor.uid).get(),
  ]);

  const byExam = new Map<string, AttemptDocument[]>();
  for (const d of attemptSnap.docs) {
    const a = d.data() as AttemptDocument;
    if (!byExam.has(a.examId)) byExam.set(a.examId, []);
    byExam.get(a.examId)!.push(a);
  }

  return examSnap.docs
    .map((d) => d.data() as ExamDocument)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((exam) => {
      const attempts = byExam.get(exam.id) ?? [];
      const selesai = attempts.filter((a) => a.status === 'selesai');
      const berlangsung = attempts.find((a) => a.status === 'berlangsung');
      const nilai = selesai.map((a) => a.score).filter((s): s is number => s !== null);

      return {
        exam: {
          id: exam.id,
          kind: exam.kind,
          title: exam.title,
          description: exam.description,
          durationMinutes: exam.durationMinutes,
          passingScore: exam.passingScore,
          dueAt: exam.dueAt,
          questionCount: exam.questionCount,
          sessionId: exam.sessionId,
        },
        attemptsUsed: attempts.length,
        attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts.length),
        bestScore: nilai.length > 0 ? Math.max(...nilai) : null,
        passed: selesai.some((a) => a.passed === true),
        inProgressAttemptId: berlangsung?.id ?? null,
      };
    });
}

/**
 * Memulai percobaan, atau melanjutkan yang sudah berjalan.
 *
 * Soal yang dikembalikan tidak pernah memuat jawaban benarnya: kuncinya berada
 * pada koleksi terpisah yang tidak ikut dibaca di sini.
 *
 * waktu mulai diambil dari server. Jam perangkat peserta dapat meleset
 * berjam-jam, dan waktu mulai yang dikirim peramban menggeser batas waktunya
 * -- termasuk ke arah yang menguntungkan pengirimnya.
 *
 * Starts an attempt, or resumes one already running.
 *
 * The questions returned never carry their correct answers: the keys live in a
 * separate collection that is not read here.
 *
 * The start time comes from the server. A participant's device clock can be
 * hours off, and a start time sent by the browser shifts the deadline with it
 * -- including in the sender's favour.
 */
export async function startAttempt(
  actor: Actor,
  examId: string
): Promise<{
  attemptId: string;
  startedAt: string;
  deadline: string | null;
  attemptNumber: number;
  exam: Pick<ExamDocument, 'id' | 'title' | 'description' | 'durationMinutes' | 'passingScore' | 'questionCount'>;
  questions: QuestionDocument[];
  savedAnswers: Record<string, string>;
}> {
  if (actor.role !== 'student' || !actor.classId) {
    throw new Error('Hanya peserta yang dapat mengerjakan ujian');
  }

  const db = getAdminDb();
  const examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) throw new Error('Ujian tidak ditemukan');

  const exam = examSnap.data() as ExamDocument;
  if (!exam.published) throw new Error('Ujian ini belum dibuka');
  if (exam.classId !== actor.classId) throw new Error('Ujian ini bukan untuk kelas Anda');
  // Ujian kosong yang lolos ke sini akan membagi dengan nol dan meluluskan
  // setiap peserta dengan nilai nol.
  //
  // An empty exam reaching this point would divide by zero and pass everyone
  // with a score of zero.
  if (exam.questionCount < 1) throw new Error('Ujian ini belum memiliki soal');

  const attemptSnap = await db
    .collection('examAttempts')
    .where('examId', '==', examId)
    .where('studentId', '==', actor.uid)
    .get();

  const attempts = attemptSnap.docs.map((d) => d.data() as AttemptDocument);
  const { allowed, reason } = canStartAttempt({
    attempts,
    dueAt: exam.dueAt,
    nowIso: new Date().toISOString(),
  });
  if (!allowed) throw new Error(reason);

  const questionSnap = await db.collection('examQuestions').where('examId', '==', examId).get();
  const questions = questionSnap.docs.map((d) => d.data() as QuestionDocument);
  const byId = new Map(questions.map((q) => [q.id, q]));

  let attempt = attempts.find((a) => a.status === 'berlangsung');

  if (!attempt) {
    const attemptNumber = attempts.length + 1;
    const id = `${examId}_${actor.uid}_${attemptNumber}`;
    const now = new Date().toISOString();

    attempt = {
      id,
      examId,
      examTitle: exam.title,
      classId: exam.classId,
      studentId: actor.uid,
      studentName: actor.name,
      attemptNumber,
      startedAt: now,
      finishedAt: null,
      rawScore: null,
      score: null,
      passed: null,
      correctCount: null,
      status: 'berlangsung',
      questionOrder: seededShuffle(
        questions.sort((a, b) => a.order - b.order).map((q) => q.id),
        id
      ),
      autoSubmitted: false,
    };

    await db.collection('examAttempts').doc(id).set(attempt);
  }

  // Jawaban yang sudah tersimpan dikembalikan agar peserta yang memuat ulang
  // halamannya tidak mulai dari kosong.
  //
  // Saved answers come back so a participant who reloads does not start empty.
  const savedSnap = await db.collection('examAnswers').where('attemptId', '==', attempt.id).get();
  const savedAnswers: Record<string, string> = {};
  for (const d of savedSnap.docs) {
    const a = d.data() as AnswerDocument;
    if (a.selectedOptionId) savedAnswers[a.questionId] = a.selectedOptionId;
  }

  return {
    attemptId: attempt.id,
    startedAt: attempt.startedAt,
    deadline: attemptDeadline(attempt.startedAt, exam.durationMinutes),
    attemptNumber: attempt.attemptNumber,
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      passingScore: exam.passingScore,
      questionCount: exam.questionCount,
    },
    questions: attempt.questionOrder
      .map((qid) => byId.get(qid))
      .filter((q): q is QuestionDocument => Boolean(q)),
    savedAnswers,
  };
}

/**
 * Menyimpan satu jawaban sebagai draf.
 *
 * Draf ditulis dengan isCorrect null. Percobaan yang sudah selesai menolak
 * penyimpanan: tanpa penolakan itu, simpanan otomatis yang terlambat tiba
 * dapat mengosongkan isCorrect sebuah jawaban yang sudah dinilai, dan halaman
 * hasil akan menampilkan seluruh jawaban sebagai salah di samping nilai yang
 * benar.
 *
 * Saves one answer as a draft.
 *
 * Drafts are written with isCorrect null. A finished attempt refuses the write:
 * without that refusal, a late autosave could blank the isCorrect of an answer
 * already graded, and the results page would show every answer as wrong beside
 * a correct score.
 */
export async function saveDraftAnswer(
  actor: Actor,
  attemptId: string,
  questionId: string,
  selectedOptionId: string | null
): Promise<void> {
  if (actor.role !== 'student') throw new Error('Hanya peserta yang dapat menjawab');

  const db = getAdminDb();
  const attemptRef = db.collection('examAttempts').doc(attemptId);
  const answerRef = db.collection('examAnswers').doc(`${attemptId}_${questionId}`);

  await db.runTransaction(async (tx) => {
    const attemptSnap = await tx.get(attemptRef);
    if (!attemptSnap.exists) throw new Error('Percobaan tidak ditemukan');

    const attempt = attemptSnap.data() as AttemptDocument;
    if (attempt.studentId !== actor.uid) throw new Error('Percobaan ini bukan milik Anda');
    if (attempt.status === 'selesai') throw new Error('Percobaan ini sudah dikumpulkan');

    const answer: AnswerDocument = {
      id: `${attemptId}_${questionId}`,
      attemptId,
      examId: attempt.examId,
      studentId: actor.uid,
      questionId,
      selectedOptionId,
      isCorrect: null,
      answeredAt: new Date().toISOString(),
    };

    tx.set(answerRef, answer);
  });
}

/**
 * Mengumpulkan dan menilai sebuah percobaan.
 *
 * Idempoten: percobaan yang sudah selesai mengembalikan nilainya tanpa menilai
 * ulang, sehingga pengiriman ulang karena jaringan terputus tidak mengubah
 * hasil.
 *
 * Penilaian berjalan di sini, bukan di peramban. Kunci jawaban tidak pernah
 * dikirim ke peserta, sehingga peramban memang tidak memiliki bahan untuk
 * menilai -- dan nilai yang dihitung peramban dapat diubah sebelum dikirim.
 *
 * Submits and grades an attempt.
 *
 * Idempotent: a finished attempt returns its score without regrading, so a
 * resend after a dropped connection does not change the result.
 *
 * Grading runs here, not in the browser. The answer key never reaches a
 * participant, so the browser has nothing to grade with -- and a score computed
 * in the browser can be edited before it is sent.
 */
export async function submitAttempt(
  actor: Actor,
  attemptId: string,
  answers: Record<string, string | null>,
  autoSubmitted = false
): Promise<{ score: number; rawScore: number; passed: boolean; correctCount: number; totalQuestions: number; alreadySubmitted: boolean }> {
  if (actor.role !== 'student') throw new Error('Hanya peserta yang dapat mengumpulkan ujian');

  const db = getAdminDb();
  const attemptRef = db.collection('examAttempts').doc(attemptId);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) throw new Error('Percobaan tidak ditemukan');

  const attempt = attemptSnap.data() as AttemptDocument;
  if (attempt.studentId !== actor.uid) throw new Error('Percobaan ini bukan milik Anda');

  if (attempt.status === 'selesai') {
    return {
      score: attempt.score ?? 0,
      rawScore: attempt.rawScore ?? 0,
      passed: attempt.passed ?? false,
      correctCount: attempt.correctCount ?? 0,
      totalQuestions: attempt.questionOrder.length,
      alreadySubmitted: true,
    };
  }

  const [examSnap, questionSnap, keySnap, draftSnap] = await Promise.all([
    db.collection('exams').doc(attempt.examId).get(),
    db.collection('examQuestions').where('examId', '==', attempt.examId).get(),
    db.collection('examAnswerKeys').where('examId', '==', attempt.examId).get(),
    db.collection('examAnswers').where('attemptId', '==', attemptId).get(),
  ]);

  const exam = examSnap.data() as ExamDocument;
  const keys = new Map<string, string>();
  for (const d of keySnap.docs) {
    const k = d.data() as AnswerKeyDocument;
    keys.set(k.id, k.correctOptionId);
  }

  // Pengiriman yang terlambat memakai draf yang tersimpan, bukan muatan yang
  // dikirim: jawaban yang diketik setelah waktunya habis tidak boleh ikut
  // dinilai.
  //
  // A late submission grades the saved drafts rather than the payload sent:
  // answers typed after time ran out must not count.
  const terlambat = isSubmissionLate(attempt.startedAt, exam.durationMinutes);
  const sumber: Record<string, string | null> = {};
  if (terlambat) {
    for (const d of draftSnap.docs) {
      const a = d.data() as AnswerDocument;
      sumber[a.questionId] = a.selectedOptionId;
    }
  } else {
    Object.assign(sumber, answers);
  }

  // Pembaginya seluruh soal ujian, bukan jawaban yang dikirim: muatan yang
  // pendek tidak boleh memperkecil pembaginya.
  //
  // The divisor is every question in the exam, not the answers sent: a short
  // payload must not shrink it.
  const questions = questionSnap.docs.map((d) => d.data() as QuestionDocument);
  const now = new Date().toISOString();
  const batch = db.batch();

  let correctCount = 0;
  for (const q of questions) {
    const dipilih = sumber[q.id] ?? null;
    const benar = gradeAnswer(dipilih, keys.get(q.id) ?? '');
    if (benar) correctCount += 1;

    batch.set(db.collection('examAnswers').doc(`${attemptId}_${q.id}`), {
      id: `${attemptId}_${q.id}`,
      attemptId,
      examId: attempt.examId,
      studentId: actor.uid,
      questionId: q.id,
      selectedOptionId: dipilih,
      isCorrect: benar,
      answeredAt: now,
    } satisfies AnswerDocument);
  }

  const rawScore = calculateScore(correctCount, questions.length);
  const score = applyRemedialRule(rawScore, attempt.attemptNumber, exam.passingScore);
  const passed = score >= exam.passingScore;

  batch.update(attemptRef, {
    finishedAt: now,
    status: 'selesai',
    rawScore,
    score,
    passed,
    correctCount,
    autoSubmitted,
  });

  await batch.commit();

  return { score, rawScore, passed, correctCount, totalQuestions: questions.length, alreadySubmitted: false };
}

/**
 * Rekap pengerjaan sebuah ujian: siapa sudah, siapa belum.
 *
 * Yang belum mengerjakan tidak berbentuk dokumen apa pun, sehingga nama-nama
 * itu hanya dapat muncul dengan membandingkan daftar peserta kelas terhadap
 * percobaan yang ada.
 *
 * One exam's roster: who has taken it and who has not.
 *
 * Who has not taken it is no document at all, so those names can only surface
 * by comparing the class roster against the attempts that exist.
 */
export async function getExamRoster(
  actor: Actor,
  examId: string
): Promise<{
  taken: { studentId: string; studentName: string; score: number; passed: boolean; attemptNumber: number }[];
  pending: { studentId: string; studentName: string; email: string }[];
}> {
  requireAdmin(actor);

  const db = getAdminDb();
  const examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) throw new Error('Ujian tidak ditemukan');

  const { classId } = examSnap.data() as ExamDocument;

  const [studentsSnap, attemptsSnap] = await Promise.all([
    db
      .collection('users')
      .where('classId', '==', classId)
      .where('role', '==', 'student')
      // Peserta nonaktif tidak lagi mengikuti kelas; menampilkannya sebagai
      // belum mengerjakan membuat angka itu tidak pernah lunas.
      //
      // A deactivated participant no longer attends; listing them as pending
      // would keep that number from ever reaching zero.
      .where('active', '==', true)
      .get(),
    db.collection('examAttempts').where('examId', '==', examId).get(),
  ]);

  const terbaik = new Map<string, AttemptDocument>();
  for (const d of attemptsSnap.docs) {
    const a = d.data() as AttemptDocument;
    if (a.status !== 'selesai') continue;
    const sebelumnya = terbaik.get(a.studentId);
    if (!sebelumnya || (a.score ?? 0) > (sebelumnya.score ?? 0)) {
      terbaik.set(a.studentId, a);
    }
  }

  const taken: { studentId: string; studentName: string; score: number; passed: boolean; attemptNumber: number }[] = [];
  const pending: { studentId: string; studentName: string; email: string }[] = [];

  for (const doc of studentsSnap.docs) {
    const u = doc.data() as { uid: string; name: string; email: string };
    const a = terbaik.get(u.uid);
    if (a) {
      taken.push({
        studentId: u.uid,
        studentName: u.name,
        score: a.score ?? 0,
        passed: a.passed ?? false,
        attemptNumber: a.attemptNumber,
      });
    } else {
      pending.push({ studentId: u.uid, studentName: u.name, email: u.email });
    }
  }

  taken.sort((a, b) => b.score - a.score);
  pending.sort((a, b) => a.studentName.localeCompare(b.studentName, 'id'));

  return { taken, pending };
}

export async function deleteExam(actor: Actor, examId: string): Promise<void> {
  requireAdmin(actor);

  const db = getAdminDb();
  const [questions, keys, attempts, answers] = await Promise.all([
    db.collection('examQuestions').where('examId', '==', examId).get(),
    db.collection('examAnswerKeys').where('examId', '==', examId).get(),
    db.collection('examAttempts').where('examId', '==', examId).get(),
    db.collection('examAnswers').where('examId', '==', examId).get(),
  ]);

  const batch = db.batch();
  for (const snap of [questions, keys, attempts, answers]) {
    for (const d of snap.docs) batch.delete(d.ref);
  }
  batch.delete(db.collection('exams').doc(examId));
  await batch.commit();
}

/**
 * Pembahasan sebuah percobaan yang sudah selesai.
 *
 * Hanya dikembalikan bila peserta tidak dapat mengulang lagi -- sudah lulus
 * atau kesempatannya habis. Pembahasan memuat jawaban benarnya, sehingga
 * menampilkannya selagi peserta masih punya kesempatan berarti memberikan
 * kunci untuk percobaan berikutnya: ia tinggal mencatat lalu mengulang.
 *
 * Jawaban peserta sendiri selalu ditampilkan, sebab itu miliknya dan tidak
 * membocorkan apa pun yang belum ia ketahui.
 *
 * The review for a finished attempt.
 *
 * Returned only once the participant cannot retake -- they passed or ran out
 * of attempts. The review carries the correct answers, so showing it while
 * attempts remain hands over the key for the next one: they need only write it
 * down and retake.
 *
 * Their own answers always show, since those are theirs and reveal nothing
 * they do not already know.
 */
export async function getAttemptReview(
  actor: Actor,
  attemptId: string
): Promise<{
  examTitle: string;
  score: number;
  rawScore: number;
  passed: boolean;
  correctCount: number;
  attemptNumber: number;
  /** Null berarti pembahasan ditahan; alasannya ada pada withheldReason / Null means the review is withheld; see withheldReason */
  questions:
    | {
        id: string;
        text: string;
        options: { id: string; text: string }[];
        selectedOptionId: string | null;
        correctOptionId: string;
        explanation: string;
      }[]
    | null;
  withheldReason: string | null;
}> {
  if (actor.role !== 'student') {
    throw new Error('Hanya peserta yang dapat melihat pembahasan ujiannya');
  }

  const db = getAdminDb();
  const attemptSnap = await db.collection('examAttempts').doc(attemptId).get();
  if (!attemptSnap.exists) throw new Error('Percobaan tidak ditemukan');

  const attempt = attemptSnap.data() as AttemptDocument;
  if (attempt.studentId !== actor.uid) throw new Error('Percobaan ini bukan milik Anda');
  if (attempt.status !== 'selesai') throw new Error('Percobaan ini belum dikumpulkan');

  const ringkasan = {
    examTitle: attempt.examTitle,
    score: attempt.score ?? 0,
    rawScore: attempt.rawScore ?? 0,
    passed: attempt.passed ?? false,
    correctCount: attempt.correctCount ?? 0,
    attemptNumber: attempt.attemptNumber,
  };

  const semuaSnap = await db
    .collection('examAttempts')
    .where('examId', '==', attempt.examId)
    .where('studentId', '==', actor.uid)
    .get();

  const semua = semuaSnap.docs.map((d) => d.data() as AttemptDocument);
  const sudahLulus = semua.some((a) => a.passed === true);
  const kesempatanHabis = semua.length >= MAX_ATTEMPTS;

  if (!sudahLulus && !kesempatanHabis) {
    return {
      ...ringkasan,
      questions: null,
      withheldReason:
        'Pembahasan ditampilkan setelah Anda lulus atau kesempatan mengerjakan habis, supaya percobaan berikutnya tetap bermakna.',
    };
  }

  const [qSnap, kSnap, aSnap] = await Promise.all([
    db.collection('examQuestions').where('examId', '==', attempt.examId).get(),
    db.collection('examAnswerKeys').where('examId', '==', attempt.examId).get(),
    db.collection('examAnswers').where('attemptId', '==', attemptId).get(),
  ]);

  const keys = new Map<string, AnswerKeyDocument>();
  for (const d of kSnap.docs) {
    const k = d.data() as AnswerKeyDocument;
    keys.set(k.id, k);
  }

  const jawaban = new Map<string, string | null>();
  for (const d of aSnap.docs) {
    const a = d.data() as AnswerDocument;
    jawaban.set(a.questionId, a.selectedOptionId);
  }

  const byId = new Map(qSnap.docs.map((d) => {
    const q = d.data() as QuestionDocument;
    return [q.id, q];
  }));

  // Urutannya mengikuti urutan percobaan itu, bukan urutan aslinya: peserta
  // mengingat soal nomor tiga sebagaimana ia melihatnya.
  //
  // The order follows that attempt's order rather than the original: a
  // participant remembers question three as they saw it.
  const questions = attempt.questionOrder
    .map((qid) => byId.get(qid))
    .filter((q): q is QuestionDocument => Boolean(q))
    .map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options,
      selectedOptionId: jawaban.get(q.id) ?? null,
      correctOptionId: keys.get(q.id)?.correctOptionId ?? '',
      explanation: keys.get(q.id)?.explanation ?? '',
    }));

  return { ...ringkasan, questions, withheldReason: null };
}
