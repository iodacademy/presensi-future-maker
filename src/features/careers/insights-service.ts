import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import { getSnapshot } from '../dashboard/snapshot-service';
import type { InsightApp, InsightJob, InsightStudent, PortalInsights } from './insights';
import { DEMO_CLASS_ID, jobPic, type ApplicationStatus, type Eligibility, type Scheme } from './model';

// "Web Programming - Semarang" menjadi "Web Programming" / "Web Programming - Semarang" becomes "Web Programming"
const programOf = (className: string) => className.split(' - ')[0].trim();

/**
 * Data mentah ringkasan Job Portal. Peserta dan penempatannya diambil dari
 * ringkasan dashboard, jadi angka "berhak magang" sama dengan dashboard.
 *
 * Raw data for the Job Portal summary. Participants and their placement come
 * from the dashboard snapshot, so "entitled to an internship" matches the dashboard.
 */
export async function portalInsights(actor: Actor): Promise<PortalInsights> {
  const db = getAdminDb();
  const [snapshot, jSnap, pSnap, cSnap, aSnap] = await Promise.all([
    getSnapshot(actor),
    db.collection('jobs').select('title', 'partnerId', 'partnerName', 'scheme', 'quota', 'status', 'picEmail', 'eligibility').get(),
    db.collection('partners').select('pics').get(),
    db.collection('classes').select('canonicalName').get(),
    db.collection('jobApplications').select(
      'studentId', 'jobId', 'status', 'submittedAt', 'completedAt',
      'interview.date', 'interview.start', 'interview.durationMin', 'interview.confirmation', 'interview.interviewer',
    ).get(),
  ]);

  const classProgram = new Map(cSnap.docs.filter((c) => c.id !== DEMO_CLASS_ID).map((c) => [c.id, programOf(String(c.get('canonicalName') ?? ''))]));
  const pics = new Map(pSnap.docs.map((p) => [p.id, (p.get('pics') ?? []) as { name: string; email: string }[]]));

  const jobs: InsightJob[] = jSnap.docs
    .filter((j) => {
      const e = j.get('eligibility') as Eligibility | undefined;
      // Draf dan lowongan demo tidak menambah kursi sungguhan / Drafts and demo jobs add no real seats
      return j.get('status') === 'published' && !(e?.mode === 'classes' && e.classIds.includes(DEMO_CLASS_ID));
    })
    .map((j) => {
      const e = j.get('eligibility') as Eligibility | undefined;
      const programs = e?.mode === 'classes' ? [...new Set(e.classIds.map((id) => classProgram.get(id)).filter((p): p is string => !!p))].sort() : [];
      return {
        id: j.id, title: String(j.get('title') ?? ''), partnerId: String(j.get('partnerId') ?? ''), partnerName: String(j.get('partnerName') ?? ''),
        picName: jobPic(pics.get(String(j.get('partnerId'))) ?? [], j.get('picEmail'))?.name ?? '',
        scheme: (j.get('scheme') as Scheme | undefined) ?? 'full', quota: Number(j.get('quota') ?? 0), programs,
      };
    });
  const realJob = new Set(jobs.map((j) => j.id));

  const appsByStudent = new Map<string, InsightApp[]>();
  for (const a of aSnap.docs) {
    if (!realJob.has(String(a.get('jobId')))) continue;
    const i = a.get('interview') as InsightApp['interview'] | undefined;
    const row: InsightApp = {
      id: a.id, jobId: String(a.get('jobId')), status: a.get('status') as ApplicationStatus, submittedAt: String(a.get('submittedAt') ?? ''),
      completedAt: a.get('completedAt') ?? null,
      interview: i?.date ? { date: i.date, start: i.start, durationMin: i.durationMin, confirmation: i.confirmation, interviewer: i.interviewer } : null,
    };
    appsByStudent.set(String(a.get('studentId')), [...(appsByStudent.get(String(a.get('studentId'))) ?? []), row]);
  }

  const students: InsightStudent[] = snapshot.ranking
    .filter((r) => r.placement === 'full' || r.placement === 'project')
    .map((r) => ({
      studentId: r.studentId, name: r.studentName, className: r.className, program: programOf(r.className), placement: r.placement as Scheme,
      apps: (appsByStudent.get(r.studentId) ?? []).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    }));

  return { programs: [...new Set(classProgram.values())].filter(Boolean).sort(), jobs, students };
}
