/**
 * Tawaran magang setelah PIC meloloskan kandidat: jawaban siswa, penutupan
 * lamaran lain, dan pengingat di aplikasi siswa.
 *
 * Satu peserta hanya boleh menempati satu tempat magang. Begitu ia menerima
 * satu tawaran, semua lamaran lain yang masih berjalan ditutup, termasuk yang
 * sudah dijadwalkan interview, dan undangan Calendar-nya dibatalkan.
 *
 * Internship offers after a PIC passes a candidate: the student's answer, the
 * closing of other applications, and reminders in the student app.
 *
 * One participant may take only one internship place. Once they accept an
 * offer, every other application still running is closed, interviews already
 * scheduled included, and their Calendar invites are cancelled.
 */
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import { cancelCalendarEvent } from '../calendar/client';
import { isOpenApplication, PLACEMENT_COLLECTION, type ApplicationStatus, type Interview } from './model';
import { ownApplication, type PartnerActor } from './partner-service';
import { CAREER_APP_FIELDS, standingInputs } from './student-service';
import { PROJECT_QUOTA_MESSAGE, projectsOngoing, TIER_RULES, type CareerApp } from './tier';

const apps = () => getAdminDb().collection('jobApplications');

export async function respondOffer(actor: Actor, appId: string, response: unknown, now: Date): Promise<void> {
  if (response !== 'terima' && response !== 'tolak') throw new Error('Jawaban tidak dikenal');
  const ref = apps().doc(appId);
  const t = now.toISOString();
  const { tier } = await standingInputs(actor);
  let jobId = '';
  // Dalam satu transaksi: dua klik "terima" yang bersamaan tidak bisa sama-sama lolos
  // In one transaction: two simultaneous "terima" clicks cannot both succeed
  const others = await getAdminDb().runTransaction(async (tx) => {
    const [snap, mine] = await Promise.all([tx.get(ref), tx.get(apps().where('studentId', '==', actor.uid).select(...CAREER_APP_FIELDS, 'interview.calendarEventId'))]);
    if (!snap.exists || snap.get('studentId') !== actor.uid) throw new Error('Lamaran tidak ditemukan');
    if (snap.get('status') !== 'diterima') throw new Error('Belum ada tawaran untuk lamaran ini');
    jobId = String(snap.get('jobId'));
    if (response === 'tolak') {
      tx.update(ref, { status: 'menolak', statusChangedAt: t, updatedAt: t });
      return [];
    }
    const rest = mine.docs.filter((d) => d.id !== appId);
    const isProject = snap.get('scheme') === 'project';
    const joined = rest.filter((d) => d.get('status') === 'bergabung');
    // Full Internship: satu tempat saja. Proyek: boleh beberapa selama jatah tier masih ada
    // Full Internship: one place only. Projects: several allowed while the tier's slots last
    if (joined.some((d) => (d.get('scheme') ?? 'full') === 'full') || (!isProject && joined.length > 0)) throw new Error('Kamu sudah menerima tawaran magang lain');
    if (isProject && projectsOngoing(rest.map((d) => d.data() as CareerApp)) >= TIER_RULES[tier].project.quota) throw new Error(PROJECT_QUOTA_MESSAGE);
    // Menerima proyek hanya menutup lamaran Full Internship; lamaran proyek lain tetap berjalan
    // Accepting a project closes only Full Internship applications; other project applications keep running
    const open = rest.filter((d) => isOpenApplication(d.get('status') as ApplicationStatus) && (!isProject || (d.get('scheme') ?? 'full') === 'full'));
    tx.update(ref, { status: 'bergabung', statusChangedAt: t, updatedAt: t });
    for (const d of open) {
      tx.update(d.ref, { status: 'ditutup', statusChangedAt: t, updatedAt: t, ...(d.get('interview.calendarEventId') ? { 'interview.calendarEventId': null } : {}) });
    }
    return open;
  });
  // Undangan Calendar dibatalkan setelah status tersimpan: kegagalan membatalkan tidak membuka kembali lamarannya
  // Calendar invites are cancelled after the status is saved: a failed cancel does not reopen the application
  for (const d of others) {
    const ev = d.get('interview.calendarEventId') as string | null;
    if (ev) await cancelCalendarEvent(ev).catch((e) => console.error('[karier] batal interview lamaran yang ditutup', e));
  }
  // Penolakan otomatis tidak boleh menggagalkan jawaban yang sudah tersimpan / The automatic rejection must not fail an answer already saved
  if (response === 'terima') await rejectWhenFull(jobId, now).catch((e) => console.error('[karier] tolak otomatis kuota penuh', e));
}

const STILL_OPEN: ApplicationStatus[] = ['baru', 'ditinjau', 'shortlist', 'interview'];
export const FULL_QUOTA_REASON = 'Kuota sudah terpenuhi';

/**
 * Begitu kursi lowongan habis oleh peserta yang menerima tawaran atau ditempatkan,
 * lamaran lain yang masih terbuka ditandai tidak lolos agar jatah lamaran pelamarnya
 * kembali. Kandidat yang lolos dan masih menunggu jawaban dibiarkan sebagai cadangan.
 *
 * Once a job's seats are taken by participants who accepted or were placed, other
 * applications still open are rejected so their applicants get their application
 * quota back. Passed candidates still awaiting an answer are kept as backups.
 */
export async function rejectWhenFull(jobId: string, now: Date): Promise<number> {
  const db = getAdminDb();
  const [job, rows, placed] = await Promise.all([
    db.collection('jobs').doc(jobId).get(),
    apps().where('jobId', '==', jobId).select('status', 'interview.calendarEventId', 'interview.date').get(),
    db.collection(PLACEMENT_COLLECTION).where('jobId', '==', jobId).select('jobId').get(),
  ]);
  const taken = rows.docs.filter((d) => d.get('status') === 'bergabung').length + placed.size;
  if (!job.exists || taken < Number(job.get('quota'))) return 0;
  const open = rows.docs.filter((d) => STILL_OPEN.includes(d.get('status')));
  if (open.length === 0) return 0;
  const t = now.toISOString();
  const today = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
  const batch = db.batch();
  for (const d of open) {
    batch.update(d.ref, { status: 'tidak-lolos', rejectReason: FULL_QUOTA_REASON, statusChangedAt: t, updatedAt: t, ...(d.get('interview.calendarEventId') ? { 'interview.calendarEventId': null } : {}) });
  }
  await batch.commit();
  // Interview yang sudah lewat tidak perlu dibatalkan; kandidat tidak perlu menerima email pembatalan
  // Past interviews need no cancelling; candidates need not receive a cancellation email
  for (const d of open) {
    const ev = d.get('interview.calendarEventId') as string | null | undefined;
    if (ev && String(d.get('interview.date') ?? '') >= today) await cancelCalendarEvent(ev).catch((e) => console.error('[karier] batal interview kuota penuh', e));
  }
  return open.length;
}

/**
 * Admin atau PIC mitranya menandai proyek selesai; jatah proyek peserta kembali satu.
 *
 * An admin or the partner's PIC marks a project as finished; the participant gets one project slot back.
 */
export async function markProjectDone(appId: string, now: Date, pic?: PartnerActor): Promise<void> {
  const snap = pic ? await ownApplication(pic, appId) : await apps().doc(appId).get();
  if (!snap.exists) throw new Error('Lamaran tidak ditemukan');
  if (snap.get('status') !== 'bergabung' || snap.get('scheme') !== 'project' || snap.get('completedAt')) throw new Error('Hanya proyek yang sedang berjalan yang bisa ditandai selesai');
  await snap.ref.update({ completedAt: now.toISOString(), updatedAt: now.toISOString() });
}

/** PIC menandai kandidat lolos sudah dihubungi / The PIC marks a passed candidate as contacted */
export async function markContacted(actor: PartnerActor, appId: string, now: Date): Promise<void> {
  const snap = await ownApplication(actor, appId);
  await snap.ref.update({ contactedAt: now.toISOString() });
}

export interface CareerReminder { appId: string; kind: 'interview' | 'tawaran'; jobTitle: string; partnerName: string }

/**
 * Hal yang menunggu jawaban siswa: undangan interview yang belum dikonfirmasi dan tawaran yang belum dijawab.
 *
 * What awaits the student's answer: interview invites not yet confirmed and offers not yet answered.
 */
export async function careerReminders(uid: string): Promise<CareerReminder[]> {
  const snap = await apps().where('studentId', '==', uid).select('jobId', 'status', 'interview.confirmation').get();
  const due = snap.docs
    .map((d) => ({ d, status: d.get('status') as ApplicationStatus, confirmation: (d.get('interview') as Partial<Interview> | undefined)?.confirmation }))
    .filter((x) => x.status === 'diterima' || (x.status === 'interview' && x.confirmation === 'pending'));
  if (due.length === 0) return [];
  const jobs = await Promise.all(due.map((x) => getAdminDb().collection('jobs').doc(String(x.d.get('jobId'))).get()));
  return due
    .map((x, i) => ({
      appId: x.d.id, kind: x.status === 'diterima' ? 'tawaran' as const : 'interview' as const,
      jobTitle: String(jobs[i].get('title') ?? 'Lowongan'), partnerName: String(jobs[i].get('partnerName') ?? ''),
    }))
    .sort((a, b) => (a.kind === b.kind ? a.appId.localeCompare(b.appId) : a.kind === 'tawaran' ? -1 : 1));
}
