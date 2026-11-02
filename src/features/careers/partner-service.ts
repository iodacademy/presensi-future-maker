/**
 * Layanan portal PIC mitra. Setiap fungsi membatasi diri pada mitra milik PIC
 * yang masuk; lamaran perusahaan lain diperlakukan seolah tidak ada, agar id
 * yang ditebak tidak membocorkan keberadaannya.
 *
 * Partner PIC portal service. Every function confines itself to the signed-in
 * PIC's partner; another company's application is treated as missing, so a
 * guessed id does not reveal that it exists.
 */
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import { getApplicationForAdmin, listApplicants, setApplicationStatus, type ApplicantRow } from './applicants-service';
import { getPartner } from './admin-service';
import { jobState, validatePartnerInput, type ApplicationStatus, type Job } from './model';

export type PartnerActor = Actor & { partnerId: string };
const db = () => getAdminDb();

async function ownApplication(actor: PartnerActor, appId: string) {
  const snap = await db().collection('jobApplications').doc(appId).get();
  if (!snap.exists || snap.get('partnerId') !== actor.partnerId) throw new Error('Lamaran tidak ditemukan');
  return snap;
}

export async function partnerDashboard(actor: PartnerActor, now: Date) {
  const [partner, jSnap, aSnap] = await Promise.all([
    db().collection('partners').doc(actor.partnerId).get(),
    db().collection('jobs').where('partnerId', '==', actor.partnerId)
      .select('title', 'employment', 'scheme', 'quota', 'status', 'opensAt', 'closesAt', 'applicantCount').get(),
    db().collection('jobApplications').where('partnerId', '==', actor.partnerId).select('jobId', 'status').get(),
  ]);
  const apps = aSnap.docs.map((a) => ({ jobId: a.get('jobId') as string, status: a.get('status') as ApplicationStatus }));
  const count = (s: ApplicationStatus) => apps.filter((a) => a.status === s).length;
  const jobs = jSnap.docs
    .map((j) => ({ id: j.id, ...(j.data() as Pick<Job, 'title' | 'employment' | 'scheme' | 'quota' | 'status' | 'opensAt' | 'closesAt' | 'applicantCount'>) }))
    .filter((j) => j.status === 'published')
    .map((j) => ({
      id: j.id, title: j.title, employment: j.employment, scheme: j.scheme, quota: j.quota, closesAt: j.closesAt, state: jobState(j, now),
      applicantCount: j.applicantCount ?? 0, newCount: apps.filter((a) => a.jobId === j.id && a.status === 'baru').length,
    }))
    .sort((a, b) => b.closesAt.localeCompare(a.closesAt));
  return {
    partnerName: String(partner.get('name') ?? ''),
    stats: { newCount: count('baru'), shortlist: count('shortlist'), interviews: count('interview'), activeJobs: jobs.filter((j) => j.state === 'aktif').length },
    jobs,
  };
}

export async function listCandidates(actor: PartnerActor, jobId: string): Promise<ApplicantRow[]> {
  const job = await db().collection('jobs').doc(jobId).get();
  if (!job.exists || job.get('partnerId') !== actor.partnerId) throw new Error('Lowongan tidak ditemukan');
  return listApplicants(jobId);
}

/**
 * Membuka kandidat berstatus baru menandainya ditinjau, sehingga siswa melihat "Dilihat mitra".
 *
 * Opening a new candidate marks it reviewed, so the student sees "Dilihat mitra".
 */
export async function getCandidate(actor: PartnerActor, appId: string) {
  const snap = await ownApplication(actor, appId);
  if (snap.get('status') === 'baru') await setApplicationStatus(appId, 'ditinjau');
  return getApplicationForAdmin(appId);
}

// Interview diatur lewat formulir undangan; baru tidak bisa dipilih kembali / Interview goes through the invite form; new cannot be chosen again
const PIC_STATUSES: ApplicationStatus[] = ['ditinjau', 'shortlist', 'diterima', 'tidak-lolos'];

export async function decideCandidate(actor: PartnerActor, appId: string, status: unknown, reason?: unknown): Promise<void> {
  await ownApplication(actor, appId);
  if (!PIC_STATUSES.includes(status as ApplicationStatus)) throw new Error('Status ini tidak bisa dipilih');
  await setApplicationStatus(appId, status, reason);
}

export async function getOwnProfile(actor: PartnerActor) {
  const p = await getPartner(actor.partnerId);
  if (!p) throw new Error('Mitra tidak ditemukan');
  const { pics: _pics, nameKey: _key, ...rest } = p;
  return rest;
}

// Nama dan PIC tetap diatur admin: nama menjadi rute lamaran / Name and PICs stay with admins: the name routes applications
export async function updateOwnProfile(actor: PartnerActor, raw: unknown): Promise<void> {
  const current = await getPartner(actor.partnerId);
  if (!current) throw new Error('Mitra tidak ditemukan');
  const input = validatePartnerInput({ ...(raw as object), name: current.name, pics: current.pics });
  await db().collection('partners').doc(actor.partnerId).update({
    field: input.field, about: input.about, website: input.website, socials: input.socials, logo: input.logo, updatedAt: new Date().toISOString(),
  });
}
