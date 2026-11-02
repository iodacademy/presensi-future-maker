/**
 * Bacaan Job Portal untuk siswa: lowongan yang boleh dilihat, profil mitra,
 * konteks formulir lamaran, dan lamaran milik sendiri.
 *
 * Job Portal reads for students: the jobs they may see, partner profiles, the
 * application form context, and their own applications.
 */
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import { isStoredSubmissionFile } from '../tasks/submission-policy';
import { listCvs } from './cv-service';
import {
  isEligible, isOpenToStudents, REJECT_MESSAGE, studentStatusLabel,
  type ApplicationStatus, type AttachedTask, type AttachedWork, type CvFile, type Eligibility, type Job, type Logo, type Personal, type Socials,
} from './model';

export interface StudentJobCard {
  id: string; title: string; partnerId: string; partnerName: string; employment: Job['employment']; category: Job['category'];
  location: string; workMode: Job['workMode']; quota: number; opensAt: string; closesAt: string; applicantCount: number; logo: string | null;
}
export interface PublicPartner { id: string; name: string; field: string; about: string; logo: Logo | null; website: string; socials: Socials }
export interface MyApplication {
  id: string; jobId: string; number: string; jobTitle: string; partnerName: string;
  status: ApplicationStatus; statusLabel: string; submittedAt: string; message: string | null;
}
export interface FinalScore { finalScore: number | null; finalScorePending: boolean; finalScoreAt: string | null }

const db = () => getAdminDb();
const CARD_FIELDS = ['title', 'partnerId', 'partnerName', 'employment', 'category', 'location', 'workMode', 'quota', 'opensAt', 'closesAt', 'status', 'applicantCount', 'eligibility'];

/**
 * Nilai akhir dari ringkasan dashboard terbaru. Ringkasan dibangun ulang saat
 * admin membuka dashboard, jadi tanggalnya ikut disimpan agar umurnya terlihat.
 *
 * The final score from the latest dashboard snapshot. Snapshots are rebuilt when
 * an admin opens the dashboard, so its date is kept to show how old it is.
 */
export async function latestFinalScore(uid: string): Promise<FinalScore> {
  // generatedAt adalah medan biasa, jadi urutan menurunnya memakai indeks bawaan; tidak perlu indeks khusus
  // generatedAt is a plain field, so its descending order uses the built-in index; no dedicated index needed
  const snap = await db().collection('dashboardSnapshots').orderBy('generatedAt', 'desc').limit(1).select('ranking', 'version').get();
  const doc = snap.docs[0];
  if (!doc) return { finalScore: null, finalScorePending: false, finalScoreAt: null };
  const row = ((doc.get('ranking') ?? []) as { studentId: string; score: number; pending?: string[] }[]).find((r) => r.studentId === uid);
  // Ringkasan sebelum versi 17 tidak mencatat komponen tertunda, jadi nilainya belum bisa disebut final
  // Snapshots before version 17 do not record pending components, so their score cannot be called final
  const unknown = Number(doc.get('version') ?? 1) < 17;
  return { finalScore: row?.score ?? null, finalScorePending: !!row && (unknown || (row.pending?.length ?? 0) > 0), finalScoreAt: doc.id };
}

async function appliedJobIds(uid: string): Promise<Set<string>> {
  const snap = await db().collection('jobApplications').where('studentId', '==', uid).select('jobId').get();
  return new Set(snap.docs.map((d) => d.get('jobId') as string));
}

// Nilai akhir hanya dibaca bila ada lowongan bersyarat nilai / The final score is read only when a job requires one
function eligibilityCheck(actor: Actor) {
  let score: Promise<FinalScore> | null = null;
  return async (e: Eligibility) => {
    if (e.mode !== 'min-score') return isEligible(e, { classId: actor.classId, finalScore: null });
    score ??= latestFinalScore(actor.uid);
    return isEligible(e, { classId: actor.classId, finalScore: (await score).finalScore });
  };
}

async function visibleCards(actor: Actor, now: Date, partnerId?: string): Promise<StudentJobCard[]> {
  let q = db().collection('jobs').where('status', '==', 'published');
  if (partnerId) q = q.where('partnerId', '==', partnerId);
  const [jSnap, pSnap] = await Promise.all([q.select(...CARD_FIELDS).get(), db().collection('partners').select('logo.thumb').get()]);
  const logos = new Map(pSnap.docs.map((p) => [p.id, (p.get('logo.thumb') as string) || null]));
  const eligible = eligibilityCheck(actor);
  const cards: StudentJobCard[] = [];
  for (const j of jSnap.docs) {
    const d = j.data() as Job;
    if (!isOpenToStudents(d, now) || !(await eligible(d.eligibility))) continue;
    cards.push({
      id: j.id, title: d.title, partnerId: d.partnerId, partnerName: d.partnerName, employment: d.employment, category: d.category,
      location: d.location, workMode: d.workMode, quota: d.quota, opensAt: d.opensAt, closesAt: d.closesAt,
      applicantCount: d.applicantCount ?? 0, logo: logos.get(d.partnerId) ?? null,
    });
  }
  return cards.sort((a, b) => a.closesAt.localeCompare(b.closesAt));
}

export async function listOpenJobs(actor: Actor, now: Date) {
  const [jobs, applied] = await Promise.all([visibleCards(actor, now), appliedJobIds(actor.uid)]);
  const bannerClosesAt = jobs.reduce<string | null>((max, j) => (!max || j.closesAt > max ? j.closesAt : max), null);
  return { jobs, appliedJobIds: jobs.filter((j) => applied.has(j.id)).map((j) => j.id), bannerClosesAt };
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
  if (!application && (job.status !== 'published' || !isOpenToStudents(job, now) || !(await eligibilityCheck(actor)(job.eligibility)))) return null;
  const partner = await publicPartner(job.partnerId);
  return partner ? { job, partner, application } : null;
}

export async function getPartnerProfile(actor: Actor, id: string, now: Date) {
  const partner = await publicPartner(id);
  return partner ? { partner, jobs: await visibleCards(actor, now, id) } : null;
}

export async function getApplyContext(actor: Actor, jobId: string, now: Date) {
  const found = await getJobForStudent(actor, jobId, now);
  if (found?.application) throw new Error('Kamu sudah melamar lowongan ini');
  if (!found) throw new Error('Lowongan tidak bisa dilamar');
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
    .filter((s) => isStoredSubmissionFile(s.get('fileId')) || s.get('url'))
    .map((s) => ({
      submissionId: s.id, title: String(s.get('taskTitle') ?? 'Tugas'), kind: String(s.get('taskKind') ?? ''),
      url: isStoredSubmissionFile(s.get('fileId')) ? '' : String(s.get('url')),
    }));
}

export async function listMyApplications(uid: string): Promise<MyApplication[]> {
  const [aSnap, jSnap] = await Promise.all([
    db().collection('jobApplications').where('studentId', '==', uid).select('jobId', 'number', 'status', 'submittedAt').get(),
    db().collection('jobs').select('title', 'partnerName').get(),
  ]);
  const jobs = new Map(jSnap.docs.map((j) => [j.id, { title: j.get('title') as string, partnerName: j.get('partnerName') as string }]));
  return aSnap.docs
    .map((a) => {
      const status = a.get('status') as ApplicationStatus;
      const j = jobs.get(a.get('jobId'));
      return {
        id: a.id, jobId: a.get('jobId') as string, number: String(a.get('number') ?? ''), jobTitle: j?.title ?? 'Lowongan', partnerName: j?.partnerName ?? '',
        status, statusLabel: studentStatusLabel(status), submittedAt: String(a.get('submittedAt') ?? ''),
        message: status === 'tidak-lolos' ? REJECT_MESSAGE : null,
      };
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
