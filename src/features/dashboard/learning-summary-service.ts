import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import { careerApplyUntil, latestSummaryRow, myInternshipPlacement } from '../careers/student-service';
import { buildLearningSummary, type LearningSummary } from './learning-summary';

/**
 * Ringkasan belajar satu siswa untuk beranda. Lamaran dibaca tanpa isian
 * panjangnya: cukup status dan jadwal interview.
 *
 * One student's learning summary for the home page. Applications are read
 * without their long fields: only the status and interview time.
 */
export async function learningSummaryFor(actor: Pick<Actor, 'uid' | 'classId'>): Promise<LearningSummary | null> {
  const db = getAdminDb();
  const [row, placedAt, appsSnap, applyUntil] = await Promise.all([
    latestSummaryRow(actor.uid, actor.classId),
    myInternshipPlacement(actor.uid),
    db.collection('jobApplications').where('studentId', '==', actor.uid).select('jobId', 'status', 'interview.date', 'interview.start').get(),
    careerApplyUntil(),
  ]);
  if (!row) return null;
  const apps = appsSnap.docs.map((a) => ({
    jobId: String(a.get('jobId')), status: String(a.get('status')),
    interview: a.get('interview.date') ? { date: String(a.get('interview.date')), start: String(a.get('interview.start') ?? '') } : null,
  }));
  // Tawaran yang diterima lewat Portal Karier juga berarti sudah ditempatkan / An offer accepted through the career portal also means placed
  let internship = placedAt;
  const joined = apps.find((a) => a.status === 'bergabung');
  if (!internship && joined) {
    const job = await db.collection('jobs').doc(joined.jobId).get();
    if (job.exists) internship = { partnerName: String(job.get('partnerName') ?? ''), position: String(job.get('title') ?? '') };
  }
  return buildLearningSummary({ row, placedAt: internship, apps, applyUntil });
}
