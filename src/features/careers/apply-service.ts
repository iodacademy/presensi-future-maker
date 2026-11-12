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
import { formatApplicationNumber, isEligible, isOpenToStudents, validateApplicationInput, type Job } from './model';
import { CAREER_APP_FIELDS, canSubmitNow, ownTasks, ownWorks, standingInputs } from './student-service';
import { applyBlock, canSeeJob, LOCKED_MESSAGE, type CareerApp } from './tier';

export async function submitApplication(actor: Actor, raw: unknown, now: Date): Promise<{ id: string; number: string }> {
  const jobId = String((raw as { jobId?: unknown })?.jobId ?? '');
  if (!jobId) throw new Error('Lowongan tidak ditemukan');
  if (!(await canSubmitNow(actor))) throw new Error(CLOSED_MESSAGE);
  const db = getAdminDb();
  const [cvs, covers, works, tasks, inputs] = await Promise.all([
    listCvs(actor.uid, 'cv'), listCvs(actor.uid, 'surat'), ownWorks(actor.uid), ownTasks(actor.uid), standingInputs(actor),
  ]);
  const { score } = inputs;
  const jobRef = db.collection('jobs').doc(jobId);
  const appRef = db.collection('jobApplications').doc(`${jobId}_${actor.uid}`);
  const counterRef = db.collection('counters').doc('jobApplications');
  const mineQuery = db.collection('jobApplications').where('studentId', '==', actor.uid).select(...CAREER_APP_FIELDS);

  const result = await db.runTransaction(async (tx) => {
    // Lamaran sendiri dibaca di dalam transaksi agar dua tab tidak bisa melewati kuota bersamaan
    // Own applications are read inside the transaction so two tabs cannot exceed the quota at once
    const [jobSnap, appSnap, counterSnap, mine] = await Promise.all([tx.get(jobRef), tx.get(appRef), tx.get(counterRef), tx.get(mineQuery)]);
    const standing = inputs.standing(mine.docs.map((d) => d.data() as CareerApp));
    if (standing.locked) throw new Error(applyBlock(standing) ?? LOCKED_MESSAGE);
    if (!jobSnap.exists) throw new Error('Lowongan tidak ditemukan');
    const job = jobSnap.data() as Job;
    if (!isOpenToStudents(job, now)) throw new Error('Lowongan sudah ditutup');
    if (!canSeeJob(standing, job) || !isEligible(job.eligibility, { classId: actor.classId, finalScore: score.finalScore })) {
      throw new Error('Kamu belum memenuhi syarat lowongan ini');
    }
    if (appSnap.exists) throw new Error('Kamu sudah melamar lowongan ini');
    const blocked = applyBlock(standing);
    if (blocked) throw new Error(blocked);

    const input = validateApplicationInput(raw, job, {
      cvIds: new Set(cvs.map((c) => c.id)), coverIds: new Set(covers.map((c) => c.id)),
      workIds: new Set(works.map((w) => w.id)), submissionIds: new Set(tasks.map((t) => t.submissionId)),
    });
    const next = Number(counterSnap.exists ? counterSnap.get('next') ?? 0 : 0) + 1;
    const number = formatApplicationNumber(next);
    const t = now.toISOString();
    tx.set(appRef, {
      jobId, partnerId: job.partnerId, scheme: job.scheme, studentId: actor.uid, classId: actor.classId ?? '', number,
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
