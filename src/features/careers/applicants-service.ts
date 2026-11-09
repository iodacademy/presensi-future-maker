/**
 * Pelamar untuk admin: daftar per lowongan, detail satu lamaran, dan perubahan
 * status. Admin menjalankan seleksi sampai portal PIC tersedia di Tahap 3.
 *
 * Applicants for admins: the list per job, one application's detail, and status
 * changes. Admins run selection until the PIC portal arrives in stage 3.
 */
import { getAdminDb } from '../../lib/firebase/admin';
import { APPLICATION_STATUS_LABELS, FINAL_MESSAGE, FINAL_STATUSES, type Application, type ApplicationStatus, type JobQuestion, type Scheme } from './model';

export interface ApplicantRow {
  id: string; number: string; fullName: string; email: string; phone: string; city: string; school: string; major: string; className: string;
  finalScore: number | null; finalScorePending: boolean; finalScoreAt: string | null; status: ApplicationStatus;
  submittedAt: string; statusChangedAt: string; cvId: string; portfolioUrl: string; scheme: Scheme; completedAt: string | null;
}

const db = () => getAdminDb();

async function classNames(): Promise<Map<string, string>> {
  const snap = await db().collection('classes').select('canonicalName').get();
  return new Map(snap.docs.map((c) => [c.id, String(c.get('canonicalName') ?? '')]));
}

export async function listApplicants(jobId: string): Promise<ApplicantRow[]> {
  const [snap, classes] = await Promise.all([
    db().collection('jobApplications').where('jobId', '==', jobId)
      .select('number', 'personal', 'classId', 'finalScore', 'finalScorePending', 'finalScoreAt', 'status', 'submittedAt', 'statusChangedAt', 'cvId', 'portfolioUrl', 'scheme', 'completedAt')
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
        status: d.status, submittedAt: d.submittedAt ?? '', statusChangedAt: d.statusChangedAt ?? '', cvId: d.cvId ?? '', portfolioUrl: d.portfolioUrl ?? '', scheme: d.scheme ?? 'full', completedAt: d.completedAt ?? null,
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
  // Status akhir hanya lahir dari jawaban kandidat, yang sekaligus menutup lamarannya yang lain
  // Final statuses only come from the candidate's answer, which also closes their other applications
  if (FINAL_STATUSES.includes(status as ApplicationStatus)) throw new Error('Status ini hanya bisa dari jawaban kandidat');
  const ref = db().collection('jobApplications').doc(id);
  const cur = await ref.get();
  if (!cur.exists) throw new Error('Lamaran tidak ditemukan');
  if (FINAL_STATUSES.includes(cur.get('status'))) throw new Error(FINAL_MESSAGE);
  // Lamaran tidak lolos milik kandidat yang sudah bergabung di tempat lain tidak boleh dihidupkan lagi.
  // Kandidat yang mengerjakan proyek tetap boleh diproses untuk lamaran proyek lainnya.
  // A rejected application of a candidate who already joined elsewhere must not be revived.
  // A candidate working on a project may still be processed for their other project applications.
  if (status !== 'tidak-lolos') {
    const mine = await db().collection('jobApplications').where('studentId', '==', cur.get('studentId')).select('status', 'scheme').get();
    const joined = mine.docs.filter((d) => d.id !== id && d.get('status') === 'bergabung');
    if (joined.some((d) => (d.get('scheme') ?? 'full') === 'full') || (joined.length > 0 && cur.get('scheme') !== 'project')) {
      throw new Error('Kandidat sudah menerima tawaran magang di tempat lain');
    }
  }
  const t = new Date().toISOString();
  // Alasan penolakan bersifat internal dan hanya bermakna untuk status tidak lolos
  // The rejection reason is internal and only means something for the rejected status
  await ref.update({
    status, statusChangedAt: t, updatedAt: t,
    rejectReason: status === 'tidak-lolos' ? String(rejectReason ?? '').trim().slice(0, 300) : '',
  });
}
