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
export const GRADE_WEIGHTS = {
  capstone: 35,
  tasks: 25,
  showcase: 15,
  attendance: 15,
  quiz: 10,
} as const;

export type GradeComponent = keyof typeof GRADE_WEIGHTS;

export const COMPONENT_LABELS: Record<GradeComponent, string> = {
  capstone: 'Capstone',
  tasks: 'Nilai Tugas',
  showcase: 'Showcase',
  attendance: 'Kehadiran',
  quiz: 'Nilai Kuis',
};

/**
 * Rentang skala rubrik.
 *
 * Satu sampai empat, bukan nol sampai empat: skala rubrik menilai tingkatan
 * mutu, dan nol berarti aspeknya tidak ada sama sekali -- keadaan yang tidak
 * dapat dibedakan dari aspek yang belum dinilai.
 *
 * The rubric scale's range.
 *
 * One to four, not zero to four: a rubric scale rates degrees of quality, and
 * zero would mean the aspect is absent entirely -- a state indistinguishable
 * from one not yet assessed.
 */
export const RUBRIC_MIN = 1;
export const RUBRIC_MAX = 4;

/** Jumlah mentor yang menilai satu capstone / How many mentors assess one capstone */
export const CAPSTONE_ASSESSOR_COUNT = 3;

/**
 * Aspek penilaian capstone.
 *
 * Disimpan sebagai daftar tetap, bukan disusun admin: nilai yang sudah masuk
 * menunjuk aspeknya menurut id, dan aspek yang dapat ditambah atau dihapus di
 * tengah jalan membuat rata-rata dua peserta dihitung dari jumlah aspek yang
 * berbeda.
 *
 * The capstone's assessment aspects.
 *
 * Kept as a fixed list rather than composed by an admin: scores already in
 * point at their aspect by id, and aspects that could be added or removed
 * partway through would have two participants' averages computed over
 * different counts.
 */
export const CAPSTONE_ASPECTS = [
  { id: 'masalah', label: 'Kejelasan masalah' },
  { id: 'teknis', label: 'Kualitas teknis' },
  { id: 'luaran', label: 'Kualitas luaran' },
  { id: 'ai', label: 'Pemanfaatan AI' },
  { id: 'dokumentasi', label: 'Kelengkapan dokumentasi' },
] as const;

/** Aspek penilaian showcase / The showcase's assessment aspects */
export const SHOWCASE_ASPECTS = [
  { id: 'penyampaian', label: 'Kejelasan penyampaian' },
  { id: 'demonstrasi', label: 'Demonstrasi karya' },
  { id: 'penguasaan', label: 'Penguasaan materi' },
  { id: 'waktu', label: 'Ketepatan waktu' },
] as const;

export type RubricKind = 'capstone' | 'showcase';

/**
 * Penilaian satu peserta oleh satu penilai.
 *
 * Tiap penilai menyimpan dokumennya sendiri, bukan menulis ke satu dokumen
 * bersama: tiga mentor yang menilai berbarengan akan saling menimpa bila
 * berbagi satu dokumen, dan yang terakhir menyimpan menghapus dua lainnya.
 *
 * One participant's assessment by one assessor.
 *
 * Each assessor keeps their own document rather than writing into a shared
 * one: three mentors assessing at the same time would overwrite each other in
 * a shared document, and whoever saved last would erase the other two.
 */
export interface RubricScoreDocument {
  id: string; // ${kind}_${studentId}_${assessorId}
  kind: RubricKind;
  studentId: string;
  studentName: string;
  classId: string;
  assessorId: string;
  assessorName: string;
  /** Nilai tiap aspek, 1-4, dikunci menurut id aspeknya / Each aspect's score, 1-4, keyed by aspect id */
  scores: Record<string, number>;
  note: string;
  updatedAt: string;
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
