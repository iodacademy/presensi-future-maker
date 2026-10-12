// Jumlah dan urutan sesi mentoring per peserta / Mentoring session counts and order per participant
import { getAdminDb } from '../../lib/firebase/admin';
import type { Phase } from '../assignments/types';

/**
 * Jumlah sesi mentoring aktif tiap peserta pada satu fase, dari dokumen
 * kuotanya. Kuota dinaikkan saat booking dan diturunkan saat pembatalan,
 * sehingga isinya sama dengan jumlah booking aktif, dengan satu baca per
 * peserta alih-alih seluruh riwayat bookingnya.
 *
 * Each participant's active mentoring session count in one phase, from their
 * quota document. The quota goes up on booking and down on cancellation, so it
 * equals the active booking count, at one read per participant rather than
 * their whole booking history.
 */
export async function mentoringCounts(studentIds: string[], phase: Phase): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const ids = [...new Set(studentIds)].filter(Boolean);
  if (ids.length === 0) return counts;

  const db = getAdminDb();
  const refs = ids.map((id) => db.collection('mentoringQuotas').doc(`${id}_${phase}`));
  const snaps = await db.getAll(...refs, { fieldMask: ['count'] });
  ids.forEach((id, i) => counts.set(id, (snaps[i].data()?.count as number) ?? 0));
  return counts;
}

/**
 * Memberi nomor tiap booking aktif menurut urutan waktunya per peserta.
 * Booking yang dibatalkan tidak dihitung, sehingga sesi kedua menjadi sesi
 * pertama begitu sesi pertamanya dibatalkan.
 *
 * Numbers each active booking by time order per participant. Cancelled
 * bookings do not count, so a second session becomes the first once the first
 * is cancelled.
 */
export function numberSessions(
  bookings: { id: string; studentId: string; status: string; phase: string; startsAt: string }[],
  phase: Phase
): Map<string, number> {
  const perStudent = new Map<string, { id: string; startsAt: string }[]>();
  for (const b of bookings) {
    if (b.status !== 'confirmed' || b.phase !== phase) continue;
    if (!perStudent.has(b.studentId)) perStudent.set(b.studentId, []);
    perStudent.get(b.studentId)!.push(b);
  }
  const numbers = new Map<string, number>();
  for (const list of perStudent.values()) {
    list.sort((a, b) => a.startsAt.localeCompare(b.startsAt)).forEach((b, i) => numbers.set(b.id, i + 1));
  }
  return numbers;
}

/** Nomor sesi tiap booking milik peserta-peserta itu / The session number of each of those participants' bookings */
export async function sessionNumbers(studentIds: string[], phase: Phase): Promise<Map<string, number>> {
  const ids = [...new Set(studentIds)].filter(Boolean);
  if (ids.length === 0) return new Map();

  const db = getAdminDb();
  // Firestore membatasi 'in' sampai 30 nilai per kueri / Firestore caps 'in' at 30 values per query
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const snaps = await Promise.all(
    chunks.map((c) => db.collection('bookings').where('studentId', 'in', c).select('studentId', 'status', 'phase', 'startsAt').get())
  );
  const bookings = snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...(d.data() as { studentId: string; status: string; phase: string; startsAt: string }) })));
  return numberSessions(bookings, phase);
}
