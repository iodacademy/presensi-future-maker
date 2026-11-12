/**
 * Bacaan Job Portal untuk siswa: lowongan yang boleh dilihat, profil mitra,
 * konteks formulir lamaran, dan lamaran milik sendiri.
 *
 * Job Portal reads for students: the jobs they may see, partner profiles, the
 * application form context, and their own applications.
 */
import { unstable_cache } from 'next/cache';
import { getAdminDb } from '../../lib/firebase/admin';
import { whatsAppLink } from '../../lib/whatsapp';
import type { Actor } from '../auth/types';
import { safeExternalUrl } from '../exhibition/model';
import { isStoredSubmissionFile } from '../tasks/submission-policy';
import { applicationsOpen, CLOSED_MESSAGE } from './apply-gate';
import { listCvs } from './cv-service';
import {
  jobPic, PLACEMENT_COLLECTION, CLOSED_ELSEWHERE_MESSAGE, rescheduleMessage, DEMO_CLASS_ID, hasCareerAccess, isEligible, isOpenToStudents, REJECT_MESSAGE, studentStatusLabel,
  type ApplicationStatus, type PlacedAt, type AttachedTask, type Interview, type PicContact, type AttachedWork, type CvFile, type Eligibility, type Job, type Logo, type Personal, type Socials,
} from './model';
import { applyBlock, canSeeJob, careerStanding, tierOf, type CareerApp, type CareerStanding, type Tier } from './tier';
import type { SummaryRow } from '../dashboard/learning-summary';

export interface StudentJobCard {
  id: string; title: string; partnerId: string; partnerName: string; employment: Job['employment']; category: Job['category']; scheme: Job['scheme'];
  location: string; workMode: Job['workMode']; quota: number; opensAt: string; closesAt: string; applicantCount: number; logo: string | null;
  salary: number | null; durationMonths: number | null;
}
export interface PublicPartner { id: string; name: string; field: string; about: string; logo: Logo | null; website: string; socials: Socials }
export interface MyApplication {
  id: string; jobId: string; number: string; jobTitle: string; partnerName: string;
  status: ApplicationStatus; statusLabel: string; submittedAt: string; message: string | null; scheme: Job['scheme'];
  interview: Omit<Interview, 'calendarEventId'> | null;
  /** WhatsApp ke PIC untuk minta jadwal ulang / WhatsApp to the PIC to ask for a new time */
  picWaLink: string | null;
}
export interface FinalScore { finalScore: number | null; finalScorePending: boolean; finalScoreAt: string | null }

const db = () => getAdminDb();
const CARD_FIELDS = ['title', 'partnerId', 'partnerName', 'employment', 'category', 'scheme', 'location', 'workMode', 'quota', 'opensAt', 'closesAt', 'status', 'applicantCount', 'eligibility', 'salary', 'durationMonths'];

type Standing = { score: number; pending: boolean; placement: string | null; row: SummaryRow };

/**
 * Nilai dan penempatan dari ringkasan dashboard terbaru, disimpan di cache 5 menit: layout siswa
 * membacanya di setiap halaman untuk menampilkan atau menyembunyikan menu Karier.
 *
 * Score and placement from the latest dashboard snapshot, cached for 5 minutes: the student layout
 * reads it on every page to show or hide the Karier menu.
 */
const snapshotStandings = unstable_cache(async (): Promise<{ at: string | null; rows: Record<string, Standing> }> => {
  // generatedAt adalah medan biasa, jadi urutan menurunnya memakai indeks bawaan; tidak perlu indeks khusus
  // generatedAt is a plain field, so its descending order uses the built-in index; no dedicated index needed
  const snap = await db().collection('dashboardSnapshots').orderBy('generatedAt', 'desc').limit(1).select('ranking', 'version').get();
  const doc = snap.docs[0];
  if (!doc) return { at: null, rows: {} };
  // Ringkasan sebelum versi 17 tidak mencatat komponen tertunda, jadi nilainya belum bisa disebut final
  // Snapshots before version 17 do not record pending components, so their score cannot be called final
  const unknown = Number(doc.get('version') ?? 1) < 17;
  const rows: Record<string, Standing> = {};
  for (const r of (doc.get('ranking') ?? []) as (Partial<SummaryRow> & { studentId: string; score: number; pending?: string[]; placement?: string })[]) {
    const pending = unknown || (r.pending?.length ?? 0) > 0;
    rows[r.studentId] = {
      score: r.score, pending, placement: r.placement ?? null,
      row: {
        score: r.score, capstone: r.capstone ?? 0, tasks: r.tasks ?? 0, attendance: r.attendance ?? 0, quiz: r.quiz ?? 0, combined: r.combined ?? 0,
        absent: r.absent ?? 0, placement: (r.placement ?? 'pending') as SummaryRow['placement'], placementReasons: r.placementReasons ?? [], pending,
      },
    };
  }
  return { at: doc.id, rows };
}, ['karier-ringkasan-nilai'], { revalidate: 300 });

export async function latestFinalScore(uid: string): Promise<FinalScore> {
  const { at, rows } = await snapshotStandings();
  const row = rows[uid];
  return { finalScore: row?.score ?? null, finalScorePending: row?.pending ?? false, finalScoreAt: at };
}

// Akun demo tidak ada di dashboard, jadi skemanya ditetapkan Full Internship / Demo accounts are not on the dashboard, so their scheme is fixed at Full Internship
export async function latestPlacement(uid: string, classId?: string | null): Promise<string | null> {
  if (classId === DEMO_CLASS_ID) return 'full';
  return (await snapshotStandings()).rows[uid]?.placement ?? null;
}

// Akun demo tidak ada di dashboard, jadi diberi nilai contoh supaya ringkasan beranda bisa diperagakan
// Demo accounts are not on the dashboard, so they get sample scores to demonstrate the home summary
const DEMO_ROW: SummaryRow = { score: 86, capstone: 85, tasks: 88, attendance: 92, quiz: 80, combined: 86, absent: 0, placement: 'full', placementReasons: [], pending: false };

/** Nilai dan komponen peserta dari ringkasan dashboard terbaru, atau null / The participant's score and components from the latest snapshot, or null */
export async function latestSummaryRow(uid: string, classId?: string | null): Promise<SummaryRow | null> {
  if (classId === DEMO_CLASS_ID) return DEMO_ROW;
  return (await snapshotStandings()).rows[uid]?.row ?? null;
}

/**
 * Tenggat lamaran paling akhir di antara lowongan yang sedang dibuka, atau null bila pendaftaran tutup.
 * Disimpan 5 menit untuk semua siswa, karena beranda membacanya setiap kali dibuka.
 *
 * The latest application deadline among open jobs, or null when applications are closed.
 * Cached for 5 minutes for every student, since the home page reads it on each open.
 */
export const careerApplyUntil = unstable_cache(async (): Promise<string | null> => {
  if (!(await applicationsOpen())) return null;
  const now = new Date();
  const snap = await db().collection('jobs').where('status', '==', 'published').select('status', 'opensAt', 'closesAt', 'eligibility').get();
  return snap.docs
    .map((d) => d.data() as Pick<Job, 'status' | 'opensAt' | 'closesAt' | 'eligibility'>)
    .filter((j) => !(j.eligibility?.mode === 'classes' && j.eligibility.classIds.includes(DEMO_CLASS_ID)) && isOpenToStudents(j, now))
    .reduce<string | null>((max, j) => (!max || j.closesAt > max ? j.closesAt : max), null);
}, ['karier-tenggat-lamar'], { revalidate: 300 });

export async function careerAccess(uid: string, classId?: string | null): Promise<boolean> {
  return hasCareerAccess(await latestPlacement(uid, classId));
}

/** Pendaftaran tutup tidak berlaku bagi akun demo / Closed applications do not apply to demo accounts */
export const canSubmitNow = async (actor: Pick<Actor, 'classId'>): Promise<boolean> => actor.classId === DEMO_CLASS_ID || applicationsOpen();

async function appliedJobIds(uid: string): Promise<Set<string>> {
  const snap = await db().collection('jobApplications').where('studentId', '==', uid).select('jobId').get();
  return new Set(snap.docs.map((d) => d.get('jobId') as string));
}

export const CAREER_APP_FIELDS = ['status', 'scheme', 'completedAt'];

/**
 * Bahan penilaian tier: penempatan, SPA, dan tier. Akun demo selalu tier A agar seluruh alur bisa dicoba.
 *
 * Inputs for the tier rules: placement, SPA, and tier. Demo accounts are always tier A so every flow can be tried.
 */
export async function standingInputs(actor: Pick<Actor, 'uid' | 'classId'>) {
  const [score, placement, placedAt] = await Promise.all([latestFinalScore(actor.uid), latestPlacement(actor.uid, actor.classId), myInternshipPlacement(actor.uid)]);
  const tier: Tier = actor.classId === DEMO_CLASS_ID ? 'A' : tierOf(score.finalScore);
  return { score, placement, tier, standing: (apps: CareerApp[]) => careerStanding(placement, score.finalScore, apps, tier, placedAt) };
}

/** Tempat magang peserta dari penempatan di luar lamaran, atau null / The participant's internship from a placement outside applications, or null */
export async function myInternshipPlacement(uid: string): Promise<PlacedAt | null> {
  const d = await db().collection(PLACEMENT_COLLECTION).doc(uid).get();
  return d.exists ? { partnerName: String(d.get('partnerName') ?? ''), position: String(d.get('position') ?? ''), scheme: d.get('scheme') === 'project' ? 'project' : 'full' } : null;
}

export async function myCareerStanding(actor: Pick<Actor, 'uid' | 'classId'>): Promise<CareerStanding> {
  const [inputs, apps] = await Promise.all([
    standingInputs(actor),
    db().collection('jobApplications').where('studentId', '==', actor.uid).select(...CAREER_APP_FIELDS).get(),
  ]);
  return inputs.standing(apps.docs.map((d) => d.data() as CareerApp));
}

// Skema, tier, dan syarat lowongan diperiksa bersama / Scheme, tier, and the job's requirements are checked together
function eligibilityCheck(actor: Actor, known?: Promise<CareerStanding>) {
  let standing: Promise<[FinalScore, CareerStanding]> | null = null;
  return async (job: Pick<Job, 'eligibility' | 'scheme' | 'salary'>) => {
    standing ??= Promise.all([latestFinalScore(actor.uid), known ?? myCareerStanding(actor)]);
    const [score, s] = await standing;
    return canSeeJob(s, job) && isEligible(job.eligibility, { classId: actor.classId, finalScore: score.finalScore });
  };
}

async function visibleCards(actor: Actor, now: Date, partnerId?: string, standing?: Promise<CareerStanding>): Promise<StudentJobCard[]> {
  let q = db().collection('jobs').where('status', '==', 'published');
  if (partnerId) q = q.where('partnerId', '==', partnerId);
  const [jSnap, pSnap] = await Promise.all([q.select(...CARD_FIELDS).get(), db().collection('partners').select('logo.thumb').get()]);
  const logos = new Map(pSnap.docs.map((p) => [p.id, (p.get('logo.thumb') as string) || null]));
  const eligible = eligibilityCheck(actor, standing);
  const cards: StudentJobCard[] = [];
  for (const j of jSnap.docs) {
    const d = j.data() as Job;
    if (!isOpenToStudents(d, now) || !(await eligible(d))) continue;
    cards.push({
      id: j.id, title: d.title, partnerId: d.partnerId, partnerName: d.partnerName, employment: d.employment, category: d.category, scheme: d.scheme,
      location: d.location, workMode: d.workMode, quota: d.quota, opensAt: d.opensAt, closesAt: d.closesAt,
      applicantCount: d.applicantCount ?? 0, logo: logos.get(d.partnerId) ?? null, salary: d.salary ?? null, durationMonths: d.durationMonths ?? null,
    });
  }
  return cards.sort((a, b) => a.closesAt.localeCompare(b.closesAt));
}

export async function listOpenJobs(actor: Actor, now: Date) {
  if (!(await careerAccess(actor.uid, actor.classId))) return { access: false, jobs: [] as StudentJobCard[], appliedJobIds: [] as string[], bannerClosesAt: null, standing: null };
  const standing = myCareerStanding(actor);
  const [jobs, applied, s] = await Promise.all([visibleCards(actor, now, undefined, standing), appliedJobIds(actor.uid), standing]);
  const bannerClosesAt = jobs.reduce<string | null>((max, j) => (!max || j.closesAt > max ? j.closesAt : max), null);
  return { access: true, jobs, appliedJobIds: jobs.filter((j) => applied.has(j.id)).map((j) => j.id), bannerClosesAt, standing: s };
}

function toPublic(id: string, d: Record<string, unknown>): PublicPartner {
  return {
    id, name: String(d.name ?? ''), field: String(d.field ?? ''), about: String(d.about ?? ''), logo: (d.logo as Logo) ?? null,
    website: String(d.website ?? ''), socials: (d.socials as Socials) ?? { instagram: '', linkedin: '', tiktok: '', youtube: '' },
  };
}

async function publicPartner(id: string): Promise<PublicPartner | null> {
  const s = await db().collection('partners').doc(id).get();
  return s.exists ? toPublic(id, s.data()!) : null;
}

/**
 * Lowongan yang tidak terbuka untuk siswa ini tampil sebagai tidak ada, kecuali
 * ia sudah melamarnya: lamaran lama tetap bisa dilihat setelah lowongan tutup.
 *
 * A job not open to this student reads as missing, unless they already applied:
 * an older application stays viewable after the job closes.
 */
export async function getJobForStudent(actor: Actor, id: string, now: Date) {
  const [jSnap, aSnap] = await Promise.all([
    db().collection('jobs').doc(id).get(),
    db().collection('jobApplications').doc(`${id}_${actor.uid}`).get(),
  ]);
  if (!jSnap.exists) return null;
  const job = { ...(jSnap.data() as Job), id };
  const application = aSnap.exists ? { status: aSnap.get('status') as ApplicationStatus, number: aSnap.get('number') as string } : null;
  if (!application && (job.status !== 'published' || !isOpenToStudents(job, now) || !(await eligibilityCheck(actor)(job)))) return null;
  const [partner, open, standing] = await Promise.all([publicPartner(job.partnerId), canSubmitNow(actor), myCareerStanding(actor)]);
  // Alasan tidak bisa melamar, mis. sudah ditempatkan atau kuota penuh; null berarti boleh
  // Why the participant cannot apply, e.g. already placed or quota full; null means they may
  return partner ? { job, partner, application, applicationsOpen: open, blocked: application ? null : applyBlock(standing) } : null;
}

export async function getPartnerProfile(actor: Actor, id: string, now: Date) {
  const partner = await publicPartner(id);
  return partner ? { partner, jobs: await visibleCards(actor, now, id) } : null;
}

export async function getApplyContext(actor: Actor, jobId: string, now: Date) {
  const found = await getJobForStudent(actor, jobId, now);
  if (found?.application) throw new Error('Kamu sudah melamar lowongan ini');
  if (!found) throw new Error('Lowongan tidak bisa dilamar');
  if (!found.applicationsOpen) throw new Error(CLOSED_MESSAGE);
  const blocked = applyBlock(await myCareerStanding(actor));
  if (blocked) throw new Error(blocked);
  const uid = actor.uid;
  const [user, profile, career, cls, worksSnap, subsSnap, cvs, covers] = await Promise.all([
    db().collection('users').doc(uid).get(),
    db().collection('studentProfiles').doc(uid).get(),
    db().collection('careerProfiles').doc(uid).get(),
    actor.classId ? db().collection('classes').doc(actor.classId).get() : null,
    ownWorks(uid),
    ownTasks(uid),
    listCvs(uid, 'cv'),
    listCvs(uid, 'surat'),
  ]);
  const c = (career.data() ?? {}) as Partial<Personal>;
  const personal: Personal = {
    fullName: String(user.get('name') ?? ''), email: String(user.get('email') ?? ''), phone: String(profile.get('phone') ?? ''),
    city: c.city ?? '', school: c.school ?? '', major: c.major ?? '', linkedin: c.linkedin ?? '',
  };
  return {
    job: found.job, partner: found.partner, personal, className: String(cls?.get('canonicalName') ?? ''),
    cvs: cvs as CvFile[], covers: covers as CvFile[], works: worksSnap, tasks: subsSnap,
  };
}

export async function ownWorks(uid: string): Promise<AttachedWork[]> {
  const snap = await db().collection('exhibitionWorks').where('personUid', '==', uid).where('status', '==', 'published').select('title', 'type', 'cover.thumb').get();
  return snap.docs.map((w) => ({ id: w.id, title: String(w.get('title') ?? ''), type: String(w.get('type') ?? ''), cover: String(w.get('cover.thumb') ?? '') }));
}

/**
 * Hanya pengumpulan yang bisa dibuka peninjau: berkas yang benar-benar tersimpan, atau tautan. Berkas lama
 * yang hilang ("local-file-") ditolak oleh rute berkas, jadi tidak ditawarkan sebagai lampiran.
 *
 * Only submissions a reviewer can open: a file actually stored, or a link. Old lost files ("local-file-")
 * are refused by the file route, so they are not offered as attachments.
 */
export async function ownTasks(uid: string): Promise<AttachedTask[]> {
  const snap = await db().collection('submissions').where('studentId', '==', uid).select('taskTitle', 'taskKind', 'fileId', 'url').get();
  return snap.docs
    // Tautan non-http(s) dari data lama dibuang agar tidak menjadi href berbahaya di halaman peninjau
    // Non-http(s) links from older data are dropped so they never become a dangerous href on the reviewer's page
    .filter((s) => isStoredSubmissionFile(s.get('fileId')) || safeExternalUrl(String(s.get('url') ?? '')))
    .map((s) => ({
      submissionId: s.id, title: String(s.get('taskTitle') ?? 'Tugas'), kind: String(s.get('taskKind') ?? ''),
      url: isStoredSubmissionFile(s.get('fileId')) ? '' : String(s.get('url')),
    }));
}

// Id acara kalender hanya untuk server / The calendar event id is server-only
function publicInterview({ calendarEventId: _c, ...rest }: Interview): Omit<Interview, 'calendarEventId'> {
  return rest;
}

export async function listMyApplications(uid: string): Promise<MyApplication[]> {
  const [aSnap, jSnap] = await Promise.all([
    db().collection('jobApplications').where('studentId', '==', uid).select('jobId', 'partnerId', 'number', 'status', 'scheme', 'completedAt', 'submittedAt', 'interview', 'personal.fullName').get(),
    db().collection('jobs').select('title', 'partnerName', 'picEmail').get(),
  ]);
  const jobs = new Map(jSnap.docs.map((j) => [j.id, { title: j.get('title') as string, partnerName: j.get('partnerName') as string, picEmail: String(j.get('picEmail') ?? '') }]));
  // Undangan lama belum menyimpan kontak PIC: dipakai PIC lowongannya / Older invites lack a PIC contact: the job's PIC is used
  const needPics = [...new Set(aSnap.docs.filter((a) => a.get('status') === 'interview' && !a.get('interview.contact')).map((a) => String(a.get('partnerId'))))];
  const partnerPics = new Map(await Promise.all(needPics.map(async (id) => {
    const p = await db().collection('partners').doc(id).get();
    return [id, (p.get('pics') ?? []) as PicContact[]] as const;
  })));
  return aSnap.docs
    .map((a) => {
      const status = a.get('status') as ApplicationStatus;
      const j = jobs.get(a.get('jobId'));
      const raw = status === 'interview' ? (a.get('interview') as Interview | undefined) : undefined;
      const pic = raw ? raw.contact ?? jobPic(partnerPics.get(String(a.get('partnerId'))) ?? [], j?.picEmail) : null;
      const contact = pic ? { name: pic.name, email: pic.email, phone: pic.phone ?? '' } : undefined;
      return {
        id: a.id, jobId: a.get('jobId') as string, number: String(a.get('number') ?? ''), jobTitle: j?.title ?? 'Lowongan', partnerName: j?.partnerName ?? '',
        scheme: (a.get('scheme') as Job['scheme'] | undefined) ?? 'full', status, statusLabel: a.get('completedAt') ? 'Proyek selesai' : status === 'bergabung' && a.get('scheme') === 'project' ? 'Proyek berjalan' : studentStatusLabel(status), submittedAt: String(a.get('submittedAt') ?? ''),
        message: status === 'tidak-lolos' ? REJECT_MESSAGE : status === 'ditutup' ? CLOSED_ELSEWHERE_MESSAGE : null,
        interview: raw ? { ...publicInterview(raw), contact } : null,
        picWaLink: raw && contact ? whatsAppLink(contact.phone, rescheduleMessage({
          picName: contact.name, studentName: String(a.get('personal.fullName') ?? ''), jobTitle: j?.title ?? 'Lowongan', partnerName: j?.partnerName ?? '', interview: raw,
        })) : null,
      };
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
