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
  if (user.joinedAt && /^\d{4}-\d{2}-\d{2}$/.test(user.joinedAt)) {
    return new Date(`${user.joinedAt}T00:00:00+07:00`).toISOString();
  }
  return user.createdAt ?? '';
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
