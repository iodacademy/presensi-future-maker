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
import { whatsAppLink } from '../../lib/whatsapp';
import { cancelCalendarEvent } from '../calendar/client';
import { publicUrl } from '../exhibition/media';
import type { Actor } from '../auth/types';
import { getApplicationForAdmin, listApplicants, setApplicationStatus, type ApplicantRow } from './applicants-service';
import { getPartner } from './admin-service';
import { inScope, picJobScope } from './pic-scope';
import { interviewMessage, jobState, offerMessage, validatePartnerInput, type ApplicationStatus, type Interview, type Job } from './model';

export type PartnerActor = Actor & { partnerId: string };
const db = () => getAdminDb();

/** Lowongan mitra yang terlihat oleh PIC ini; null berarti semua / The partner's jobs this PIC can see; null means all */
export async function myJobScope(actor: PartnerActor): Promise<Set<string> | null> {
  const snap = await db().collection('jobs').where('partnerId', '==', actor.partnerId).select('picEmails', 'picEmail').get();
  return picJobScope(actor, snap.docs.map((j) => ({ id: j.id, data: j.data() })));
}

// Lamaran mitra lain atau lowongan yang tidak di-assign diperlakukan seolah tidak ada
// Another partner's application, or one for an unassigned job, is treated as missing
export async function ownApplication(actor: PartnerActor, appId: string) {
  const snap = await db().collection('jobApplications').doc(appId).get();
  if (!snap.exists || snap.get('partnerId') !== actor.partnerId || !inScope(await myJobScope(actor), String(snap.get('jobId')))) {
    throw new Error('Lamaran tidak ditemukan');
  }
  return snap;
}

// Pesan WhatsApp ucapan selamat untuk kandidat yang diloloskan / The congratulation WhatsApp message for a passed candidate
async function offerWaLink(a: { jobId: string; fullName: string; phone: string }): Promise<string | null> {
  const job = await db().collection('jobs').doc(a.jobId).get();
  return whatsAppLink(a.phone, offerMessage({ studentName: a.fullName, jobTitle: String(job.get('title') ?? 'Lowongan'), partnerName: String(job.get('partnerName') ?? '') }));
}

export async function partnerDashboard(actor: PartnerActor, now: Date) {
  const [partner, allJobs, allApps] = await Promise.all([
    db().collection('partners').doc(actor.partnerId).get(),
    db().collection('jobs').where('partnerId', '==', actor.partnerId)
      .select('title', 'employment', 'scheme', 'quota', 'status', 'opensAt', 'closesAt', 'applicantCount', 'picEmails', 'picEmail').get(),
    db().collection('jobApplications').where('partnerId', '==', actor.partnerId).select('jobId', 'status', 'contactedAt', 'personal.fullName', 'personal.phone', 'interview.confirmation', 'interview.rescheduleNote').get(),
  ]);
  const scope = picJobScope(actor, allJobs.docs.map((j) => ({ id: j.id, data: j.data() })));
  const jSnap = { docs: allJobs.docs.filter((j) => inScope(scope, j.id)) };
  const aSnap = { docs: allApps.docs.filter((a) => inScope(scope, String(a.get('jobId')))) };
  // Kandidat lolos yang belum dihubungi PIC / Passed candidates the PIC has not contacted yet
  const toContact = await Promise.all(aSnap.docs
    .filter((a) => ['diterima', 'bergabung'].includes(a.get('status')) && !a.get('contactedAt'))
    .map(async (a) => {
      const x = { jobId: String(a.get('jobId')), fullName: String(a.get('personal.fullName') ?? ''), phone: String(a.get('personal.phone') ?? '') };
      const title = jSnap.docs.find((j) => j.id === x.jobId)?.get('title') ?? 'Lowongan';
      return { id: a.id, fullName: x.fullName, jobTitle: String(title), status: a.get('status') as ApplicationStatus, waLink: await offerWaLink(x) };
    }));
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
    picName: actor.name,
    stats: { newCount: count('baru'), shortlist: count('shortlist'), interviews: count('interview'), activeJobs: jobs.filter((j) => j.state === 'aktif').length },
    jobs,
    toContact,
    // Kandidat yang minta jadwal ulang; hilang setelah PIC mengirim jadwal baru / Candidates asking for a new time; gone once the PIC sends a new schedule
    rescheduleRequests: aSnap.docs
      .filter((a) => a.get('status') === 'interview' && a.get('interview.confirmation') === 'jadwal-ulang')
      .map((a) => ({
        id: a.id, fullName: String(a.get('personal.fullName') ?? ''),
        jobTitle: String(jSnap.docs.find((j) => j.id === a.get('jobId'))?.get('title') ?? 'Lowongan'), note: String(a.get('interview.rescheduleNote') ?? ''),
      })),
  };
}

export async function listCandidates(actor: PartnerActor, jobId: string): Promise<ApplicantRow[]> {
  const job = await db().collection('jobs').doc(jobId).get();
  if (!job.exists || job.get('partnerId') !== actor.partnerId || !inScope(await myJobScope(actor), jobId)) throw new Error('Lowongan tidak ditemukan');
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
  const c = await getApplicationForAdmin(appId);
  const job = await db().collection('jobs').doc(c.jobId).get();
  const names = { studentName: c.personal.fullName, jobTitle: String(job.get('title') ?? 'Lowongan'), partnerName: String(job.get('partnerName') ?? '') };
  const interview = (c as { interview?: Interview }).interview;
  return {
    ...c,
    // Tautan WhatsApp siap kirim untuk undangan interview dan ucapan lolos / Ready-to-send WhatsApp links for the interview invite and the pass message
    interviewWaLink: c.status === 'interview' && interview ? whatsAppLink(c.personal.phone, interviewMessage({ ...names, interview })) : null,
    offerWaLink: ['diterima', 'bergabung'].includes(c.status) ? whatsAppLink(c.personal.phone, offerMessage(names)) : null,
  };
}

// Interview diatur lewat formulir undangan; baru tidak bisa dipilih kembali / Interview goes through the invite form; new cannot be chosen again
const PIC_STATUSES: ApplicationStatus[] = ['ditinjau', 'shortlist', 'diterima', 'tidak-lolos'];

export async function decideCandidate(actor: PartnerActor, appId: string, status: unknown, reason?: unknown): Promise<{ waLink: string | null }> {
  const snap = await ownApplication(actor, appId);
  if (!PIC_STATUSES.includes(status as ApplicationStatus)) throw new Error('Status ini tidak bisa dipilih');
  await setApplicationStatus(appId, status, reason);
  const personal = snap.get('personal') as { fullName: string; phone: string };
  const waLink = status === 'diterima' ? await offerWaLink({ jobId: String(snap.get('jobId')), fullName: personal.fullName, phone: personal.phone }) : null;
  // Kandidat yang ditolak sebelum interview tidak boleh tetap menerima undangan dan pengingat kalender
  // A candidate rejected before the interview must not keep receiving the calendar invite and reminders
  const interview = snap.get('interview') as Interview | undefined;
  if (status === 'tidak-lolos' && interview?.calendarEventId) {
    await cancelCalendarEvent(interview.calendarEventId).catch((e) => console.error('[karier] batal acara interview', e));
    await db().collection('jobApplications').doc(appId).update({ 'interview.calendarEventId': null });
  }
  return { waLink };
}

// Nama untuk kerangka portal: satu baca dokumen, bukan pemindaian lamaran / Names for the portal frame: one document read, not an application scan
export async function partnerMe(actor: PartnerActor): Promise<{ picName: string; partnerName: string }> {
  const p = await db().collection('partners').doc(actor.partnerId).get();
  return { picName: actor.name, partnerName: String(p.get('name') ?? '') };
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
  // Logo hanya dari unggahan portal: gambar luar bisa melacak siswa yang membuka profil
  // Logo only from a portal upload: an outside image could track students who open the profile
  const own = publicUrl(`pameran/mitra/${actor.partnerId}/`).replace('?alt=media', '');
  if (input.logo && ![input.logo.thumb, input.logo.full].every((u) => u.startsWith(own))) throw new Error('Logo harus diunggah lewat portal');
  await db().collection('partners').doc(actor.partnerId).update({
    field: input.field, about: input.about, website: input.website, socials: input.socials, logo: input.logo, updatedAt: new Date().toISOString(),
  });
}
