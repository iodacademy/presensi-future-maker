/**
 * Layanan admin Job Portal: mitra dan lowongan. Rute API memeriksa peran admin
 * sebelum memanggil fungsi di sini.
 *
 * Job Portal admin service: partners and jobs. API routes check the admin role
 * before calling anything here.
 */
import crypto from 'crypto';
import { getAdminDb } from '../../lib/firebase/admin';
import { getEmailHash, normalizeEmail } from '../auth/policy';
import {
  DEMO_CLASS_ID, jobPic, jobState, partnerNameKey, validateJobInput, validatePartnerInput,
  type Category, type Employment, type Job, type JobStatus, type Partner, type Scheme, type WorkMode,
} from './model';

export interface PartnerRow {
  id: string; name: string; field: string; logoThumb: string; picNames: string[]; jobCount: number; picAccounts: string[];
  /** Pilihan PIC di formulir lowongan / The PIC choices in the job form */
  pics: { name: string; email: string }[];
}
export interface JobRow {
  id: string; title: string; employment: Employment; category: Category; scheme: Scheme; location: string; workMode: WorkMode; quota: number;
  partnerId: string; partnerName: string; picName: string; picEmail: string; opensAt: string; closesAt: string; status: JobStatus; applicantCount: number;
  /** Lowongan fiktif untuk akun demo; tidak dihitung dalam total kuota / A fictitious job for demo accounts; left out of the quota total */
  demo: boolean;
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
  const [pSnap, jSnap, aSnap, multiSnap] = await Promise.all([
    partners().select('name', 'field', 'logo.thumb', 'pics').get(),
    jobs().select('partnerId').get(),
    getAdminDb().collection('users').where('role', '==', 'partner').select('email', 'partnerId').get(),
    // Akun berperan ganda, mis. mentor yang juga PIC / Multi-role accounts, e.g. a mentor who is also a PIC
    getAdminDb().collection('users').where('roles', 'array-contains', 'partner').select('email', 'partnerId').get(),
  ]);
  const accounts = new Map<string, string[]>();
  const seen = new Set<string>();
  [...aSnap.docs, ...multiSnap.docs].filter((u) => !seen.has(u.id) && seen.add(u.id))
    .forEach((u) => accounts.set(u.get('partnerId'), [...(accounts.get(u.get('partnerId')) ?? []), u.get('email')]));
  const counts = new Map<string, number>();
  jSnap.docs.forEach((j) => counts.set(j.get('partnerId'), (counts.get(j.get('partnerId')) ?? 0) + 1));
  return pSnap.docs.map((p) => {
    const d = p.data();
    return {
      id: p.id, name: d.name ?? '', field: d.field ?? '', logoThumb: d.logo?.thumb ?? '',
      picNames: ((d.pics ?? []) as { name: string }[]).map((x) => x.name),
      pics: ((d.pics ?? []) as { name: string; email: string }[]).map((x) => ({ name: x.name, email: x.email })), jobCount: counts.get(p.id) ?? 0, picAccounts: accounts.get(p.id) ?? [],
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
  // PIC yang dihapus dari daftar kehilangan aksesnya: akun nonaktif tidak bisa masuk dan sesinya ditolak
  // A PIC removed from the list loses access: an inactive account cannot sign in and its session is refused
  const keep = new Set(input.pics.map((p) => normalizeEmail(p.email)));
  // Hanya akun PIC yang memiliki partnerId / Only PIC accounts carry a partnerId
  const accounts = await getAdminDb().collection('users').where('partnerId', '==', id).select('email', 'active', 'role', 'roles').get();
  // Akun berperan ganda dicabut peran PIC-nya walau sedang nonaktif, agar peran itu tidak kembali saat diaktifkan
  // A multi-role account loses its PIC role even while inactive, so the role does not return on reactivation
  const revoke = accounts.docs.filter((u) => !keep.has(normalizeEmail(String(u.get('email')))) && (u.get('role') !== 'partner' || u.get('active') !== false));
  if (revoke.length) {
    const b = getAdminDb().batch();
    revoke.forEach((u) => b.update(u.ref, u.get('role') === 'partner'
      ? { active: false, updatedAt: now() }
      // Akun berperan ganda hanya kehilangan peran PIC; peran utamanya tetap jalan
      // A multi-role account only loses the PIC role; its primary role keeps working
      : { roles: ((u.get('roles') ?? []) as string[]).filter((r) => r !== 'partner'), partnerId: null, updatedAt: now() }));
    await b.commit();
  }
  if (input.name !== current.name) {
    // Nama mitra disalin ke lowongan agar kartu tidak perlu membaca mitra; salinannya ikut diperbarui
    // The partner name is copied onto jobs so cards need not read the partner; the copies follow it
    const own = await jobs().where('partnerId', '==', id).get();
    const batch = getAdminDb().batch();
    own.docs.forEach((j) => batch.update(j.ref, { partnerName: input.name }));
    await batch.commit();
  }
}

/**
 * Membuat akun login (peran partner) untuk setiap PIC mitra. Semua email diperiksa dulu: bila satu saja
 * sudah dipakai akun lain, tidak ada akun yang dibuat, agar PIC tidak masuk sebagai siswa atau mentor.
 *
 * Creates a login account (partner role) for each of a partner's PICs. Every email is checked first: if
 * even one belongs to another account, none is created, so a PIC never signs in as a student or mentor.
 */
export async function createPicAccounts(partnerId: string): Promise<{ created: string[]; existing: string[] }> {
  const partner = await getPartner(partnerId);
  if (!partner) throw new Error('Mitra tidak ditemukan');
  const db = getAdminDb();
  const todo: { name: string; email: string }[] = [];
  const existing: string[] = [];
  const link: { ref: FirebaseFirestore.DocumentReference; roles: string[] }[] = [];
  for (const pic of partner.pics) {
    const email = normalizeEmail(pic.email);
    const idx = await db.collection('emailIndex').doc(getEmailHash(email)).get();
    if (!idx.exists) { todo.push({ name: pic.name, email }); continue; }
    const user = await db.collection('users').doc(String(idx.get('uid'))).get();
    if (user.get('role') === 'partner' && user.get('partnerId') === partnerId) {
      existing.push(email);
      // PIC yang ditambahkan kembali diaktifkan lagi / A PIC added back is reactivated
      if (user.get('active') === false) await user.ref.update({ active: true, updatedAt: now() });
    } else if (['mentor', 'admin'].includes(user.get('role')) && (!user.get('partnerId') || user.get('partnerId') === partnerId)) {
      // Mentor atau admin yang juga PIC memakai akun yang sama dengan peran tambahan, bukan akun kedua
      // A mentor or admin who is also a PIC keeps one account with an extra role, not a second account
      existing.push(email);
      link.push({ ref: user.ref, roles: [...new Set([String(user.get('role')), ...((user.get('roles') ?? []) as string[]), 'partner'])] });
    } else throw new Error(`Email ${email} sudah dipakai akun lain. Pakai email lain untuk PIC.`);
  }
  const t = now();
  const batch = db.batch();
  for (const l of link) batch.update(l.ref, { roles: l.roles, partnerId, updatedAt: t });
  for (const { name, email } of todo) {
    const uid = crypto.randomUUID();
    batch.set(db.collection('users').doc(uid), { uid, email, normalizedEmail: email, name, role: 'partner', partnerId, active: true, classId: null, createdAt: t, updatedAt: t });
    batch.set(db.collection('emailIndex').doc(getEmailHash(email)), { uid, normalizedEmail: email, role: 'partner', createdAt: t });
  }
  await batch.commit();
  return { created: todo.map((x) => x.email), existing };
}

const JOB_ROW_FIELDS = [
  'title', 'employment', 'category', 'scheme', 'location', 'workMode', 'quota', 'partnerId', 'partnerName',
  'opensAt', 'closesAt', 'status', 'applicantCount', 'picEmail',
];

// PIC lowongan wajib salah satu PIC mitranya, agar kandidat tidak diarahkan ke orang luar
// A job's PIC must be one of its partner's PICs, so candidates are never routed to an outsider
function assertJobPic(partner: Pick<Partner, 'pics'>, picEmail: string) {
  if (picEmail && !partner.pics.some((p) => p.email.toLowerCase() === picEmail)) throw new Error('PIC lowongan tidak terdaftar di mitra ini');
}

export async function listJobs(): Promise<JobRow[]> {
  const [jSnap, pSnap] = await Promise.all([jobs().select(...JOB_ROW_FIELDS, 'eligibility').get(), partners().select('pics').get()]);
  const pics = new Map(pSnap.docs.map((p) => [p.id, (p.data().pics ?? []) as { name: string; email: string }[]]));
  return jSnap.docs
    .map((j) => {
      const d = j.data();
      return {
        ...(Object.fromEntries(JOB_ROW_FIELDS.map((f) => [f, d[f]])) as Omit<JobRow, 'id' | 'picName' | 'demo'>), id: j.id,
        picName: jobPic(pics.get(d.partnerId) ?? [], d.picEmail)?.name ?? '', picEmail: d.picEmail ?? '', applicantCount: d.applicantCount ?? 0,
        demo: d.eligibility?.mode === 'classes' && (d.eligibility.classIds ?? []).includes(DEMO_CLASS_ID),
      };
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
  assertJobPic(partner, input.picEmail);
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
    if (input.partnerId !== current.partnerId && (current.applicantCount ?? 0) > 0) throw new Error('Mitra lowongan yang sudah punya pelamar tidak bisa diganti');
    if (input.partnerId !== current.partnerId || input.picEmail) {
      const partner = await tx.get(partners().doc(input.partnerId));
      if (!partner.exists) throw new Error('Mitra tidak ditemukan');
      partnerName = partner.data()!.name;
      assertJobPic({ pics: partner.data()!.pics ?? [] }, input.picEmail);
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
