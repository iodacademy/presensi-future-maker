/**
 * Layanan admin Job Portal: mitra dan lowongan. Rute API memeriksa peran admin
 * sebelum memanggil fungsi di sini.
 *
 * Job Portal admin service: partners and jobs. API routes check the admin role
 * before calling anything here.
 */
import { getAdminDb } from '../../lib/firebase/admin';
import {
  jobState, partnerNameKey, validateJobInput, validatePartnerInput,
  type Category, type Employment, type Job, type JobStatus, type Partner, type Scheme, type WorkMode,
} from './model';

export interface PartnerRow { id: string; name: string; field: string; logoThumb: string; picNames: string[]; jobCount: number }
export interface JobRow {
  id: string; title: string; employment: Employment; category: Category; scheme: Scheme; location: string; workMode: WorkMode; quota: number;
  partnerId: string; partnerName: string; picName: string; opensAt: string; closesAt: string; status: JobStatus; applicantCount: number;
}

const partners = () => getAdminDb().collection('partners');
const jobs = () => getAdminDb().collection('jobs');
const now = () => new Date().toISOString();

async function assertUniqueName(name: string, selfId?: string) {
  const snap = await partners().where('nameKey', '==', partnerNameKey(name)).get();
  // Nama mitra menjadi rute lamaran ke PIC, jadi dua mitra bernama sama membuat lamaran salah alamat
  // The partner name routes applications to the PIC, so two partners with one name misroute applications
  if (snap.docs.some((d) => d.id !== selfId)) throw new Error('Nama perusahaan sudah terdaftar');
}

export async function listPartners(): Promise<PartnerRow[]> {
  const [pSnap, jSnap] = await Promise.all([
    partners().select('name', 'field', 'logo.thumb', 'pics').get(),
    jobs().select('partnerId').get(),
  ]);
  const counts = new Map<string, number>();
  jSnap.docs.forEach((j) => counts.set(j.get('partnerId'), (counts.get(j.get('partnerId')) ?? 0) + 1));
  return pSnap.docs.map((p) => {
    const d = p.data();
    return {
      id: p.id, name: d.name ?? '', field: d.field ?? '', logoThumb: d.logo?.thumb ?? '',
      picNames: ((d.pics ?? []) as { name: string }[]).map((x) => x.name), jobCount: counts.get(p.id) ?? 0,
    };
  });
}

export async function getPartner(id: string): Promise<Partner | null> {
  const s = await partners().doc(id).get();
  return s.exists ? ({ ...s.data(), id } as Partner) : null;
}

export async function createPartner(raw: unknown): Promise<string> {
  const input = validatePartnerInput(raw);
  await assertUniqueName(input.name);
  const t = now();
  const ref = await partners().add({ ...input, nameKey: partnerNameKey(input.name), active: true, createdAt: t, updatedAt: t });
  return ref.id;
}

export async function updatePartner(id: string, raw: unknown): Promise<void> {
  const input = validatePartnerInput(raw);
  const current = await getPartner(id);
  if (!current) throw new Error('Mitra tidak ditemukan');
  await assertUniqueName(input.name, id);
  await partners().doc(id).update({ ...input, nameKey: partnerNameKey(input.name), updatedAt: now() });
  if (input.name !== current.name) {
    // Nama mitra disalin ke lowongan agar kartu tidak perlu membaca mitra; salinannya ikut diperbarui
    // The partner name is copied onto jobs so cards need not read the partner; the copies follow it
    const own = await jobs().where('partnerId', '==', id).get();
    const batch = getAdminDb().batch();
    own.docs.forEach((j) => batch.update(j.ref, { partnerName: input.name }));
    await batch.commit();
  }
}

const JOB_ROW_FIELDS = [
  'title', 'employment', 'category', 'scheme', 'location', 'workMode', 'quota', 'partnerId', 'partnerName',
  'opensAt', 'closesAt', 'status', 'applicantCount',
];

export async function listJobs(): Promise<JobRow[]> {
  const [jSnap, pSnap] = await Promise.all([jobs().select(...JOB_ROW_FIELDS).get(), partners().select('pics').get()]);
  const pic = new Map(pSnap.docs.map((p) => [p.id, ((p.data().pics ?? []) as { name: string }[])[0]?.name ?? '']));
  return jSnap.docs
    .map((j) => {
      const d = j.data();
      return { ...(Object.fromEntries(JOB_ROW_FIELDS.map((f) => [f, d[f]])) as Omit<JobRow, 'id' | 'picName'>), id: j.id, picName: pic.get(d.partnerId) ?? '', applicantCount: d.applicantCount ?? 0 };
    })
    .sort((a, b) => b.closesAt.localeCompare(a.closesAt));
}

export async function getJob(id: string): Promise<Job | null> {
  const s = await jobs().doc(id).get();
  return s.exists ? ({ ...s.data(), id } as Job) : null;
}

export async function createJob(raw: unknown): Promise<string> {
  const input = validateJobInput(raw);
  const partner = await getPartner(input.partnerId);
  if (!partner) throw new Error('Mitra tidak ditemukan');
  const t = now();
  const ref = await jobs().add({ ...input, partnerName: partner.name, applicantCount: 0, createdAt: t, updatedAt: t });
  return ref.id;
}

/**
 * Jumlah pelamar diperiksa di dalam transaksi: lamaran yang masuk di antara
 * pemeriksaan dan penulisan akan tertinggal di lowongan terhapus, atau terkirim
 * ke mitra lama.
 *
 * The applicant count is checked inside a transaction: an application landing
 * between the check and the write would be stranded on a deleted job, or routed
 * to the old partner.
 */
export async function updateJob(id: string, raw: unknown): Promise<void> {
  const input = validateJobInput(raw);
  const db = getAdminDb();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobs().doc(id));
    if (!snap.exists) throw new Error('Lowongan tidak ditemukan');
    const current = snap.data() as Job;
    let partnerName = current.partnerName;
    if (input.partnerId !== current.partnerId) {
      if ((current.applicantCount ?? 0) > 0) throw new Error('Mitra lowongan yang sudah punya pelamar tidak bisa diganti');
      const partner = await tx.get(partners().doc(input.partnerId));
      if (!partner.exists) throw new Error('Mitra tidak ditemukan');
      partnerName = partner.data()!.name;
    }
    tx.update(jobs().doc(id), { ...input, partnerName, updatedAt: now() });
  });
}

export async function deleteJob(id: string): Promise<void> {
  await getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(jobs().doc(id));
    if (!snap.exists) throw new Error('Lowongan tidak ditemukan');
    if (((snap.data() as Job).applicantCount ?? 0) > 0) throw new Error('Lowongan yang sudah punya pelamar tidak bisa dihapus');
    tx.delete(jobs().doc(id));
  });
}

export async function portalStats(at: Date): Promise<{ activeJobs: number; applicants: number; partners: number; interviews: number }> {
  const db = getAdminDb();
  const [jSnap, pCount, iCount] = await Promise.all([
    jobs().select('status', 'opensAt', 'closesAt', 'applicantCount').get(),
    partners().count().get(),
    db.collection('jobApplications').where('status', '==', 'interview').count().get(),
  ]);
  const rows = jSnap.docs.map((j) => j.data() as Pick<Job, 'status' | 'opensAt' | 'closesAt' | 'applicantCount'>);
  return {
    activeJobs: rows.filter((r) => jobState(r, at) === 'aktif').length,
    applicants: rows.reduce((sum, r) => sum + (r.applicantCount ?? 0), 0),
    partners: pCount.data().count,
    interviews: iCount.data().count,
  };
}
