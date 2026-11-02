/**
 * Pelamar untuk admin: daftar per lowongan, detail satu lamaran, dan perubahan
 * status. Admin menjalankan seleksi sampai portal PIC tersedia di Tahap 3.
 *
 * Applicants for admins: the list per job, one application's detail, and status
 * changes. Admins run selection until the PIC portal arrives in stage 3.
 */
import { getAdminDb } from '../../lib/firebase/admin';
import { APPLICATION_STATUS_LABELS, type Application, type ApplicationStatus, type JobQuestion } from './model';

export interface ApplicantRow {
  id: string; number: string; fullName: string; email: string; phone: string; city: string; school: string; major: string; className: string;
  finalScore: number | null; finalScorePending: boolean; finalScoreAt: string | null; status: ApplicationStatus;
  submittedAt: string; statusChangedAt: string; cvId: string; portfolioUrl: string;
}

const db = () => getAdminDb();

async function classNames(): Promise<Map<string, string>> {
  const snap = await db().collection('classes').select('canonicalName').get();
  return new Map(snap.docs.map((c) => [c.id, String(c.get('canonicalName') ?? '')]));
}

export async function listApplicants(jobId: string): Promise<ApplicantRow[]> {
  const [snap, classes] = await Promise.all([
    db().collection('jobApplications').where('jobId', '==', jobId)
      .select('number', 'personal', 'classId', 'finalScore', 'finalScorePending', 'finalScoreAt', 'status', 'submittedAt', 'statusChangedAt', 'cvId', 'portfolioUrl')
      .get(),
    classNames(),
  ]);
  return snap.docs
    .map((a) => {
      const d = a.data();
      const p = d.personal ?? {};
      return {
        id: a.id, number: d.number ?? '', fullName: p.fullName ?? '', email: p.email ?? '', phone: p.phone ?? '', city: p.city ?? '',
        school: p.school ?? '', major: p.major ?? '', className: classes.get(d.classId) ?? '',
        finalScore: d.finalScore ?? null, finalScorePending: !!d.finalScorePending, finalScoreAt: d.finalScoreAt ?? null,
        status: d.status, submittedAt: d.submittedAt ?? '', statusChangedAt: d.statusChangedAt ?? '', cvId: d.cvId ?? '', portfolioUrl: d.portfolioUrl ?? '',
      };
    })
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

export async function getApplicationForAdmin(id: string): Promise<Application & { className: string; questions: JobQuestion[] }> {
  const snap = await db().collection('jobApplications').doc(id).get();
  if (!snap.exists) throw new Error('Lamaran tidak ditemukan');
  const a = { ...(snap.data() as Application), id };
  const [job, cls] = await Promise.all([
    db().collection('jobs').doc(a.jobId).get(),
    a.classId ? db().collection('classes').doc(a.classId).get() : null,
  ]);
  return { ...a, className: String(cls?.get('canonicalName') ?? ''), questions: ((job.exists ? job.get('questions') : []) ?? []) as JobQuestion[] };
}

export async function setApplicationStatus(id: string, status: unknown, rejectReason?: unknown): Promise<void> {
  if (typeof status !== 'string' || !(status in APPLICATION_STATUS_LABELS)) throw new Error('Status lamaran tidak dikenal');
  const ref = db().collection('jobApplications').doc(id);
  if (!(await ref.get()).exists) throw new Error('Lamaran tidak ditemukan');
  const t = new Date().toISOString();
  // Alasan penolakan bersifat internal dan hanya bermakna untuk status tidak lolos
  // The rejection reason is internal and only means something for the rejected status
  await ref.update({
    status, statusChangedAt: t, updatedAt: t,
    rejectReason: status === 'tidak-lolos' ? String(rejectReason ?? '').trim().slice(0, 300) : '',
  });
}
