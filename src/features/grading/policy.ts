// Aturan perhitungan nilai akhir / Final score calculation rules
import {
  CAPSTONE_ASPECTS,
  GRADE_WEIGHTS,
  RUBRIC_MAX,
  RUBRIC_MIN,
  SHOWCASE_ASPECTS,
  type ComponentBreakdown,
  type GradeComponent,
  type RubricKind,
  type RubricScoreDocument,
} from './types';

export function aspectsFor(kind: RubricKind): readonly { id: string; label: string }[] {
  return kind === 'capstone' ? CAPSTONE_ASPECTS : SHOWCASE_ASPECTS;
}

/**
 * Memvalidasi satu penilaian rubrik.
 *
 * Seluruh aspek wajib dinilai: aspek yang dilewatkan tidak dapat dibedakan
 * dari aspek bernilai terendah bila dibiarkan kosong, dan rata-ratanya dihitung
 * dari jumlah aspek yang berbeda antar-penilai.
 *
 * Validates one rubric assessment.
 *
 * Every aspect must be scored: an aspect left out cannot be told from one
 * scored lowest if left blank, and its average would be computed over a
 * different aspect count for each assessor.
 */
export function validateRubricScores(kind: RubricKind, scores: Record<string, number>): Record<string, number> {
  const bersih: Record<string, number> = {};

  for (const aspek of aspectsFor(kind)) {
    const nilai = scores[aspek.id];

    if (nilai === undefined || nilai === null) {
      throw new Error(`Aspek "${aspek.label}" belum dinilai`);
    }

    if (!Number.isInteger(nilai) || nilai < RUBRIC_MIN || nilai > RUBRIC_MAX) {
      throw new Error(`Nilai "${aspek.label}" harus bilangan bulat ${RUBRIC_MIN} sampai ${RUBRIC_MAX}`);
    }

    bersih[aspek.id] = nilai;
  }

  return bersih;
}

/**
 * Mengubah nilai rubrik satu penilai menjadi skala 0-100.
 *
 * Skala 1-4 dipetakan sehingga 1 menjadi 0 dan 4 menjadi 100. Memperlakukan
 * angka 1-4 sebagai persentase langsung akan membuat penilaian terbaik bernilai
 * empat dari seratus, dan membaginya dengan empat membuat penilaian terburuk
 * bernilai dua puluh lima -- padahal 1 berarti tidak memenuhi sama sekali.
 *
 * Converts one assessor's rubric scores to a 0-100 scale.
 *
 * A 1-4 scale maps so that 1 becomes 0 and 4 becomes 100. Treating 1-4 as a
 * percentage directly would make the best assessment worth four out of a
 * hundred, and dividing by four would make the worst worth twenty-five --
 * although 1 means not met at all.
 */
export function rubricToPercent(kind: RubricKind, scores: Record<string, number>): number {
  const aspek = aspectsFor(kind);
  if (aspek.length === 0) return 0;

  const total = aspek.reduce((t, a) => t + (scores[a.id] ?? RUBRIC_MIN), 0);
  const rata = total / aspek.length;

  return Math.round(((rata - RUBRIC_MIN) / (RUBRIC_MAX - RUBRIC_MIN)) * 100);
}

/**
 * Merata-ratakan penilaian beberapa penilai menjadi satu angka 0-100.
 *
 * Dirata-rata dari penilai yang sudah menilai, bukan dari jumlah penilai yang
 * seharusnya: menahan nilai sampai ketiganya masuk berarti satu mentor yang
 * belum menilai menahan nilai seluruh kelasnya.
 *
 * Averages several assessors into one 0-100 figure.
 *
 * Averaged over the assessors who have scored rather than over how many should
 * have: withholding until all three are in would have one mentor who has not
 * assessed hold back their whole class's scores.
 */
export function averageRubric(kind: RubricKind, entries: RubricScoreDocument[]): number | null {
  if (entries.length === 0) return null;

  const total = entries.reduce((t, e) => t + rubricToPercent(kind, e.scores), 0);
  return Math.round(total / entries.length);
}

/**
 * Menghitung nilai sebuah komponen berbasis daftar nilai.
 *
 * Yang tidak dikumpulkan atau tidak dikerjakan dihitung nol, bukan
 * dikecualikan: peserta yang melewatkan separuh tugas tidak boleh bernilai
 * sama dengan yang mengerjakan seluruhnya.
 *
 * Computes a list-based component's score.
 *
 * What was never submitted or taken counts as zero rather than being excluded:
 * a participant who skipped half their tasks must not score the same as one who
 * did all of them.
 */
export function averageWithZeros(scores: (number | null)[], expectedCount: number): number {
  // Pembaginya jumlah yang seharusnya ada, bukan jumlah yang ada. Memakai
  // panjang daftarnya membuat peserta yang tugasnya belum dibuka bernilai
  // penuh.
  //
  // The divisor is how many there should be, not how many there are. Using the
  // list's length would give a participant whose tasks are not yet open a full
  // score.
  const pembagi = Math.max(expectedCount, scores.length);
  if (pembagi === 0) return 0;

  const total = scores.reduce<number>((t, s) => t + (s ?? 0), 0);
  return Math.round(total / pembagi);
}

/**
 * Menyusun nilai akhir dari seluruh komponennya.
 *
 * Komponen yang belum punya nilai dihitung nol tetapi dicatat sebagai
 * tertunda. Mengecualikannya dari pembagi akan membuat nilai sementara terbaca
 * tinggi lalu turun begitu capstone-nya dinilai -- peserta melihat nilainya
 * seolah berkurang karena dinilai.
 *
 * Assembles the final score from its components.
 *
 * A component with no score counts as zero but is recorded as pending.
 * Excluding it from the divisor would make a provisional score read high and
 * then fall once the capstone is assessed -- a participant would see their
 * score drop because they were assessed.
 */
export function calculateFinalGrade(input: {
  capstone: number | null;
  showcase: number | null;
  tasks: number | null;
  attendance: number | null;
  quiz: number | null;
  details?: Partial<Record<GradeComponent, string>>;
}): { score: number; breakdown: ComponentBreakdown[]; pending: GradeComponent[] } {
  const nilai: Record<GradeComponent, number | null> = {
    capstone: input.capstone,
    tasks: input.tasks,
    showcase: input.showcase,
    attendance: input.attendance,
    quiz: input.quiz,
  };

  const pending: GradeComponent[] = [];
  const breakdown: ComponentBreakdown[] = [];
  let total = 0;

  for (const komponen of Object.keys(GRADE_WEIGHTS) as GradeComponent[]) {
    const weight = GRADE_WEIGHTS[komponen];
    const n = nilai[komponen];

    if (n === null) pending.push(komponen);

    const score = Math.max(0, Math.min(100, n ?? 0));
    const weighted = (score * weight) / 100;
    total += weighted;

    breakdown.push({
      component: komponen,
      score,
      weight,
      weighted: Math.round(weighted * 10) / 10,
      detail: input.details?.[komponen] ?? '',
    });
  }

  return { score: Math.round(total), breakdown, pending };
}
