import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import { getSnapshot } from '../dashboard/snapshot-service';

export interface ExportRow {
  name: string; email: string;
  /** Nilai capstone dari dashboard; null bila belum dinilai / The capstone score from the dashboard; null when not graded yet */
  capstone: number | null;
  cvId: string; role: string; company: string;
  interview: { date: string; start: string; durationMin: number } | null;
}

const MAX_JOBS = 100;
// Firestore membatasi filter "in" sampai 30 nilai / Firestore caps an "in" filter at 30 values
const CHUNK = 30;

/**
 * Pelamar dari beberapa lowongan dalam satu tabel, untuk diekspor admin.
 * Lamaran dibaca tanpa jawaban dan lampiran panjang.
 *
 * Applicants of several jobs in one table, for an admin export. Applications
 * are read without their long answers and attachments.
 */
export async function exportApplicants(actor: Actor, rawJobIds: unknown): Promise<ExportRow[]> {
  const jobIds = [...new Set((Array.isArray(rawJobIds) ? rawJobIds : []).map(String).filter(Boolean))];
  if (jobIds.length === 0) throw new Error('Pilih minimal satu lowongan');
  if (jobIds.length > MAX_JOBS) throw new Error(`Maksimal ${MAX_JOBS} lowongan sekali ekspor`);
  const db = getAdminDb();
  const chunks = Array.from({ length: Math.ceil(jobIds.length / CHUNK) }, (_, i) => jobIds.slice(i * CHUNK, (i + 1) * CHUNK));
  const [snapshot, jobs, ...appSnaps] = await Promise.all([
    getSnapshot(actor),
    Promise.all(jobIds.map((id) => db.collection('jobs').doc(id).get())),
    ...chunks.map((ids) => db.collection('jobApplications').where('jobId', 'in', ids)
      .select('studentId', 'jobId', 'cvId', 'personal.fullName', 'personal.email', 'interview.date', 'interview.start', 'interview.durationMin').get()),
  ]);
  const job = new Map(jobs.filter((j) => j.exists).map((j) => [j.id, { role: String(j.get('title') ?? ''), company: String(j.get('partnerName') ?? '') }]));
  const capstone = new Map(snapshot.ranking.map((r) => [r.studentId, r.pending?.includes('capstone') ? null : r.capstone]));
  return appSnaps.flatMap((s) => s.docs)
    .map((a) => {
      const j = job.get(String(a.get('jobId'))) ?? { role: '', company: '' };
      const date = a.get('interview.date');
      return {
        name: String(a.get('personal.fullName') ?? ''), email: String(a.get('personal.email') ?? ''),
        capstone: capstone.get(String(a.get('studentId'))) ?? null, cvId: String(a.get('cvId') ?? ''), ...j,
        interview: date ? { date: String(date), start: String(a.get('interview.start') ?? ''), durationMin: Number(a.get('interview.durationMin') ?? 0) } : null,
      };
    })
    .sort((x, y) => x.company.localeCompare(y.company) || x.role.localeCompare(y.role) || x.name.localeCompare(y.name));
}
