// Layanan ujian: penyusunan soal, pengerjaan, dan penilaian
// Exam service: authoring, running, and grading
import { computeExamLocks, lockMessage, type ExamLock, type SequenceExam } from './sequence';
import { formatLongDateTimeWib } from '../../lib/time';
import crypto from 'crypto';
import { getAdminDb } from '../../lib/firebase/admin';
import { deleteExamImage } from '../uploads/service';
import { jenisDariJudul, normalJudul } from './import-policy';
import type { Actor, UserDocument } from '../auth/types';
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
    imageUrl?: string | null;
    imagePath?: string | null;
    options: { text: string; imageUrl?: string | null; imagePath?: string | null }[];
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
  const options = input.options.map((o) => ({
    id: crypto.randomUUID(),
    text: o.text.trim(),
    imageUrl: o.imageUrl ?? null,
    imagePath: o.imagePath ?? null,
  }));
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
    imageUrl: input.imageUrl ?? null,
    imagePath: input.imagePath ?? null,
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

/**
 * Menambahkan banyak soal sekaligus dari berkas yang diunggah.
 *
 * Seluruh soal ditulis dalam satu batch, bukan satu per satu: dua puluh
 * pemanggilan berurutan dapat berhenti di tengah dan menyisakan ujian yang
 * memuat sebagian soal tanpa admin tahu bagian mana yang gagal.
 *
 * Adds many questions at once from an uploaded sheet.
 *
 * Every question is written in one batch rather than one at a time: twenty
 * sequential calls can stop halfway and leave an exam holding some of its
 * questions with no way for the admin to tell which ones failed.
 */
export async function importQuestions(
  actor: Actor,
  examId: string,
  parsed: {
    kind: QuestionKind;
    text: string;
    options: { text: string }[];
    correctIndex: number;
    explanation: string;
  }[]
): Promise<{ imported: number }> {
  requireAdmin(actor);

  if (parsed.length === 0) {
    throw new Error('Tidak ada soal yang dapat diimpor');
  }

  const db = getAdminDb();
  const examRef = db.collection('exams').doc(examId);
  const examSnap = await examRef.get();
  if (!examSnap.exists) throw new Error('Ujian tidak ditemukan');

  const exam = examSnap.data() as ExamDocument;
  const now = new Date().toISOString();
  const batch = db.batch();

  parsed.forEach((p, i) => {
    const options = p.options.map((o) => ({ id: crypto.randomUUID(), text: o.text.trim() }));
    const correct = options[p.correctIndex];

    // Divalidasi ulang di sini meski pembacanya sudah memeriksa: berkas
    // dibaca di peramban, dan muatan yang dikirim ke endpoint ini dapat
    // diubah sebelum tiba.
    //
    // Revalidated here although the parser already checked: the sheet is read
    // in the browser, and the payload sent to this endpoint can be altered
    // before it arrives.
    validateQuestion({
      kind: p.kind,
      text: p.text,
      options,
      correctOptionId: correct?.id ?? '',
    });

    const id = crypto.randomUUID();

    batch.set(db.collection('examQuestions').doc(id), {
      id,
      examId,
      kind: p.kind,
      text: p.text.trim(),
      options,
      order: exam.questionCount + i + 1,
      createdAt: now,
      updatedAt: now,
    } satisfies QuestionDocument);

    batch.set(db.collection('examAnswerKeys').doc(id), {
      id,
      examId,
      correctOptionId: correct.id,
      explanation: p.explanation.trim(),
      updatedAt: now,
    } satisfies AnswerKeyDocument);
  });

  batch.update(examRef, { questionCount: exam.questionCount + parsed.length, updatedAt: now });
  await batch.commit();

  return { imported: parsed.length };
}

/**
 * Menghapus seluruh gambar sebuah soal.
 *
 * Kegagalan tiap berkas ditelan oleh deleteExamImage: berkas yang sudah tidak
 * ada bukan kesalahan, dan menggagalkan penghapusan soal karena gambarnya
 * hilang meninggalkan soal yang tidak dapat dihapus sama sekali.
 *
 * Deletes all of a question's images.
 *
 * Each file's failure is swallowed by deleteExamImage: a file already gone is
 * not an error, and failing a question's deletion because its image is missing
 * would leave a question that cannot be deleted at all.
 */
async function removeQuestionImages(actor: Actor, question: QuestionDocument): Promise<void> {
  const paths = [question.imagePath, ...question.options.map((o) => o.imagePath)].filter(
    (p): p is string => Boolean(p)
  );

  await Promise.all(paths.map((p) => deleteExamImage(actor, p)));
}

/**
 * Menyunting soal yang sudah ada.
 *
 * Sebelumnya soal hanya dapat dibuat dan dihapus, sehingga satu huruf yang
 * salah pada soal kedelapan belas menuntut admin menghapusnya lalu mengetik
 * ulang pertanyaan, seluruh pilihan, kunci, pembahasan, dan mengunggah ulang
 * gambarnya -- dan soal itu pindah ke urutan terakhir karena nomornya diambil
 * dari jumlah soal.
 *
 * Pilihan yang dikirim menggantikan seluruh pilihan lama, bukan ditambalkan
 * satu per satu: menyamakan pilihan lama dengan yang baru menuntut penanda
 * yang tidak dikirim peramban, dan mencocokkannya berdasarkan urutan akan
 * salah begitu satu pilihan disisipkan di tengah.
 *
 * Id pilihan dipertahankan sejauh jumlahnya masih sama. Id yang berganti
 * membuat jawaban peserta yang sudah tersimpan menunjuk pilihan yang tidak ada
 * lagi, dan hasil yang sudah dinilai berubah tanpa ada yang menyentuhnya.
 *
 * Edits an existing question.
 *
 * Previously a question could only be created and deleted, so one wrong letter in
 * the eighteenth question meant deleting it and retyping the question, every
 * option, the key, the explanation, and re-uploading its images -- and that
 * question moved to the end, since its number came from the question count.
 *
 * The options sent replace the old ones wholesale rather than being patched one
 * by one: matching old options to new ones needs an identifier the browser does
 * not send, and matching by position breaks as soon as one is inserted in the
 * middle.
 *
 * Option ids are preserved while the count is unchanged. Changing ids would leave
 * an already-saved participant answer pointing at an option that no longer
 * exists, and a graded result would change with nobody touching it.
 */
export async function updateQuestion(
  actor: Actor,
  questionId: string,
  input: {
    kind: QuestionKind;
    text: string;
    imageUrl?: string | null;
    imagePath?: string | null;
    options: { text: string; imageUrl?: string | null; imagePath?: string | null }[];
    correctIndex: number;
    explanation?: string;
  }
): Promise<void> {
  requireAdmin(actor);

  const db = getAdminDb();
  const qRef = db.collection('examQuestions').doc(questionId);
  const qSnap = await qRef.get();
  if (!qSnap.exists) throw new Error('Soal tidak ditemukan');

  const lama = qSnap.data() as QuestionDocument;

  const options = input.options.map((o, i) => ({
    id: lama.options.length === input.options.length ? lama.options[i].id : crypto.randomUUID(),
    text: o.text.trim(),
    imageUrl: o.imageUrl ?? null,
    imagePath: o.imagePath ?? null,
  }));
  const correct = options[input.correctIndex];

  validateQuestion({
    kind: input.kind,
    text: input.text,
    imageUrl: input.imageUrl,
    options,
    correctOptionId: correct?.id ?? '',
  });

  // Gambar yang tidak lagi dipakai dihapus dari penyimpanan. Tanpa ini, tiap
  // penggantian gambar meninggalkan berkas yang tidak dapat dicapai siapa pun
  // namun tetap ditagihkan.
  //
  // Images no longer referenced are removed from storage. Without this, every
  // replaced image leaves a file nobody can reach yet which is still billed.
  const dipakai = new Set(
    [input.imagePath, ...input.options.map((o) => o.imagePath)].filter((p): p is string => Boolean(p))
  );
  const usang = [lama.imagePath, ...lama.options.map((o) => o.imagePath)]
    .filter((p): p is string => Boolean(p))
    .filter((p) => !dipakai.has(p));
  await Promise.all(usang.map((p) => deleteExamImage(actor, p)));

  const now = new Date().toISOString();

  const batch = db.batch();
  batch.update(qRef, {
    kind: input.kind,
    text: input.text.trim(),
    imageUrl: input.imageUrl ?? null,
    imagePath: input.imagePath ?? null,
    options,
    updatedAt: now,
  });
  // Kuncinya ikut diperbarui dalam batch yang sama: kunci yang menunjuk pilihan
  // yang sudah diganti akan menilai seluruh jawaban sebagai salah.
  //
  // The key is updated in the same batch: a key pointing at a replaced option
  // would mark every answer wrong.
  batch.set(
    db.collection('examAnswerKeys').doc(questionId),
    {
      id: questionId,
      examId: lama.examId,
      correctOptionId: correct.id,
      explanation: (input.explanation ?? '').trim(),
      updatedAt: now,
    } satisfies AnswerKeyDocument
  );
  await batch.commit();
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

  // Gambarnya dihapus lebih dulu, di luar batch: batch Firestore hanya menulis
  // dokumen, dan berkas penyimpanan tidak termasuk di dalamnya.
  //
  // The images go first, outside the batch: a Firestore batch only writes
  // documents, and storage files are not among them.
  await removeQuestionImages(actor, question);

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

/**
 * Mencari pertemuan untuk kuis yang dibuat lewat impor.
 *
 * Pertama dicocokkan dengan judul sesinya: judul bawaan sebuah kuis adalah
 * "Kuis" disusul judul sesinya, sehingga berkas yang memakai judul bawaan
 * cocok persis. Bila tidak, dicocokkan dengan nomor pertemuannya, asalkan
 * hanya satu sesi yang memakai nomor itu -- dua sesi bernomor sama tidak dapat
 * dipilih tanpa menebak.
 *
 * Finds the meeting for a quiz created by the import.
 *
 * First it matches on the session title: a quiz's default title is "Kuis"
 * followed by its session's title, so a sheet using default titles matches
 * exactly. Failing that, it matches on the meeting number, provided only one
 * session uses that number -- two sessions sharing a number cannot be picked
 * between without guessing.
 */
export function cariSesiKuis<T extends { title: string }>(judulKuis: string, sesi: T[]): T | null {
  const tanpaAwalan = normalJudul(judulKuis.replace(/^\s*(kuis|quiz)\b\s*/i, ''));
  const persis = sesi.find((x) => normalJudul(x.title) === tanpaAwalan);
  if (persis) return persis;

  const nomor = judulKuis.match(/pertemuan\s*(\d+)/i)?.[1];
  if (!nomor) return null;
  const senomor = sesi.filter((x) => x.title.match(/pertemuan\s*(\d+)/i)?.[1] === nomor);
  return senomor.length === 1 ? senomor[0] : null;
}

/**
 * Mengganti seluruh soal beberapa ujian sekaligus dari satu berkas.
 *
 * Mengganti, bukan menambahkan: berkas yang sama diimpor dua kali akan
 * menggandakan seluruh soalnya, dan admin yang memperbaiki satu ejaan lalu
 * mengimpor ulang mendapat dua salinan tiap soal.
 *
 * Ditulis dalam beberapa batch bila perlu. Satu batch Firestore menampung lima
 * ratus operasi, sedangkan empat belas ujian berisi dua puluh soal menuntut
 * seribu lebih -- satu batch akan menolak justru pada kelas yang paling lengkap
 * soalnya.
 *
 * Penghapusan seluruh soal lama diselesaikan lebih dulu, baru soal barunya
 * ditulis. Terbalik, kegagalan di tengah dapat menyisakan soal lama dan baru
 * bersamaan dalam satu ujian, dan peserta mengerjakan soal rangkap.
 *
 * Replaces several exams' questions at once from one sheet.
 *
 * Replacing rather than appending: importing the same sheet twice would double
 * every question, and an admin fixing one spelling then re-importing would get two
 * copies of each.
 *
 * It all goes in one batch. Stopping halfway would leave some exams on the new
 * questions and others on the old, with nothing to say which -- a worse state than
 * failing outright.
 */
export async function importQuestionsForClass(
  actor: Actor,
  classId: string,
  perExam: { examTitle: string; questions: { kind: QuestionKind; text: string; options: { text: string }[]; correctIndex: number; explanation: string }[] }[]
): Promise<{ examCount: number; created: number; imported: number; replaced: number; draftExamIds: string[] }> {
  requireAdmin(actor);

  if (perExam.length === 0) {
    throw new Error('Tidak ada soal yang dapat diimpor');
  }

  const db = getAdminDb();
  const examsSnap = await db.collection('exams').where('classId', '==', classId).get();
  const exams = examsSnap.docs.map((d) => d.data() as ExamDocument);

  const petaUjian = new Map(exams.map((e) => [normalJudul(e.title), e]));

  /**
   * Ujian yang belum ada disiapkan di memori lebih dulu, belum ditulis.
   *
   * Seluruh judul baru diperiksa sebelum satu dokumen pun ditulis: kuis di baris
   * terakhir yang tidak menemukan pertemuannya tidak boleh menyisakan tiga belas
   * ujian lain sudah terbuat dan terisi.
   *
   * Exams not yet present are prepared in memory first, not written.
   *
   * Every new title is checked before a single document is written: a quiz in the
   * last row that cannot find its meeting must not leave thirteen other exams
   * already created and filled.
   */
  const asing = perExam.filter((x) => !petaUjian.has(normalJudul(x.examTitle)));
  const ujianBaru: ExamDocument[] = [];

  if (asing.length > 0) {
    // Sesi lama hanya memuat classId, sesi gabungan memuat classIds. Keduanya
    // dibaca supaya kuis untuk onboarding bersama tetap menemukan sesinya.
    //
    // Older sessions carry only classId, shared ones carry classIds. Both are read
    // so a quiz for a shared onboarding still finds its session.
    const [sendiri, gabungan] = await Promise.all([
      db.collection('sessions').where('classId', '==', classId).get(),
      db.collection('sessions').where('classIds', 'array-contains', classId).get(),
    ]);
    const sesi = new Map<string, { id: string; title: string }>();
    for (const d of [...sendiri.docs, ...gabungan.docs]) {
      const x = d.data() as { id: string; title: string };
      sesi.set(x.id, { id: x.id, title: x.title });
    }
    const daftarSesi = [...sesi.values()];

    const masalah: string[] = [];
    const now = new Date().toISOString();

    for (const x of asing) {
      const kind = jenisDariJudul(x.examTitle);
      if (!kind) {
        masalah.push(`"${x.examTitle}": jenisnya tidak terbaca, awali judulnya dengan Kuis, Pretest, atau Postest`);
        continue;
      }

      let sessionId: string | null = null;
      if (kind === 'kuis') {
        const cocok = cariSesiKuis(x.examTitle, daftarSesi);
        if (!cocok) {
          masalah.push(`"${x.examTitle}": pertemuannya tidak ditemukan di jadwal kelas ini`);
          continue;
        }
        sessionId = cocok.id;
      }

      const exam: ExamDocument = {
        id: crypto.randomUUID(),
        classId,
        kind,
        sessionId,
        title: x.examTitle.trim().replace(/\s+/g, ' '),
        description: '',
        durationMinutes: null,
        passingScore: DEFAULT_PASSING_SCORE,
        dueAt: null,
        questionCount: 0,
        // Ujian baru tetap draf. Menerbitkannya sendiri berarti seratus soal
        // langsung terlihat peserta sebelum admin sempat memeriksanya sekali pun.
        //
        // A new exam stays a draft. Publishing it automatically would put a hundred
        // questions in front of participants before an admin has checked even one.
        published: false,
        createdAt: now,
        updatedAt: now,
      };
      ujianBaru.push(exam);
      petaUjian.set(normalJudul(exam.title), exam);
    }

    if (masalah.length > 0) {
      throw new Error(`Ujian berikut tidak dapat dibuat:\n${masalah.join('\n')}`);
    }
  }

  const sasaran = perExam.map((x) => ({ exam: petaUjian.get(normalJudul(x.examTitle))!, questions: x.questions }));

  // Soal lama dibaca sebelum apa pun ditulis, sekaligus untuk seluruh ujian
  // yang disentuh.
  //
  // The old questions are read before anything is written, for every exam being
  // touched at once.
  const lamaSnaps = await Promise.all(
    sasaran.map((t) => db.collection('examQuestions').where('examId', '==', t.exam.id).get())
  );

  // Gambar soal lama dihapus dari penyimpanan, di luar batch: batch Firestore
  // hanya menulis dokumen, dan berkas penyimpanan tidak termasuk di dalamnya.
  // Dilakukan sebelum batch karena gambar yang dokumennya sudah terhapus tidak
  // dapat ditemukan lagi untuk dibersihkan.
  //
  // The old questions' images are deleted from storage, outside the batch: a
  // Firestore batch only writes documents, and storage files are not among them.
  // Done before the batch because an image whose document is already gone can no
  // longer be found to clean up.
  const semuaLama = lamaSnaps.flatMap((snap) => snap.docs.map((d) => d.data() as QuestionDocument));
  await Promise.all(
    semuaLama
      .flatMap((q) => [q.imagePath, ...q.options.map((o) => o.imagePath)])
      .filter((p): p is string => Boolean(p))
      .map((p) => deleteExamImage(actor, p))
  );

  const now = new Date().toISOString();

  /**
   * Operasi yang dikumpulkan, lalu dijalankan dalam batch berukuran aman.
   *
   * Satu batch Firestore menampung lima ratus operasi. Menghitungnya sendiri
   * jauh lebih murah daripada menemukan batasnya saat admin menekan impor pada
   * kelas yang soalnya paling lengkap.
   *
   * Collected operations, then run in safely sized batches.
   *
   * One Firestore batch holds five hundred operations. Counting them here costs
   * far less than discovering the limit when an admin presses import on the class
   * with the fullest question bank.
   */
  const BATAS_BATCH = 400;

  async function jalankan(tulis: ((b: FirebaseFirestore.WriteBatch) => void)[]) {
    for (let i = 0; i < tulis.length; i += BATAS_BATCH) {
      const batch = db.batch();
      for (const t of tulis.slice(i, i + BATAS_BATCH)) t(batch);
      await batch.commit();
    }
  }

  const hapus: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
  const tulis: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
  let imported = 0;

  lamaSnaps.forEach((snap) => {
    for (const d of snap.docs) {
      hapus.push((b) => b.delete(d.ref));
      // Kunci yang tertinggal tanpa soalnya tidak pernah terbaca lagi, tetapi
      // tetap memuat jawaban benar yang dapat dibaca siapa pun yang berwenang
      // membaca koleksi itu kelak.
      //
      // A key left behind without its question is never read again, yet still
      // holds a correct answer readable by whoever may later read that collection.
      hapus.push((b) => b.delete(db.collection('examAnswerKeys').doc(d.id)));
    }
  });

  // Ujian baru ditulis di depan antrean, sebelum soal-soalnya: soal yang
  // menunjuk ujian yang belum ada akan tampil sebagai yatim bila batch
  // berikutnya gagal.
  //
  // New exams go at the head of the queue, ahead of their questions: a question
  // pointing at an exam that does not exist yet would be orphaned if a later batch
  // failed.
  for (const exam of ujianBaru) {
    tulis.push((b) => b.set(db.collection('exams').doc(exam.id), exam));
  }

  for (const { exam, questions } of sasaran) {
    questions.forEach((p, i) => {
      const options = p.options.map((o) => ({ id: crypto.randomUUID(), text: o.text.trim() }));
      const correct = options[p.correctIndex];

      // Divalidasi ulang meski pembacanya sudah memeriksa: berkas dibaca di
      // peramban, dan muatan yang dikirim ke endpoint ini dapat diubah sebelum
      // tiba.
      //
      // Revalidated although the parser already checked: the sheet is read in the
      // browser, and the payload sent to this endpoint can be altered before it
      // arrives.
      validateQuestion({
        kind: p.kind,
        text: p.text,
        options,
        correctOptionId: correct?.id ?? '',
      });

      const id = crypto.randomUUID();

      tulis.push((b) =>
        b.set(db.collection('examQuestions').doc(id), {
          id,
          examId: exam.id,
          kind: p.kind,
          text: p.text.trim(),
          imageUrl: null,
          imagePath: null,
          options,
          order: i + 1,
          createdAt: now,
          updatedAt: now,
        } satisfies QuestionDocument)
      );

      tulis.push((b) =>
        b.set(db.collection('examAnswerKeys').doc(id), {
          id,
          examId: exam.id,
          correctOptionId: correct.id,
          explanation: p.explanation.trim(),
          updatedAt: now,
        } satisfies AnswerKeyDocument)
      );

      imported += 1;
    });

    tulis.push((b) =>
      b.update(db.collection('exams').doc(exam.id), {
        questionCount: questions.length,
        updatedAt: now,
      })
    );
  }

  // Penghapusannya diselesaikan lebih dulu: terbalik, kegagalan di tengah dapat
  // menyisakan soal lama dan baru bersamaan dalam satu ujian, dan peserta
  // mengerjakan soal rangkap.
  //
  // The deletions finish first: the other way round, a failure midway could leave
  // old and new questions together in one exam, and participants would sit
  // duplicated questions.
  await jalankan(hapus);
  await jalankan(tulis);

  return {
    examCount: sasaran.length,
    created: ujianBaru.length,
    imported,
    replaced: semuaLama.length,
    // Ujian yang disentuh impor ini dan belum terbit, untuk ditanyakan
    // statusnya kepada admin setelah impornya selesai.
    //
    // Exams this import touched that are not yet published, so the admin can be
    // asked about their status once the import finishes.
    draftExamIds: sasaran.filter((t) => !t.exam.published).map((t) => t.exam.id),
  };
}

/**
 * Menerbitkan beberapa ujian satu kelas sekaligus.
 *
 * Seluruhnya diperiksa lebih dulu, lalu ditulis dalam satu batch: terbit
 * sebagian berarti peserta melihat kuis pertemuan 3 tanpa kuis pertemuan 2,
 * dan tidak ada yang memberi tahu admin bagian mana yang tertinggal.
 *
 * Id yang bukan milik kelas itu ditolak. Tanpa pemeriksaan ini, satu id dari
 * kelas lain akan menerbitkan ujian yang bukan urusan halaman ini.
 *
 * Publishes several of one class's exams at once.
 *
 * Everything is checked first, then written in one batch: a partial publish would
 * show participants the meeting 3 quiz without meeting 2's, with nothing telling
 * the admin which ones were left behind.
 *
 * An id not belonging to that class is refused. Without this check, one id from
 * another class would publish an exam this page has no business touching.
 */
export async function publishExams(actor: Actor, classId: string, examIds: string[]): Promise<{ published: number }> {
  requireAdmin(actor);

  const unik = [...new Set(examIds)];
  if (unik.length === 0) return { published: 0 };
  // Satu batch Firestore menampung lima ratus operasi; satu kelas tidak
  // pernah mendekati itu, tetapi muatan dari peramban dapat diubah.
  //
  // One Firestore batch holds five hundred operations; no class comes close, but a
  // payload from the browser can be altered.
  if (unik.length > 400) throw new Error('Terlalu banyak ujian sekaligus');

  const db = getAdminDb();
  const snaps = await Promise.all(unik.map((id) => db.collection('exams').doc(id).get()));

  const masalah: string[] = [];
  for (const snap of snaps) {
    if (!snap.exists) {
      masalah.push(`Ujian ${snap.id} tidak ditemukan`);
      continue;
    }
    const exam = snap.data() as ExamDocument;
    if (exam.classId !== classId) {
      masalah.push(`"${exam.title}" bukan milik kelas ini`);
      continue;
    }
    // Aturan yang sama dengan menerbitkan satu per satu: ujian tanpa soal
    // menolak setiap peserta yang membukanya.
    //
    // The same rule as publishing one at a time: an exam with no questions turns
    // away every participant who opens it.
    const { allowed, reason } = canPublishExam(exam);
    if (!allowed) masalah.push(`"${exam.title}": ${reason}`);
  }
  if (masalah.length > 0) throw new Error(masalah.join('\n'));

  const now = new Date().toISOString();
  const batch = db.batch();
  for (const snap of snaps) batch.update(snap.ref, { published: true, updatedAt: now });
  await batch.commit();

  return { published: snaps.length };
}

/**
 * Mengurutkan ulang soal sebuah ujian.
 *
 * Seluruh urutan dikirim sekaligus, bukan "pindahkan yang ini ke sana":
 * menukar dua soal mengubah nomor keduanya, dan dua permintaan terpisah dapat
 * berhenti di tengah sehingga dua soal memakai nomor yang sama.
 *
 * Id yang dikirim diperiksa terhadap soal ujian ini. Tanpa itu, id dari ujian
 * lain akan menulis nomor pada soal yang bukan miliknya.
 *
 * Reorders an exam's questions.
 *
 * The whole order is sent at once rather than "move this one there": swapping two
 * questions changes both their numbers, and two separate requests can stop halfway
 * leaving two questions sharing a number.
 *
 * The ids sent are checked against this exam's questions. Without that, an id from
 * another exam would write a number onto a question that is not its own.
 */
export async function reorderQuestions(actor: Actor, examId: string, order: string[]): Promise<void> {
  requireAdmin(actor);

  const db = getAdminDb();
  const snap = await db.collection('examQuestions').where('examId', '==', examId).get();
  const milik = new Set(snap.docs.map((d) => d.id));

  if (order.length !== milik.size || order.some((id) => !milik.has(id))) {
    throw new Error('Urutan tidak cocok dengan soal ujian ini');
  }

  const now = new Date().toISOString();
  const batch = db.batch();
  order.forEach((id, i) => {
    batch.update(db.collection('examQuestions').doc(id), { order: i + 1, updatedAt: now });
  });
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

export async function getExamById(examId: string): Promise<ExamDocument | null> {
  const db = getAdminDb();
  const snap = await db.collection('exams').doc(examId).get();
  return snap.exists ? (snap.data() as ExamDocument) : null;
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
/**
 * Status kunci satu kuis bagi seorang peserta, menurut urutan pretest, kuis
 * sesi, postest dan jadwal pertemuannya.
 *
 * The lock state of one quiz for a participant, by the pretest, session quiz,
 * posttest order and its meeting schedule.
 */
async function examLockFor(actor: Actor, exam: ExamDocument): Promise<ExamLock> {
  const db = getAdminDb();
  const classId = actor.classId!;
  const [examsSnap, ownedSnap, sharedSnap, attemptsSnap] = await Promise.all([
    db.collection('exams').where('classId', '==', classId).where('published', '==', true).select('id', 'title', 'kind', 'sessionId', 'questionCount', 'dueAt').get(),
    // Dua kueri sesi seperti listSessionsForClass: sesi bersama mencantumkan kelasnya di classIds.
    // Two session queries like listSessionsForClass: a shared session lists the class in classIds.
    db.collection('sessions').where('classId', '==', classId).select('id', 'startsAt').get(),
    db.collection('sessions').where('classIds', 'array-contains', classId).select('id', 'startsAt').get(),
    db.collection('examAttempts').where('studentId', '==', actor.uid).select('examId', 'status').get(),
  ]);
  const sessions = new Map<string, { id: string; startsAt: string }>();
  for (const d of [...ownedSnap.docs, ...sharedSnap.docs]) {
    const x = d.data() as { id: string; startsAt: string };
    sessions.set(x.id, x);
  }
  const finished = new Set(
    attemptsSnap.docs.map((d) => d.data() as { examId: string; status: string }).filter((a) => a.status === 'selesai').map((a) => a.examId)
  );
  const locks = computeExamLocks({
    exams: examsSnap.docs.map((d) => d.data() as SequenceExam),
    sessions: [...sessions.values()],
    finishedExamIds: finished,
    nowIso: new Date().toISOString(),
  });
  return locks.get(exam.id) ?? { locked: false };
}

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
  savedDoubts: string[];
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

  // Urutan dan jadwal diperiksa hanya saat memulai percobaan baru. Percobaan
  // yang sedang berjalan tetap boleh dilanjutkan: memutusnya di tengah berarti
  // membuang jawaban yang sudah diisi.
  //
  // Order and schedule are checked only when starting a new attempt. An attempt
  // already running may continue: cutting it off would discard answers already
  // filled in.
  if (!attempts.some((a) => a.status === 'berlangsung')) {
    const lock = await examLockFor(actor, exam);
    const message = lockMessage(lock, formatLongDateTimeWib);
    if (message) throw new Error(message);
  }

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
  const savedDoubts: string[] = [];
  for (const d of savedSnap.docs) {
    const a = d.data() as AnswerDocument;
    if (a.selectedOptionId) savedAnswers[a.questionId] = a.selectedOptionId;
    if (a.isDoubtful) savedDoubts.push(a.questionId);
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
    savedDoubts,
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
  selectedOptionId: string | null,
  isDoubtful = false
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
      isDoubtful,
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
  const ragu: Record<string, boolean> = {};
  for (const d of draftSnap.docs) {
    const a = d.data() as AnswerDocument;
    ragu[a.questionId] = a.isDoubtful === true;
  }

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
      isDoubtful: ragu[q.id] === true,
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
/**
 * Rekap nilai seluruh ujian satu kelas, satu baris per peserta.
 *
 * Dibaca sekali untuk seluruh kelas, bukan satu ujian per panggilan: empat
 * belas ujian lewat getExamRoster berarti dua puluh delapan kueri untuk satu
 * berkas, dan peserta yang sama dibaca empat belas kali.
 *
 * Kolomnya berurut sebagaimana peserta menemuinya: pretest, kuis menurut
 * tanggal pertemuannya, lalu posttest. Urutan abjad judul akan menaruh "Kuis
 * Pertemuan 10" sebelum "Kuis Pertemuan 2".
 *
 * Satu kelas satu berkas, bukan satu jurusan: kuis pertemuan ketiga di
 * Yogyakarta dan di Surabaya adalah ujian berbeda dengan soal berbeda, dan
 * menyatukannya ke satu kolom menyajikan dua angka yang tidak sebanding seolah
 * setara.
 *
 * Every exam's scores for one class, one row per participant.
 *
 * Read once for the whole class rather than one exam per call: fourteen exams
 * through getExamRoster would be twenty-eight queries for one file, with the same
 * participants read fourteen times.
 *
 * The columns run in the order a participant meets them: pretest, quizzes by their
 * meeting date, then posttest. Sorting titles alphabetically would put "Kuis
 * Pertemuan 10" before "Kuis Pertemuan 2".
 *
 * One class per file, not one stream: the third meeting's quiz in Yogyakarta and
 * in Surabaya are different exams with different questions, and merging them into
 * one column would present two incomparable numbers as if they were the same.
 */
export async function getClassExamScores(
  actor: Actor,
  classId: string
): Promise<{
  className: string;
  programName: string;
  city: string;
  exams: { id: string; title: string; kind: ExamKind; passingScore: number }[];
  rows: {
    studentName: string;
    email: string;
    /** Nilai per ujian, searah dengan exams; null berarti tidak dikerjakan / Score per exam, aligned with exams; null means not attempted */
    scores: (number | null)[];
    /** Percobaan keberapa nilai itu diperoleh; null bila tidak dikerjakan / Which attempt produced it; null when not attempted */
    attempts: (number | null)[];
  }[];
}> {
  requireAdmin(actor);

  const db = getAdminDb();
  const [classSnap, examsSnap, studentsSnap, sessionsSnap] = await Promise.all([
    db.collection('classes').doc(classId).get(),
    db.collection('exams').where('classId', '==', classId).get(),
    db
      .collection('users')
      .where('classId', '==', classId)
      .where('role', '==', 'student')
      .where('active', '==', true)
      .get(),
    db.collection('sessions').where('classId', '==', classId).get(),
  ]);

  if (!classSnap.exists) throw new Error('Kelas tidak ditemukan');
  const kelas = classSnap.data() as { canonicalName: string; programName?: string; city: string };

  const tanggalSesi = new Map<string, string>();
  for (const d of sessionsSnap.docs) {
    const sesi = d.data() as { id: string; date: string };
    tanggalSesi.set(sesi.id, sesi.date);
  }

  // Pretest selalu di depan dan posttest selalu di belakang, apa pun tanggal
  // ujiannya dibuat: keduanya menjepit perjalanan belajar peserta, dan
  // membacanya berdampingan adalah alasan berkas ini dibuka.
  //
  // The pretest always leads and the posttest always trails, whatever date they
  // were created: the two bracket a participant's progress, and reading them side
  // by side is why this file is opened.
  const urutanJenis: Record<string, number> = { pretest: 0, kuis: 1, posttest: 2 };
  const exams = examsSnap.docs
    .map((d) => d.data() as ExamDocument)
    .sort((a, b) => {
      const j = (urutanJenis[a.kind] ?? 1) - (urutanJenis[b.kind] ?? 1);
      if (j !== 0) return j;
      const ta = a.sessionId ? tanggalSesi.get(a.sessionId) ?? '' : '';
      const tb = b.sessionId ? tanggalSesi.get(b.sessionId) ?? '' : '';
      if (ta !== tb) return ta.localeCompare(tb);
      return a.title.localeCompare(b.title, 'id');
    })
    .map((e) => ({ id: e.id, title: e.title, kind: e.kind, passingScore: e.passingScore }));

  if (exams.length === 0) {
    return { className: kelas.canonicalName, programName: kelas.programName ?? '', city: kelas.city, exams: [], rows: [] };
  }

  // Percobaan dibaca per ujian karena Firestore membatasi "in" pada tiga puluh
  // nilai, dan satu kelas dapat memiliki lebih banyak ujian daripada itu.
  // Dijalankan bersamaan, bukan berurutan.
  //
  // Attempts are read per exam because Firestore caps "in" at thirty values, and a
  // class can hold more exams than that. Run together rather than in sequence.
  const attemptSnaps = await Promise.all(
    exams.map((e) => db.collection('examAttempts').where('examId', '==', e.id).get())
  );

  // Nilai tertinggi tiap peserta per ujian. Percobaan kedua yang lulus sudah
  // dipatok pada KKM saat disimpan, sehingga yang tertinggi adalah yang berlaku.
  //
  // Each participant's highest score per exam. A passing second attempt was
  // already capped at the passing score when stored, so the highest is the one
  // that counts.
  const nilai = new Map<string, Map<string, { score: number; attemptNumber: number }>>();
  attemptSnaps.forEach((snap, i) => {
    const peta = new Map<string, { score: number; attemptNumber: number }>();
    for (const d of snap.docs) {
      const a = d.data() as { studentId: string; status: string; score: number | null; attemptNumber: number };
      if (a.status !== 'selesai' || a.score === null) continue;
      const ada = peta.get(a.studentId);
      if (!ada || a.score > ada.score) peta.set(a.studentId, { score: a.score, attemptNumber: a.attemptNumber });
    }
    nilai.set(exams[i].id, peta);
  });

  const rows = studentsSnap.docs
    .map((d) => d.data() as UserDocument)
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
    .map((u) => ({
      studentName: u.name,
      email: u.email,
      // Tidak dikerjakan bernilai null, bukan nol: nol berarti dikerjakan dan
      // salah semua, dan menyamakan keduanya menurunkan rata-rata kelas dengan
      // angka yang tidak pernah diperoleh siapa pun.
      //
      // Not attempted is null, not zero: zero means attempted and all wrong, and
      // merging the two drags the class average down with a figure nobody earned.
      scores: exams.map((e) => nilai.get(e.id)?.get(u.uid)?.score ?? null),
      attempts: exams.map((e) => nilai.get(e.id)?.get(u.uid)?.attemptNumber ?? null),
    }));

  return {
    className: kelas.canonicalName,
    programName: kelas.programName ?? '',
    city: kelas.city,
    exams,
    rows,
  };
}

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

  await Promise.all(
    questions.docs.map((d) => removeQuestionImages(actor, d.data() as QuestionDocument))
  );

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
