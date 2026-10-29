/**
 * Penentuan skema magang sesudah bootcamp.
 *
 * SPA adalah nilai akhir. SPA minimal 65 berarti lulus bootcamp dan selalu
 * mendapat penempatan; Full Internship hanya bagi yang juga memenuhi syarat
 * nilai capstone dan kehadiran. Seleksi CV, wawancara mitra, dan kuota tidak
 * tercatat di sistem, jadi Full Internship di sini berarti kandidat: yang tidak
 * lolos seleksi mitra atau tidak mendapat kuota turun ke Project Based di luar
 * sistem.
 *
 * Internship scheme placement after the bootcamp.
 *
 * SPA is the final score. An SPA of at least 65 means the bootcamp is passed
 * and always earns a placement; Full Internship is only for those who also meet
 * the capstone and attendance requirements. CV screening, partner interviews
 * and quotas are not recorded in the system, so Full Internship here means a
 * candidate: one who fails partner selection or gets no quota drops to Project
 * Based outside the system.
 */

export const PLACEMENT_RULES = { minSpa: 65, fullSpa: 80, fullCapstone: 75 } as const;

export type Placement = 'full' | 'project' | 'none' | 'pending';

export const PLACEMENT_LABELS: Record<Placement, string> = {
  full: 'Kandidat Full Internship',
  project: 'Project Based',
  none: 'Tidak Ditempatkan',
  pending: 'Menunggu nilai capstone',
};

/**
 * Tanpa nilai capstone, SPA masih jauh di bawah angka akhirnya (capstone
 * berbobot 45%), jadi skemanya belum ditentukan, bukan "tidak ditempatkan".
 *
 * Without a capstone score the SPA is still far below its final value (the
 * capstone weighs 45%), so the scheme is undecided, not "not placed".
 */
export function decidePlacement(p: { spa: number; capstone: number; unexcused: number; capstoneGraded?: boolean }): { placement: Placement; reasons: string[] } {
  const { minSpa, fullSpa, fullCapstone } = PLACEMENT_RULES;
  if (p.capstoneGraded === false) return { placement: 'pending', reasons: ['Capstone belum dinilai'] };
  if (p.spa < minSpa) return { placement: 'none', reasons: [`SPA di bawah ${minSpa}`] };
  const kurang: string[] = [];
  if (p.spa < fullSpa) kurang.push(`SPA ${minSpa}–${fullSpa - 1}`);
  if (p.capstone < fullCapstone) kurang.push(`Capstone di bawah ${fullCapstone}`);
  if (p.unexcused > 0) kurang.push(`${p.unexcused}× absen tanpa izin`);
  return kurang.length > 0 ? { placement: 'project', reasons: kurang } : { placement: 'full', reasons: [] };
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
