// Aturan format tanggal, urgensi deadline dan rasio progres dashboard
// Policy for date formatting, deadline urgency, and progress ratios
import { formatDateTimeWib } from '../../lib/time';

export const URGENT_DEADLINE_MS = 24 * 60 * 60 * 1000; // 24 jam / 24 hours

/**
 * Mendeteksi apakah deadline berjarak kurang dari 24 jam ke depan.
 *
 * Detects if a deadline is within 24 hours in the future.
 */
export function isDeadlineUrgent(dueAtStr: string | null, nowMs: number = Date.now()): boolean {
  if (!dueAtStr) return false;

  const dueMs = new Date(dueAtStr).getTime();
  if (isNaN(dueMs)) return false;

  const diffMs = dueMs - nowMs;
  return diffMs > 0 && diffMs <= URGENT_DEADLINE_MS;
}

/**
 * Memformat label badge deadline tugas di kartu beranda.
 *
 * Formats deadline badge label for home card.
 */
export function formatDeadlineLabel(isUrgent: boolean, dueAtStr: string | null): string {
  // dueAt kini ISO UTC. Sebelumnya berupa teks bebas seperti "30 September",
  // sehingga mencetaknya apa adanya masih terbaca; kini label itu memberi
  // "DEADLINE: 2026-09-28T16:59:00.000Z" kepada peserta.
  //
  // dueAt is now ISO UTC. It used to be free text such as "30 September", so
  // printing it as is still read well; that label now hands participants
  // "DEADLINE: 2026-09-28T16:59:00.000Z".
  const waktu = dueAtStr ? formatDateTimeWib(dueAtStr) : null;

  if (isUrgent) {
    return waktu ? `DEADLINE SEGERA - ${waktu} WIB` : 'DEADLINE SEGERA';
  }

  if (waktu) {
    return `DEADLINE ${waktu} WIB`;
  }

  return 'TANPA BATAS WAKTU';
}

/**
 * Memformat rasio progres (contoh: "18/20", "3/4").
 * Aman dari pembagi nol (zero division).
 *
 * Formats progress ratio safely against zero divisor.
 */
export function formatProgressRatio(numerator: number, denominator: number): string {
  const num = Math.max(0, numerator || 0);
  const den = Math.max(0, denominator || 0);
  return `${num}/${den}`;
}
