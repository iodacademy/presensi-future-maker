// Pemilih pertemuan yang dibuka pertama kali di jadwal peserta / Picks the meeting the participant schedule opens first

/**
 * Mengembalikan id pertemuan yang paling relevan saat ini: yang jamnya sedang
 * berjalan, atau yang berikutnya paling dekat, atau -- bila semua sudah lewat
 * -- yang terakhir.
 *
 * Sengaja memakai jam pertemuan, bukan status presensi. Jendela presensi dapat
 * dibuka admin lebih lama dari pertemuannya, sehingga pertemuan yang sudah
 * selesai terus terpilih walau pertemuan berikutnya sudah di depan mata.
 *
 * Returns the id of the most relevant meeting now: the one whose hours are
 * running, else the nearest upcoming one, else -- when all have passed -- the
 * last one.
 *
 * Deliberately uses the meeting's hours, not its attendance status. An admin
 * can keep the attendance window open longer than the meeting, so a finished
 * meeting kept being picked even with the next one right ahead.
 */
export function pickFocusSessionId(
  sessions: { id: string; startsAt: string; endsAt: string }[],
  nowIso: string
): string | null {
  if (sessions.length === 0) return null;
  const sorted = [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const running = sorted.find((s) => s.startsAt <= nowIso && nowIso < s.endsAt);
  if (running) return running.id;
  const upcoming = sorted.find((s) => s.startsAt > nowIso);
  return (upcoming ?? sorted[sorted.length - 1]).id;
}
