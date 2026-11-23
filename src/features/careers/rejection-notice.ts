/**
 * Pemberitahuan di beranda saat lamaran peserta tidak lolos, beserta saran
 * lowongan lain yang masih terbuka dan masih ada kursinya. Pemberitahuan tampil
 * sekali; setelah ditutup, lamarannya ditandai sudah dilihat.
 *
 * A home notice when a participant's application is rejected, with suggestions
 * of other jobs still open with seats left. The notice shows once; after it is
 * closed, the applications are marked as seen.
 */
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import { PLACEMENT_COLLECTION } from './model';
import { CAREER_APP_FIELDS, listOpenJobs, type StudentJobCard } from './student-service';
import { applyBlock } from './tier';

export interface RejectionNotice {
  rejections: { id: string; jobTitle: string; partnerName: string }[];
  suggestions: StudentJobCard[];
  /** Alasan peserta belum bisa melamar lagi, mis. jatah penuh; null berarti boleh / Why the participant cannot apply again yet; null means they may */
  blocked: string | null;
}

const MAX_SUGGESTIONS = 3;
// Firestore membatasi filter "in" sampai 30 nilai / Firestore caps an "in" filter at 30 values
const CHUNK = 30;
const db = () => getAdminDb();
const EMPTY: RejectionNotice = { rejections: [], suggestions: [], blocked: null };

export async function rejectionNotice(actor: Actor, now: Date): Promise<RejectionNotice> {
  // Lamaran sendiri dibaca lebih dulu; lowongan baru dibaca bila memang ada yang perlu diberitahukan
  // Own applications are read first; jobs are read only when there is something to tell
  const mine = await db().collection('jobApplications').where('studentId', '==', actor.uid).select(...CAREER_APP_FIELDS, 'rejectSeenAt').get();
  const unseen = mine.docs.filter((d) => d.get('status') === 'tidak-lolos' && !d.get('rejectSeenAt'));
  if (unseen.length === 0) return EMPTY;

  const open = await listOpenJobs(actor, now);
  // Peserta yang sudah terkunci di tempat magang tidak perlu diarahkan ke lowongan lain
  // A participant already locked into an internship need not be pointed at other jobs
  if (!open.access || !open.standing || open.standing.locked) return EMPTY;

  const jobs = await Promise.all(unseen.map((d) => db().collection('jobs').doc(String(d.get('jobId'))).get()));
  const rejections = unseen.map((d, i) => ({ id: d.id, jobTitle: String(jobs[i].get('title') ?? ''), partnerName: String(jobs[i].get('partnerName') ?? '') }));
  const blocked = applyBlock(open.standing);
  if (blocked) return { rejections, suggestions: [], blocked };

  const applied = new Set(mine.docs.map((d) => String(d.get('jobId'))));
  const candidates = open.jobs.filter((j) => !applied.has(j.id));
  const taken = await seatsTaken(candidates.map((j) => j.id));
  // Bidang lowongan yang ditolak didahulukan, lalu yang paling cepat tutup / The rejected job's field first, then the soonest to close
  const fields = new Set(jobs.map((j) => j.get('category')));
  const suggestions = candidates
    .filter((j) => (taken.get(j.id) ?? 0) < j.quota)
    .sort((a, b) => Number(fields.has(b.category)) - Number(fields.has(a.category)) || a.closesAt.localeCompare(b.closesAt))
    .slice(0, MAX_SUGGESTIONS);
  return { rejections, suggestions, blocked: null };
}

// Kursi terisi = peserta yang menerima tawaran + penempatan di luar portal / Seats taken = accepted participants + outside placements
async function seatsTaken(jobIds: string[]): Promise<Map<string, number>> {
  const taken = new Map<string, number>();
  const chunks = Array.from({ length: Math.ceil(jobIds.length / CHUNK) }, (_, i) => jobIds.slice(i * CHUNK, (i + 1) * CHUNK));
  // Status disaring di sini agar query cukup memakai indeks satu kolom / Status is filtered here so the query needs only a single-field index
  const snaps = await Promise.all(chunks.flatMap((ids) => [
    db().collection('jobApplications').where('jobId', 'in', ids).select('jobId', 'status').get(),
    db().collection(PLACEMENT_COLLECTION).where('jobId', 'in', ids).select('jobId').get(),
  ]));
  snaps.flatMap((s) => s.docs).filter((d) => d.get('status') === undefined || d.get('status') === 'bergabung')
    .forEach((d) => taken.set(String(d.get('jobId')), (taken.get(String(d.get('jobId'))) ?? 0) + 1));
  return taken;
}

/** Hanya lamaran tidak lolos milik peserta sendiri yang ditandai / Only the participant's own rejected applications are marked */
export async function markRejectionsSeen(actor: Actor, rawIds: unknown, now: Date): Promise<void> {
  const ids = [...new Set((Array.isArray(rawIds) ? rawIds : []).map(String))].slice(0, 50);
  const snaps = await Promise.all(ids.map((id) => db().collection('jobApplications').doc(id).get()));
  const own = snaps.filter((s) => s.exists && s.get('studentId') === actor.uid && s.get('status') === 'tidak-lolos');
  await Promise.all(own.map((s) => s.ref.update({ rejectSeenAt: now.toISOString() })));
}
