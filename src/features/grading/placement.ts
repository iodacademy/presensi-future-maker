/**
 * Penentuan skema magang sesudah bootcamp.
 *
 * Nilai menentukan tingkatnya: SPA (nilai akhir) dan nilai gabungan TPM dan
 * capstone (capstone 60%, TPM 40%). Absen, termasuk izin dan sakit, hanya
 * menurunkan satu tingkat: nilai Full dengan absen lebih dari sekali menjadi
 * Project Based, berapa pun absennya, dan nilai Project dengan absen lebih dari
 * tiga kali tidak ditempatkan. Kehadiran sudah ikut mengurangi SPA, jadi absen
 * tidak boleh sekaligus menggugurkan peserta bernilai Full. Seleksi CV,
 * wawancara mitra, dan kuota tidak tercatat di sistem.
 *
 * Internship scheme placement after the bootcamp.
 *
 * Scores set the tier: SPA (the final score) and the combined TPM and capstone
 * score (capstone 60%, TPM 40%). Absences, leave and sick days included, only
 * drop it one tier: a Full score with more than one absence becomes Project
 * Based however many absences there are, and a Project score with more than
 * three absences is not placed. Attendance already lowers the SPA, so absences
 * must not also knock out a participant with Full-level scores. CV screening,
 * partner interviews and quotas are not recorded in the system.
 */

export const PLACEMENT_RULES = {
  full: { spa: 70, combined: 60, maxAbsent: 1 },
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
export function decidePlacement(p: { spa: number; capstone: number; tasks: number; absent: number; capstoneGraded?: boolean; capstoneMissing?: boolean }): { placement: Placement; reasons: string[] } {
  if (p.capstoneGraded === false) return { placement: 'pending', reasons: ['Capstone belum dinilai'] };
  if (p.capstoneMissing) {
    // Penyebab sebenarnya disebut lebih dulu dari ambang yang gagal / The real cause is named before the failed thresholds
    const hasil = decidePlacement({ ...p, capstoneMissing: false });
    return { ...hasil, reasons: ['Tidak mengumpulkan capstone', ...hasil.reasons] };
  }
  const { full, project } = PLACEMENT_RULES;
  const nilai = combinedScore(p.capstone, p.tasks);
  // Ambang nilai yang belum tercapai untuk satu tingkat / Score thresholds not reached for one tier
  const kurang = (r: { spa: number; combined: number }) => [
    ...(p.spa < r.spa ? [`SPA di bawah ${r.spa}`] : []),
    ...(nilai < r.combined ? [`Nilai TPM + capstone di bawah ${r.combined}`] : []),
  ];
  if (kurang(full).length === 0) {
    return p.absent > full.maxAbsent ? { placement: 'project', reasons: [`${p.absent}× absen`] } : { placement: 'full', reasons: [] };
  }
  if (kurang(project).length > 0) return { placement: 'none', reasons: kurang(project) };
  if (p.absent > project.maxAbsent) return { placement: 'none', reasons: [`${p.absent}× absen, batas ${project.maxAbsent} untuk Project Based`] };
  return { placement: 'project', reasons: kurang(full) };
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
