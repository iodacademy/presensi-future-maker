/**
 * Nilai kasus khusus: keputusan admin yang menetapkan nilai tugas atau capstone
 * seorang peserta. Disimpan terpisah dari penilaian mentor, sehingga nilai
 * aslinya tetap ada dan setiap tampilan bisa menandai bahwa nilainya ditetapkan.
 *
 * Special-case grades: an admin decision that sets a participant's task or
 * capstone scores. Stored apart from the mentor's grading, so the original
 * score survives and every view can flag that the score was set.
 */
import type { Placement } from './placement';

export interface SpecialCaseGrade {
  studentId: string;
  /** taskId -> nilai yang ditetapkan / taskId -> the score that was set */
  scores: Record<string, number>;
  /** Nilai LMS sebelum ditetapkan / The LMS score before it was set */
  original: Record<string, number | null>;
  reason: string;
  /** Skema magang yang ditetapkan, mis. sudah diterima mitra lewat seleksi awal / The internship scheme that was set, e.g. already accepted by a partner through early selection */
  placement?: 'full' | 'project';
  setBy: string;
  setAt: string;
}

export const SPECIAL_CASE_COLLECTION = 'specialCaseGrades';

export function withSpecialCases(
  scores: Map<string, Map<string, number | null>>,
  cases: Pick<SpecialCaseGrade, 'studentId' | 'scores'>[],
): Map<string, Map<string, number | null>> {
  const out = new Map([...scores].map(([uid, m]) => [uid, new Map(m)]));
  for (const c of cases) {
    const m = out.get(c.studentId) ?? new Map<string, number | null>();
    for (const [taskId, score] of Object.entries(c.scores)) m.set(taskId, score);
    out.set(c.studentId, m);
  }
  return out;
}

export const SPECIAL_PLACEMENT_REASON = 'Penempatan khusus dari mitra';

export function withPlacementOverride<T extends { placement: Placement; reasons: string[] }>(
  decided: T, placement: 'full' | 'project' | undefined,
): T | { placement: Placement; reasons: string[] } {
  return placement ? { placement, reasons: [SPECIAL_PLACEMENT_REASON] } : decided;
}
