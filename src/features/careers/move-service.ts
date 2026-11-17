/**
 * Memindahkan lamaran ke lowongan lain. PIC hanya boleh ke lowongan perusahaannya
 * sendiri; admin boleh ke perusahaan mana pun dan sekaligus meloloskan kandidat.
 * Aturan program (skema, batas nilai tier, jurusan, kuota) berlaku untuk keduanya.
 *
 * Moves an application to another job. A PIC may only target their own company's
 * jobs; an admin may target any company and pass the candidate in the same step.
 * Programme rules (scheme, tier value cap, programme, quota) apply to both.
 */
import { FieldValue, type DocumentSnapshot } from 'firebase-admin/firestore';
import { getAdminDb } from '../../lib/firebase/admin';
import { cancelCalendarEvent } from '../calendar/client';
import { canApplyScheme, isEligible, type ApplicationStatus, type Job } from './model';
import { CAREER_APP_FIELDS, standingInputs } from './student-service';
import { applyBlock, canSeeJob, type CareerApp } from './tier';

const db = () => getAdminDb();

// Tawaran yang menunggu jawaban dan status final tidak dialihkan / Offers awaiting an answer and final statuses are not moved
export const MOVABLE: ApplicationStatus[] = ['baru', 'ditinjau', 'shortlist', 'interview', 'tidak-lolos'];

export async function moveApplication(first: DocumentSnapshot, targetJobId: unknown, opts: { partnerId?: string; pass?: boolean }): Promise<void> {
  const target = String(targetJobId ?? '');
  const studentId = String(first.get('studentId'));
  const classId = (first.get('classId') as string | undefined) ?? null;
  const inputs = await standingInputs({ uid: studentId, classId });
  const jobRef = db().collection('jobs').doc(target || '-');
  const mineQuery = db().collection('jobApplications').where('studentId', '==', studentId).select(...CAREER_APP_FIELDS);
  let staleEvent: string | null = null;

  // Semua pemeriksaan dibaca ulang di dalam transaksi, agar dua aksi bersamaan tidak sama-sama lolos
  // Every check is re-read inside the transaction, so two simultaneous actions cannot both pass
  await db().runTransaction(async (tx) => {
    const [cur, tj, mine] = await Promise.all([tx.get(first.ref), tx.get(jobRef), tx.get(mineQuery)]);
    const status = cur.get('status') as ApplicationStatus;
    const fromId = String(cur.get('jobId'));
    if (!MOVABLE.includes(status)) throw new Error('Lamaran ini tidak bisa dialihkan');
    if (!tj.exists || (opts.partnerId && tj.get('partnerId') !== opts.partnerId) || tj.get('status') !== 'published' || target === fromId) throw new Error('Lowongan tidak ditemukan');
    if (mine.docs.some((d) => d.id !== cur.id && d.get('jobId') === target)) throw new Error('Kandidat sudah melamar posisi itu');

    const job = tj.data() as Job;
    const standing = inputs.standing(mine.docs.map((d) => d.data() as CareerApp));
    if (standing.locked) throw new Error('Kandidat sudah menerima tawaran magang di tempat lain');
    if (!canApplyScheme(standing.track, job.scheme ?? 'full')) {
      throw new Error(standing.track === 'project' ? 'Kandidat jalur Project Based tidak bisa ditawari Full Internship' : 'Kandidat tidak memenuhi skema posisi itu');
    }
    if (!canSeeJob(standing, { scheme: job.scheme ?? 'full', salary: job.salary })) throw new Error('Nilai posisi itu melebihi batas tier kandidat');
    if (!isEligible(job.eligibility ?? { mode: 'all' }, { classId, finalScore: inputs.score.finalScore })) throw new Error('Kandidat tidak memenuhi syarat lowongan itu');
    // Lamaran yang dihidupkan lagi kembali memakai kuota / A revived application uses a quota slot again
    if (status === 'tidak-lolos' && applyBlock(standing)) throw new Error('Jatah lamaran kandidat sedang penuh, jadi lamaran ini tidak bisa dihidupkan lagi');

    const from = await tx.get(db().collection('jobs').doc(fromId));
    const t = new Date().toISOString();
    const otherCompany = job.partnerId !== cur.get('partnerId');
    // Interview di perusahaan awal tidak berlaku di perusahaan tujuan / An interview at the original company does not carry over to the target company
    if (otherCompany) staleEvent = (cur.get('interview.calendarEventId') as string | null | undefined) ?? null;
    const next: ApplicationStatus | null = opts.pass ? 'diterima' : otherCompany || status === 'tidak-lolos' ? 'ditinjau' : null;
    tx.update(cur.ref, {
      jobId: target, partnerId: job.partnerId, scheme: job.scheme ?? 'full',
      // Posisi yang pertama dilamar tetap tercatat walau dialihkan berkali-kali / The first position applied for stays recorded through repeated moves
      offeredFrom: cur.get('offeredFrom') ?? { jobId: fromId, title: String(from.get('title') ?? ''), ...(otherCompany ? { partnerName: String(from.get('partnerName') ?? '') } : {}) },
      ...(next ? { status: next, rejectReason: '', statusChangedAt: t } : {}),
      ...(otherCompany ? { interview: null } : {}),
      updatedAt: t,
    });
    tx.update(from.ref, { applicantCount: FieldValue.increment(-1) });
    tx.update(jobRef, { applicantCount: FieldValue.increment(1) });
  });
  if (staleEvent) await cancelCalendarEvent(staleEvent).catch((e) => console.error('[karier] batal acara interview', e));
}

/** Admin: pindahkan ke lowongan mana pun, opsional sekaligus loloskan / Admin: move to any job, optionally passing the candidate too */
export async function adminMoveApplication(appId: string, targetJobId: unknown, pass: unknown): Promise<void> {
  const first = await db().collection('jobApplications').doc(appId).get();
  if (!first.exists) throw new Error('Lamaran tidak ditemukan');
  await moveApplication(first, targetJobId, { pass: pass === true });
}
