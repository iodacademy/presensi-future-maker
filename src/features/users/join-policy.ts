/**
 * Aturan peserta yang bergabung di tengah program.
 *
 * Pertemuan, tugas, dan kuis yang sudah berakhir sebelum peserta bergabung
 * tidak dihitung: ia tidak mungkin hadir atau mengumpulkannya, dan
 * menghitungnya sebagai absen menjatuhkan angkanya ke nilai yang tidak
 * mencerminkan apa pun. Yang tetap ia kerjakan sebagai susulan tetap dihitung.
 *
 * Rules for participants who join mid-programme.
 *
 * Meetings, tasks and quizzes that ended before the participant joined do not
 * count: they could not have attended or submitted them, and counting them as
 * missed drops their figures to a value that reflects nothing. Anything they
 * still do as catch-up work counts.
 *
 * Tugas dan kuis berbeda dari pertemuan: keduanya tetap wajib, hanya tanpa
 * tenggat (lihat effectiveDueAt). Pertemuan tidak dapat disusul.
 *
 * Tasks and quizzes differ from meetings: they stay required, only without a
 * deadline (see effectiveDueAt). A meeting cannot be caught up on.
 */

/**
 * Saat peserta mulai dihitung, sebagai ISO. Tanggal bergabung yang diisi admin
 * dihitung dari awal harinya (WIB); tanpanya dipakai waktu akun dibuat. String
 * kosong berarti semuanya dihitung.
 *
 * When the participant starts counting, as ISO. An admin-set join date counts
 * from the start of that day (WIB); without one the account creation time is
 * used. An empty string means everything counts.
 */
export function joinMoment(user: { joinedAt?: string | null; createdAt?: string | null }): string {
  if (user.joinedAt && isValidJoinDate(user.joinedAt)) {
    return new Date(`${user.joinedAt}T00:00:00+07:00`).toISOString();
  }
  return user.createdAt ?? '';
}

/**
 * Tanggal "YYYY-MM-DD" yang benar-benar ada. Pola saja meloloskan 2026-13-45,
 * dan toISOString() atas tanggal tak sah melempar galat yang menggagalkan
 * seluruh penghitungan dashboard.
 *
 * A "YYYY-MM-DD" date that actually exists. The pattern alone lets 2026-13-45
 * through, and toISOString() on an invalid date throws, failing the whole
 * dashboard computation.
 */
export function isValidJoinDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Tenggat yang berlaku bagi peserta: tenggat yang sudah lewat sebelum ia
 * bergabung hilang, sehingga tugas dan kuisnya tetap wajib tetapi boleh
 * dikumpulkan kapan saja dan dianggap tepat waktu.
 *
 * The deadline that applies to the participant: one that passed before they
 * joined disappears, so the task or quiz stays required but may be handed in
 * any time and counts as on time.
 */
export function effectiveDueAt(dueAt: string | null | undefined, joinIso: string | undefined): string | null {
  if (!dueAt) return null;
  return joinIso && dueAt <= joinIso ? null : dueAt;
}

/**
 * Apakah sesuatu yang berakhir pada endIso dihitung bagi peserta yang bergabung
 * pada joinIso. Yang sudah dikerjakan selalu dihitung; yang tanpa batas waktu
 * juga, sebab masih dapat dikerjakan.
 *
 * Whether something ending at endIso counts for a participant who joined at
 * joinIso. Anything already done always counts; so does anything without an
 * end, since it can still be done.
 */
export function countsAfterJoin(endIso: string | null | undefined, joinIso: string, done: boolean): boolean {
  if (done || !endIso || !joinIso) return true;
  return endIso > joinIso;
}
