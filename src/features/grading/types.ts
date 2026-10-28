// Definisi tipe penilaian akhir / Final grading type definitions

/**
 * Bobot tiap komponen nilai akhir, dalam persen.
 *
 * Jumlahnya wajib seratus; ada uji yang menjaganya. Bobot yang jumlahnya
 * kurang membuat nilai tertinggi yang mungkin dicapai berada di bawah seratus,
 * dan bobot yang lebih membuat nilai melampauinya -- keduanya baru ketahuan
 * setelah peserta membandingkan nilainya dengan hitungan sendiri.
 *
 * Each component's weight in the final score, as a percentage.
 *
 * They must sum to one hundred; a test keeps them there. Weights that fall
 * short put the highest achievable score below a hundred, and weights that
 * overshoot push it past -- either surfaces only once a participant compares
 * their score against their own arithmetic.
 */
// Showcase dihapus: tidak semua peserta mempresentasikannya, jadi bobotnya
// dipindah ke capstone (+10) dan tugas (+5).
// Showcase was dropped: not every participant presents one, so its weight moved
// to the capstone (+10) and tasks (+5).
export const GRADE_WEIGHTS = {
  capstone: 45,
  tasks: 30,
  attendance: 15,
  quiz: 10,
} as const;

export type GradeComponent = keyof typeof GRADE_WEIGHTS;

export const COMPONENT_LABELS: Record<GradeComponent, string> = {
  capstone: 'Capstone',
  tasks: 'Nilai Tugas',
  attendance: 'Kehadiran',
  quiz: 'Nilai Kuis',
};

/**
 * Nilai capstone seorang peserta.
 *
 * Diimpor sudah berupa angka 0-100, bukan dihitung dari rubrik di dalam
 * aplikasi: penilaiannya terjadi sekali, di ruangan, oleh mentor dan juri yang
 * memegang lembar penilaian sendiri. Memindahkan rapat penilaian ke dalam
 * aplikasi menuntut tiga mentor membuka layar yang sama saat itu juga.
 *
 * Rinciannya tidak tersimpan. Itu konsekuensi yang dipilih: peserta yang
 * bertanya "kenapa nilai saya 85" dijawab dari lembar penilaian di luar
 * aplikasi, bukan dari layar ini.
 *
 * One participant's capstone score.
 *
 * Imported as a finished 0-100 figure rather than computed from a rubric in the
 * app: the assessment happens once, in a room, by mentors and judges holding
 * their own score sheets. Moving that meeting into the app would require three
 * mentors to open the same screen at that moment.
 *
 * The per-aspect detail is not stored. That is a chosen consequence: a
 * participant asking "why is my score 85" is answered from the score sheet
 * outside the app, not from this screen.
 */
export type AssessmentKind = 'capstone';

export interface AssessmentScoreDocument {
  id: string; // ${kind}_${studentId}
  kind: AssessmentKind;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  /** Nilai 0-100 / The score, 0-100 */
  score: number;
  note: string;
  /** Admin yang mengimpornya, untuk ditelusuri bila angkanya dipertanyakan / The admin who imported it, traceable if the figure is questioned */
  importedBy: string;
  importedAt: string;
}

/** Rincian satu komponen pada nilai akhir / One component's detail in the final score */
export interface ComponentBreakdown {
  component: GradeComponent;
  /** Nilai komponen dalam skala 0-100 / The component's score on a 0-100 scale */
  score: number;
  weight: number;
  /** Sumbangannya ke nilai akhir / Its contribution to the final score */
  weighted: number;
  /** Keterangan singkat asal angkanya / A short note on where the number comes from */
  detail: string;
}

export interface FinalGrade {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  /** Nilai akhir 0-100, dibulatkan / The final score, 0-100, rounded */
  score: number;
  breakdown: ComponentBreakdown[];
  /**
   * Komponen yang belum punya nilai sama sekali.
   *
   * Dicatat terpisah dari nilai nol: peserta yang capstone-nya belum dinilai
   * berbeda dari peserta yang capstone-nya dinilai nol, dan menampilkan
   * keduanya sebagai angka yang sama membuat nilai sementara terbaca sebagai
   * nilai final.
   *
   * Components with no score at all.
   *
   * Recorded apart from a zero: a participant whose capstone is not yet
   * assessed differs from one assessed at zero, and showing both as the same
   * number makes a provisional score read as a final one.
   */
  pending: GradeComponent[];
}
