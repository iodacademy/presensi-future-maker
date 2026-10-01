// Definisi tipe ujian, soal, dan percobaan / Exam, question, and attempt type definitions

/**
 * Jenis ujian.
 *
 * 'pretest' dikerjakan sebelum materi dimulai dan mengukur titik awal peserta,
 * sedangkan 'kuis' terikat pada satu pertemuan. Keduanya memakai mesin
 * pengerjaan dan penilaian yang sama; yang membedakan hanya keterikatannya
 * pada sesi dan tempat tampilnya.
 *
 * Exam kind.
 *
 * A 'pretest' is taken before the material starts and measures where a
 * participant begins, while a 'kuis' is tied to one meeting. Both use the same
 * engine and grading; what differs is the tie to a session and where it
 * appears.
 */
export type ExamKind = 'pretest' | 'kuis';

export const EXAM_KIND_LABELS: Record<ExamKind, string> = {
  pretest: 'Pretest',
  kuis: 'Kuis Sesi',
};

/**
 * Jenis soal yang dinilai otomatis.
 *
 * Keduanya dijawab dengan memilih satu opsi, sehingga penilaiannya adalah
 * perbandingan satu id. Esai sengaja tidak ada: tanpa halaman penilaian manual
 * esai selalu bernilai nol, dan nilai nol yang tampak seperti jawaban salah
 * lebih buruk daripada tidak menyediakannya sama sekali.
 *
 * Question kinds that grade themselves.
 *
 * Both are answered by picking one option, so grading is a single id
 * comparison. Essays are deliberately absent: with no manual marking screen an
 * essay always scores zero, and a zero that reads like a wrong answer is worse
 * than not offering the type at all.
 */
export type QuestionKind = 'pilihan-ganda' | 'benar-salah';

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  'pilihan-ganda': 'Pilihan Ganda',
  'benar-salah': 'Benar / Salah',
};

/** Batas percobaan. Sengaja tetap, bukan setelan / Attempt ceiling. Deliberately fixed, not a setting */
export const MAX_ATTEMPTS = 3;

/** Nilai minimum untuk lulus, dalam persen / Minimum passing score, as a percentage */
export const DEFAULT_PASSING_SCORE = 70;

export interface ExamOption {
  id: string;
  text: string;
}

/**
 * Soal sebagaimana dibaca peserta.
 *
 * Tidak memuat jawaban benar. Kuncinya berada pada dokumen terpisah yang hanya
 * dibaca server: Firestore tidak mengenal izin per-kolom, sehingga satu
 * dokumen yang memuat soal sekaligus kuncinya akan terkirim utuh begitu
 * soalnya dikirim.
 *
 * A question as a participant reads it.
 *
 * It carries no correct answer. The key lives in a separate document that only
 * the server reads: Firestore has no per-field permissions, so one document
 * holding both the question and its key would travel whole the moment the
 * question is sent.
 */
export interface QuestionDocument {
  id: string;
  examId: string;
  kind: QuestionKind;
  text: string;
  options: ExamOption[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Kunci jawaban sebuah soal, disimpan terpisah dari soalnya.
 *
 * Dokumen ini tidak pernah dikirim ke peramban selama ujian berlangsung.
 * Pembahasan ikut di sini, bukan pada soalnya, sebab pembahasan kerap menyebut
 * jawaban benarnya dan ikut bocor bila diletakkan bersama soal.
 *
 * A question's answer key, stored apart from the question.
 *
 * This document never reaches the browser while an exam is running. The
 * explanation lives here rather than on the question because an explanation
 * usually names the correct answer and would leak alongside it.
 */
export interface AnswerKeyDocument {
  id: string; // sama dengan questionId / same as questionId
  examId: string;
  correctOptionId: string;
  explanation: string;
  updatedAt: string;
}

export interface ExamDocument {
  id: string;
  classId: string;
  kind: ExamKind;
  /**
   * Pertemuan induk sebuah kuis. Null bagi pretest, yang berdiri di depan
   * seluruh kelas dan bukan milik satu pertemuan.
   *
   * The meeting a quiz belongs to. Null for a pretest, which stands in front of
   * the whole class rather than belonging to one meeting.
   */
  sessionId: string | null;
  title: string;
  description: string;
  /** Menit. Null berarti tanpa batas waktu / Minutes. Null means untimed */
  durationMinutes: number | null;
  passingScore: number;
  /** Batas pengumpulan sebagai ISO UTC / Submission deadline as ISO UTC */
  dueAt: string | null;
  questionCount: number;
  /**
   * Ujian yang belum terbit tidak terlihat peserta.
   *
   * Ujian tanpa soal yang terbit menolak setiap peserta yang membukanya,
   * sehingga penerbitannya diperiksa terhadap jumlah soal.
   *
   * An unpublished exam is invisible to participants.
   *
   * A published exam with no questions turns away everyone who opens it, so
   * publishing is checked against the question count.
   */
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AttemptStatus = 'berlangsung' | 'selesai';

/**
 * Satu percobaan pengerjaan.
 *
 * startedAt selalu diisi server. Jam perangkat peserta dapat meleset berjam-
 * jam, dan waktu mulai yang dikirim peramban membuat batas waktunya ikut
 * meleset -- termasuk ke arah yang menguntungkan pengirimnya.
 *
 * One attempt at an exam.
 *
 * startedAt is always set by the server. A participant's device clock can be
 * hours off, and a start time sent by the browser drags the deadline with it --
 * including in the sender's favour.
 */
export interface AttemptDocument {
  id: string; // ${examId}_${studentId}_${attemptNumber}
  examId: string;
  examTitle: string;
  classId: string;
  studentId: string;
  studentName: string;
  attemptNumber: number;
  startedAt: string;
  finishedAt: string | null;
  /** Null selama belum dinilai / Null until graded */
  rawScore: number | null;
  /**
   * Nilai yang berlaku setelah aturan remedial diterapkan.
   *
   * Percobaan kedua dan ketiga yang lulus dipatok tepat di nilai KKM: yang
   * diulang adalah kesempatan lulusnya, bukan kesempatan memperbaiki angka.
   *
   * The score that counts once the remedial rule is applied.
   *
   * A second or third attempt that passes is pinned at exactly the passing
   * mark: what a retake restores is the chance to pass, not the chance to raise
   * a number.
   */
  score: number | null;
  passed: boolean | null;
  correctCount: number | null;
  status: AttemptStatus;
  /**
   * Urutan soal pada percobaan ini.
   *
   * Disimpan agar urutannya tetap sama saat halaman dimuat ulang. Mengacak
   * ulang tiap render membuat peserta kehilangan tempatnya setiap kali
   * jaringannya terputus sesaat.
   *
   * The question order for this attempt.
   *
   * Stored so the order survives a reload. Reshuffling on every render would
   * lose a participant's place each time their connection blinks.
   */
  questionOrder: string[];
  autoSubmitted: boolean;
}

/**
 * Jawaban satu soal dalam satu percobaan.
 *
 * Dokumen yang sama dipakai sebagai draf dan sebagai jawaban final: draf
 * ditulis dengan isCorrect null, lalu penilaian menimpanya. isCorrect yang
 * tidak null menandai dokumen itu sudah dinilai, dan menjadi penjaga agar
 * simpanan otomatis yang terlambat tidak mengosongkannya kembali.
 *
 * One question's answer within one attempt.
 *
 * The same document serves as draft and as final answer: a draft is written
 * with isCorrect null, then grading overwrites it. A non-null isCorrect marks
 * the document as graded, and guards it against a late autosave blanking it
 * again.
 */
export interface AnswerDocument {
  id: string; // ${attemptId}_${questionId}
  attemptId: string;
  examId: string;
  studentId: string;
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  answeredAt: string;
}

/** Ujian sebagaimana tampil pada daftar peserta / An exam as it appears in a participant's list */
export interface StudentExamSummary {
  exam: Pick<ExamDocument, 'id' | 'kind' | 'title' | 'description' | 'durationMinutes' | 'passingScore' | 'dueAt' | 'questionCount' | 'sessionId'>;
  attemptsUsed: number;
  attemptsLeft: number;
  bestScore: number | null;
  passed: boolean;
  inProgressAttemptId: string | null;
}
