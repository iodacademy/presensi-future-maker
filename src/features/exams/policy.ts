// Aturan ujian: kelayakan mengerjakan, batas waktu, dan penilaian
// Exam rules: eligibility, time limits, and grading
import { MAX_ATTEMPTS, type AttemptDocument, type ExamDocument, type QuestionKind } from './types';

/**
 * Toleransi di luar batas waktu, dalam milidetik.
 *
 * Pengiriman di detik terakhir melewati jaringan yang lambat, dan menolaknya
 * karena selisih beberapa detik menghukum koneksi peserta, bukan pengerjaannya.
 *
 * Grace beyond the time limit, in milliseconds.
 *
 * A last-second submission travels over a slow network, and refusing it over a
 * few seconds punishes a participant's connection rather than their work.
 */
export const SUBMIT_GRACE_MS = 60 * 1000;

/**
 * Menghitung nilai yang berlaku setelah aturan remedial.
 *
 * Percobaan pertama dinilai apa adanya. Percobaan kedua dan ketiga yang lulus
 * dipatok tepat di nilai KKM: yang dipulihkan sebuah pengulangan adalah
 * kesempatan lulus, bukan kesempatan menaikkan angka di atas mereka yang lulus
 * sekali jalan. Pengulangan yang tetap tidak lulus memakai nilai aslinya --
 * memataknya ke KKM justru akan meluluskannya.
 *
 * Computes the score that counts once the remedial rule applies.
 *
 * A first attempt scores as it stands. A second or third attempt that passes is
 * pinned at exactly the passing mark: what a retake restores is the chance to
 * pass, not the chance to climb above those who passed first time. A retake
 * that still fails keeps its raw score -- pinning it to the mark would pass it.
 */
export function applyRemedialRule(
  rawScore: number,
  attemptNumber: number,
  passingScore: number
): number {
  if (attemptNumber <= 1) return rawScore;
  if (rawScore < passingScore) return rawScore;
  return passingScore;
}

/**
 * Memutuskan apakah peserta masih boleh mengerjakan ujian ini.
 *
 * Peserta yang sudah lulus tidak dapat mengulang: aturan remedial membuat
 * pengulangan tidak pernah menaikkan nilai di atas KKM, sehingga mengulang
 * setelah lulus hanya menghabiskan waktu untuk hasil yang sudah dimilikinya.
 *
 * Decides whether a participant may still take this exam.
 *
 * Someone who has passed cannot retake it: the remedial rule means a retake
 * never lifts a score above the passing mark, so retaking after a pass only
 * spends time on a result they already hold.
 */
export function canStartAttempt(params: {
  attempts: Pick<AttemptDocument, 'status' | 'passed'>[];
  dueAt: string | null;
  nowIso: string;
}): { allowed: boolean; reason?: string } {
  const { attempts, dueAt, nowIso } = params;

  const berlangsung = attempts.find((a) => a.status === 'berlangsung');
  if (berlangsung) {
    return { allowed: true };
  }

  if (attempts.some((a) => a.passed === true)) {
    return { allowed: false, reason: 'Anda sudah lulus ujian ini. Pengulangan tidak akan menaikkan nilainya.' };
  }

  if (attempts.length >= MAX_ATTEMPTS) {
    return { allowed: false, reason: `Kesempatan mengerjakan sudah habis (${MAX_ATTEMPTS} kali). Hubungi admin kelas Anda.` };
  }

  // Batas waktu diperiksa hanya saat memulai. Percobaan yang sudah berjalan
  // melewati batas tetap boleh diselesaikan; menghentikannya di tengah berarti
  // membuang jawaban yang sudah diisi.
  //
  // The deadline is checked only when starting. An attempt already running past
  // it may still be finished; cutting it off would throw away answers already
  // filled in.
  if (dueAt && nowIso > dueAt) {
    return { allowed: false, reason: 'Batas pengumpulan ujian ini sudah lewat.' };
  }

  return { allowed: true };
}

/**
 * Menghitung batas waktu sebuah percobaan sebagai ISO UTC.
 *
 * Null berarti tanpa batas. Mengembalikan nol atau waktu sekarang untuk ujian
 * tanpa batas akan terbaca sebagai "sudah habis" oleh setiap pemanggil yang
 * membandingkannya.
 *
 * Computes an attempt's deadline as ISO UTC.
 *
 * Null means untimed. Returning zero or the current time for an untimed exam
 * would read as "already expired" to every caller that compares it.
 */
export function attemptDeadline(startedAt: string, durationMinutes: number | null): string | null {
  if (durationMinutes === null || durationMinutes <= 0) return null;
  const mulai = new Date(startedAt).getTime();
  if (Number.isNaN(mulai)) return null;
  return new Date(mulai + durationMinutes * 60 * 1000).toISOString();
}

/**
 * Memeriksa apakah sebuah pengiriman datang terlambat.
 *
 * Dihitung dari startedAt milik server, bukan dari waktu yang dikirim peramban:
 * jam perangkat yang meleset membuat batasnya ikut meleset.
 *
 * Checks whether a submission arrived late.
 *
 * Measured from the server's own startedAt rather than a time sent by the
 * browser: a device clock that is off drags the deadline with it.
 */
export function isSubmissionLate(
  startedAt: string,
  durationMinutes: number | null,
  nowMs: number = Date.now()
): boolean {
  const batas = attemptDeadline(startedAt, durationMinutes);
  if (!batas) return false;
  return nowMs > new Date(batas).getTime() + SUBMIT_GRACE_MS;
}

/**
 * Menilai satu jawaban.
 *
 * Soal yang tidak dijawab bernilai salah, bukan tak ternilai: pembaginya adalah
 * seluruh soal, sehingga melewatkan soal tidak boleh memperkecil pembagi itu.
 *
 * Grades one answer.
 *
 * An unanswered question is wrong rather than ungraded: the divisor is every
 * question, so skipping one must not shrink that divisor.
 */
export function gradeAnswer(selectedOptionId: string | null, correctOptionId: string): boolean {
  if (!selectedOptionId) return false;
  return selectedOptionId === correctOptionId;
}

/**
 * Menghitung nilai akhir sebagai persen bulat 0-100.
 *
 * Pembaginya adalah jumlah seluruh soal ujian, bukan jumlah soal yang dijawab.
 * Memakai jumlah yang dijawab akan memberi nilai sempurna kepada peserta yang
 * menjawab satu soal dengan benar lalu mengirimkannya.
 *
 * Computes the final score as a whole percentage, 0-100.
 *
 * The divisor is the exam's total question count, not the number answered.
 * Using the number answered would hand a perfect score to anyone who answered
 * one question correctly and submitted.
 */
export function calculateScore(correctCount: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 0;
  const benar = Math.max(0, Math.min(correctCount, totalQuestions));
  return Math.round((benar / totalQuestions) * 100);
}

/**
 * Mengacak urutan soal secara tetap untuk satu percobaan.
 *
 * Memakai benih, bukan Math.random: urutannya harus sama setiap kali halaman
 * dimuat ulang dalam percobaan yang sama, agar peserta yang jaringannya
 * terputus tidak kehilangan tempatnya.
 *
 * Shuffles question order deterministically for one attempt.
 *
 * Seeded rather than Math.random: the order must be identical on every reload
 * within the same attempt, so a participant whose connection drops does not
 * lose their place.
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let state = 0;
  for (let i = 0; i < seed.length; i += 1) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  }

  const hasil = [...items];
  for (let i = hasil.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [hasil[i], hasil[j]] = [hasil[j], hasil[i]];
  }
  return hasil;
}

/**
 * Memvalidasi masukan pembuatan atau perubahan sebuah soal.
 *
 * Validates input for creating or changing a question.
 */
export function validateQuestion(input: {
  kind: QuestionKind;
  text: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
}): void {
  const teks = input.text.trim();
  if (!teks) {
    throw new Error('Pertanyaan wajib diisi');
  }

  if (input.kind === 'benar-salah') {
    if (input.options.length !== 2) {
      throw new Error('Soal benar/salah harus memiliki tepat dua pilihan');
    }
  } else if (input.options.length < 2) {
    throw new Error('Soal pilihan ganda membutuhkan minimal dua pilihan');
  } else if (input.options.length > 5) {
    throw new Error('Soal pilihan ganda maksimal lima pilihan');
  }

  for (const o of input.options) {
    if (!o.text.trim()) {
      throw new Error('Setiap pilihan wajib diisi');
    }
  }

  // Tanpa kunci, soal itu menilai setiap jawaban sebagai salah dan tidak ada
  // yang dapat lulus karenanya.
  //
  // With no key, the question marks every answer wrong and nobody can pass it.
  if (!input.options.some((o) => o.id === input.correctOptionId)) {
    throw new Error('Jawaban benar wajib dipilih dari salah satu pilihan');
  }
}

/**
 * Memeriksa apakah sebuah ujian layak diterbitkan.
 *
 * Checks whether an exam is fit to publish.
 */
export function canPublishExam(exam: Pick<ExamDocument, 'questionCount'>): { allowed: boolean; reason?: string } {
  // Ujian tanpa soal yang terbit menolak setiap peserta yang membukanya,
  // sehingga kesalahannya baru ketahuan dari keluhan peserta.
  //
  // A published exam with no questions turns away everyone who opens it, so the
  // mistake only surfaces through participant complaints.
  if (exam.questionCount < 1) {
    return { allowed: false, reason: 'Ujian tanpa soal tidak dapat diterbitkan' };
  }
  return { allowed: true };
}
