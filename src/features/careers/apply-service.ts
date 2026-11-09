/**
 * Mengirim lamaran. Kepemilikan lampiran diperiksa di server dari data siswa
 * sendiri; status lowongan, lamaran ganda, nomor lamaran, dan jumlah pelamar
 * diputuskan dalam satu transaksi agar dua tab yang mengirim bersamaan tidak
 * menghasilkan dua lamaran.
 *
 * Submits an application. Attachment ownership is checked on the server against
 * the student's own data; the job's state, duplicate applications, the number,
 * and the applicant count are settled in one transaction so two tabs submitting
 * at once cannot produce two applications.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import { CLOSED_MESSAGE } from './apply-gate';
import { listCvs } from './cv-service';
import { canApplyScheme, formatApplicationNumber, isEligible, isOpenToStudents, validateApplicationInput, type Job } from './model';
import { canSubmitNow, latestFinalScore, latestPlacement, ownTasks, ownWorks } from './student-service';

export async function submitApplication(actor: Actor, raw: unknown, now: Date): Promise<{ id: string; number: string }> {
  const jobId = String((raw as { jobId?: unknown })?.jobId ?? '');
  if (!jobId) throw new Error('Lowongan tidak ditemukan');
  if (!(await canSubmitNow(actor))) throw new Error(CLOSED_MESSAGE);
  const db = getAdminDb();
  const [cvs, covers, works, tasks, score, placement] = await Promise.all([
    listCvs(actor.uid, 'cv'), listCvs(actor.uid, 'surat'), ownWorks(actor.uid), ownTasks(actor.uid), latestFinalScore(actor.uid), latestPlacement(actor.uid, actor.classId),
  ]);
  // Satu peserta satu tempat magang / One participant, one internship place
  const mine = await db.collection('jobApplications').where('studentId', '==', actor.uid).select('status').get();
  if (mine.docs.some((d) => d.get('status') === 'bergabung')) throw new Error('Kamu sudah menerima tawaran magang, jadi tidak bisa melamar lagi');
  const jobRef = db.collection('jobs').doc(jobId);
  const appRef = db.collection('jobApplications').doc(`${jobId}_${actor.uid}`);
  const counterRef = db.collection('counters').doc('jobApplications');

  const result = await db.runTransaction(async (tx) => {
    const [jobSnap, appSnap, counterSnap] = await Promise.all([tx.get(jobRef), tx.get(appRef), tx.get(counterRef)]);
    if (!jobSnap.exists) throw new Error('Lowongan tidak ditemukan');
    const job = jobSnap.data() as Job;
    if (!isOpenToStudents(job, now)) throw new Error('Lowongan sudah ditutup');
    if (!canApplyScheme(placement, job.scheme) || !isEligible(job.eligibility, { classId: actor.classId, finalScore: score.finalScore })) {
      throw new Error('Kamu belum memenuhi syarat lowongan ini');
    }
    if (appSnap.exists) throw new Error('Kamu sudah melamar lowongan ini');

    const input = validateApplicationInput(raw, job, {
      cvIds: new Set(cvs.map((c) => c.id)), coverIds: new Set(covers.map((c) => c.id)),
      workIds: new Set(works.map((w) => w.id)), submissionIds: new Set(tasks.map((t) => t.submissionId)),
    });
    const next = Number(counterSnap.exists ? counterSnap.get('next') ?? 0 : 0) + 1;
    const number = formatApplicationNumber(next);
    const t = now.toISOString();
    tx.set(appRef, {
      jobId, partnerId: job.partnerId, studentId: actor.uid, classId: actor.classId ?? '', number,
      personal: input.personal, cvId: input.cvId, cvFileName: cvs.find((c) => c.id === input.cvId)!.fileName,
      coverLetterId: input.coverLetterId, portfolioUrl: input.portfolioUrl,
      // Salinan judul dan sampul saat melamar, agar lamaran tetap utuh bila karyanya diubah kemudian
      // Title and cover copied at apply time, so the application stays whole if the work changes later
      works: works.filter((w) => input.workIds.includes(w.id)),
      tasks: tasks.filter((x) => input.submissionIds.includes(x.submissionId)),
      answers: input.answers, ...score,
      status: 'baru', rejectReason: '', submittedAt: t, updatedAt: t, statusChangedAt: t,
    });
    tx.update(jobRef, { applicantCount: FieldValue.increment(1) });
    tx.set(counterRef, { next }, { merge: true });
    return { id: appRef.id, number, personal: input.personal };
  });

  const { city, school, major, linkedin } = result.personal;
  await db.collection('careerProfiles').doc(actor.uid).set({ city, school, major, linkedin, updatedAt: now.toISOString() });
  return { id: result.id, number: result.number };
}
