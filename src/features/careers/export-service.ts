import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import { getSnapshot } from '../dashboard/snapshot-service';
import { APPLICATION_STATUS_LABELS, DEMO_CLASS_ID, PLACEMENT_COLLECTION, salaryLabel, SCHEME_LABELS, type Job, type Scheme } from './model';

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

export interface PassedRow {
  name: string; email: string; phone: string; status: string; company: string; address: string; role: string;
  /** Jenis magang: Full Internship atau Project Based / Internship type: Full Internship or Project Based */
  scheme: string; salary: string; tasks: string;
}

/**
 * Peserta yang lolos seleksi: lamaran berstatus lolos atau menerima tawaran, ditambah
 * penempatan dari luar portal. Alamat diambil dari data mitra; bila belum diisi, dari
 * lokasi lowongan. Tugas diambil dari deskripsi pekerjaan lowongan.
 *
 * Participants who passed selection: applications passed or accepted, plus placements
 * made outside the portal. The address comes from the partner; when still empty, from
 * the job's location. Tasks come from the job description.
 */
export async function exportPassed(): Promise<PassedRow[]> {
  const db = getAdminDb();
  const [apps, placements] = await Promise.all([
    db.collection('jobApplications').where('status', 'in', ['diterima', 'bergabung'])
      .select('studentId', 'jobId', 'status', 'personal.fullName', 'personal.email', 'personal.phone').get(),
    db.collection(PLACEMENT_COLLECTION).select('studentId', 'jobId', 'position', 'partnerName', 'scheme').get(),
  ]);
  const placed = placements.docs.map((d) => ({ studentId: String(d.get('studentId') ?? d.id), jobId: String(d.get('jobId') ?? ''), position: String(d.get('position') ?? ''), partnerName: String(d.get('partnerName') ?? ''), scheme: (d.get('scheme') === 'project' ? 'project' : 'full') as Scheme }));
  const placedIds = placed.map((p) => p.studentId);
  const jobIds = [...new Set([...apps.docs.map((a) => String(a.get('jobId'))), ...placed.map((p) => p.jobId)].filter(Boolean))];
  const [jobSnaps, users, profiles] = await Promise.all([
    Promise.all(jobIds.map((id) => db.collection('jobs').doc(id).get())),
    Promise.all(placedIds.map((id) => db.collection('users').doc(id).get())),
    // Peserta yang ditempatkan di luar portal belum tentu pernah melamar, jadi nomor WA-nya dari profil
    // A participant placed outside the portal may never have applied, so their WhatsApp number comes from the profile
    Promise.all(placedIds.map((id) => db.collection('studentProfiles').doc(id).get())),
  ]);
  const jobs = new Map(jobSnaps.filter((j) => j.exists).map((j) => [j.id, j.data() as Job]));
  const partnerIds = [...new Set([...jobs.values()].map((j) => j.partnerId).filter(Boolean))];
  const partners = await Promise.all(partnerIds.map((id) => db.collection('partners').doc(id).get()));
  const address = new Map(partners.map((p) => [p.id, String(p.get('address') ?? '').trim()]));
  const phone = new Map(profiles.filter((p) => p.exists).map((p) => [p.id, String(p.get('phone') ?? '')]));
  const user = new Map(users.filter((u) => u.exists).map((u) => [u.id, u]));

  const fromJob = (jobId: string, fallback: { company: string; role: string; scheme?: Scheme }) => {
    const j = jobs.get(jobId);
    return {
      company: j?.partnerName || fallback.company, role: j?.title || fallback.role, scheme: SCHEME_LABELS[j?.scheme ?? fallback.scheme ?? 'full'],
      address: (j && address.get(j.partnerId)) || j?.location || '',
      salary: salaryLabel(j?.salary, j?.scheme, j?.durationMonths) ?? 'Tidak dicantumkan', tasks: j?.description ?? '',
    };
  };
  const isDemo = (jobId: string) => { const e = jobs.get(jobId)?.eligibility; return e?.mode === 'classes' && e.classIds.includes(DEMO_CLASS_ID); };
  const placedSet = new Set(placedIds);

  const rows: PassedRow[] = [
    ...apps.docs
      .filter((a) => !isDemo(String(a.get('jobId'))) && !placedSet.has(String(a.get('studentId'))))
      .map((a) => ({
        name: String(a.get('personal.fullName') ?? ''), email: String(a.get('personal.email') ?? ''), phone: String(a.get('personal.phone') ?? ''),
        status: APPLICATION_STATUS_LABELS[a.get('status') as 'diterima' | 'bergabung'],
        ...fromJob(String(a.get('jobId')), { company: '', role: '' }),
      })),
    ...placed.map((p) => {
      const u = user.get(p.studentId);
      return {
        name: String(u?.get('name') ?? ''), email: String(u?.get('email') ?? ''), phone: phone.get(p.studentId) ?? '', status: 'Ditempatkan',
        ...fromJob(p.jobId, { company: p.partnerName, role: p.position, scheme: p.scheme }),
      };
    }),
  ];
  return rows.sort((x, y) => x.company.localeCompare(y.company) || x.role.localeCompare(y.role) || x.name.localeCompare(y.name));
}
