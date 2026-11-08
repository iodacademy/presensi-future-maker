/**
 * Penentuan skema magang sesudah bootcamp.
 *
 * Tiga syarat dinilai bersama: SPA (nilai akhir), nilai gabungan TPM dan
 * capstone (capstone 60%, TPM 40%), dan jumlah absen termasuk izin dan sakit.
 * Full Internship menuntut SPA dan nilai gabungan minimal 70 dengan absen
 * paling banyak sekali; Project Based menuntut keduanya minimal 50 dengan absen
 * paling banyak tiga kali. Peserta yang lolos ambang nilai Full tetapi gagal di
 * syarat lain turun ke Project Based, bukan ke Tidak Ditempatkan. Seleksi CV,
 * wawancara mitra, dan kuota tidak tercatat di sistem.
 *
 * Internship scheme placement after the bootcamp.
 *
 * Three requirements are judged together: SPA (the final score), the combined
 * TPM and capstone score (capstone 60%, TPM 40%), and absences including leave
 * and sick days. Full Internship needs SPA and the combined score of at least 70
 * with at most one absence; Project Based needs both at least 50 with at most
 * three absences. Someone who clears the Full score thresholds but fails another
 * requirement drops to Project Based, not to Not Placed. CV screening, partner
 * interviews and quotas are not recorded in the system.
 */

export const PLACEMENT_RULES = {
  full: { spa: 70, combined: 70, maxAbsent: 1 },
  project: { spa: 50, combined: 50, maxAbsent: 3 },
  weights: { capstone: 60, tasks: 40 },
} as const;

export type Placement = 'full' | 'project' | 'none' | 'pending';

export const PLACEMENT_LABELS: Record<Placement, string> = {
  full: 'Full Internship',
  project: 'Project Based',
  none: 'Tidak Ditempatkan',
  pending: 'Menunggu nilai capstone',
};

/** Nilai gabungan capstone 60% dan TPM 40%, dibulatkan / The combined capstone 60% and TPM 40% score, rounded */
export function combinedScore(capstone: number, tasks: number): number {
  const w = PLACEMENT_RULES.weights;
  return Math.round((capstone * w.capstone + tasks * w.tasks) / 100);
}

/**
 * Tanpa nilai capstone, SPA dan nilai gabungan masih jauh di bawah angka
 * akhirnya, jadi skemanya belum ditentukan, bukan "tidak ditempatkan".
 *
 * Without a capstone score the SPA and combined score are still far below their
 * final values, so the scheme is undecided, not "not placed".
 */
export function decidePlacement(p: { spa: number; capstone: number; tasks: number; absent: number; capstoneGraded?: boolean }): { placement: Placement; reasons: string[] } {
  if (p.capstoneGraded === false) return { placement: 'pending', reasons: ['Capstone belum dinilai'] };
  const nilai = combinedScore(p.capstone, p.tasks);
  // Syarat yang belum terpenuhi untuk satu skema / Requirements not met for one scheme
  const kurang = (r: { spa: number; combined: number; maxAbsent: number }, absen: string) => [
    ...(p.spa < r.spa ? [`SPA di bawah ${r.spa}`] : []),
    ...(nilai < r.combined ? [`Nilai TPM + capstone di bawah ${r.combined}`] : []),
    ...(p.absent > r.maxAbsent ? [absen] : []),
  ];
  const full = kurang(PLACEMENT_RULES.full, `${p.absent}× absen`);
  if (full.length === 0) return { placement: 'full', reasons: [] };
  const project = kurang(PLACEMENT_RULES.project, `${p.absent}× absen, batas ${PLACEMENT_RULES.project.maxAbsent}`);
  return project.length === 0 ? { placement: 'project', reasons: full } : { placement: 'none', reasons: project };
}

/**
 * Urutan peringkat dalam satu lokasi: SPA, lalu capstone, lalu skor kehadiran.
 *
 * Ranking order within one location: SPA, then capstone, then attendance score.
 */
export function comparePlacementRank(
  a: { spa: number; capstone: number; attendance: number },
  b: { spa: number; capstone: number; attendance: number }
): number {
  return b.spa - a.spa || b.capstone - a.capstone || b.attendance - a.attendance;
}
