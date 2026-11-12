import type { ApplicationStatus, InterviewConfirmation, InterviewInput, PlacedAt, Scheme } from './model';

/**
 * Ringkasan Job Portal untuk admin. Modul ini murni, jadi filter jurusan
 * dihitung ulang di peramban tanpa memanggil server lagi.
 *
 * The Job Portal summary for admins. This module is pure, so the programme
 * filter is recomputed in the browser without calling the server again.
 */

export interface InsightJob {
  id: string; title: string; partnerId: string; partnerName: string; picName: string; scheme: Scheme; quota: number;
  /** Jurusan yang bisa melamar; kosong berarti semua jurusan / Programmes allowed to apply; empty means every programme */
  programs: string[];
}
export interface InsightApp {
  id: string; jobId: string; status: ApplicationStatus; submittedAt: string; completedAt: string | null;
  interview: { date: string; start: string; durationMin: InterviewInput['durationMin']; confirmation: InterviewConfirmation; interviewer: string } | null;
}
export interface InsightStudent {
  studentId: string; name: string; className: string; program: string;
  /** Penempatan dari dashboard; hanya yang berhak magang yang masuk ringkasan / Placement from the dashboard; only those entitled to an internship are included */
  placement: Scheme;
  apps: InsightApp[];
  /** Ditempatkan di luar lamaran, mis. seleksi awal mitra / Placed outside applications, e.g. a partner's early selection */
  placedAt?: PlacedAt | null;
}
export interface PortalInsights { programs: string[]; jobs: InsightJob[]; students: InsightStudent[] }

export const FUNNEL: ApplicationStatus[] = ['baru', 'ditinjau', 'shortlist', 'interview', 'diterima', 'bergabung', 'tidak-lolos', 'menolak', 'ditutup'];
const ACCEPTED: ApplicationStatus[] = ['diterima', 'bergabung'];

export const openToProgram = (job: Pick<InsightJob, 'programs'>, program: string | null): boolean =>
  !program || job.programs.length === 0 || job.programs.includes(program);

export function summarize(x: PortalInsights, program: string | null) {
  const jobs = x.jobs.filter((j) => openToProgram(j, program));
  const jobById = new Map(x.jobs.map((j) => [j.id, j]));
  const students = x.students.filter((s) => !program || s.program === program);

  // Pelamar sebuah perusahaan: peserta yang melamar salah satu posisinya, dengan lamaran ke perusahaan itu saja
  // A company's applicants: participants who applied to any of its positions, with their applications there only
  const applicantsOf = (partnerId: string) => students
    .map((student) => ({ student, apps: student.apps.filter((a) => jobById.get(a.jobId)?.partnerId === partnerId) }))
    .filter((x) => x.apps.length > 0);

  const partnerMap = new Map<string, { partnerId: string; partnerName: string; full: number; project: number; total: number; applicants: number }>();
  for (const j of jobs) {
    const p = partnerMap.get(j.partnerId) ?? { partnerId: j.partnerId, partnerName: j.partnerName, full: 0, project: 0, total: 0, applicants: applicantsOf(j.partnerId).length };
    p[j.scheme] += j.quota;
    p.total += j.quota;
    partnerMap.set(j.partnerId, p);
  }
  const byPartner = [...partnerMap.values()].sort((a, b) => b.total - a.total || a.partnerName.localeCompare(b.partnerName));
  const sum = (s?: Scheme) => jobs.filter((j) => !s || j.scheme === s).reduce((n, j) => n + j.quota, 0);

  const apps = students.flatMap((s) => s.apps);
  const accepted = students.flatMap((student) => student.apps
    .filter((app) => ACCEPTED.includes(app.status) && jobById.has(app.jobId))
    .map((app) => ({ student, app, job: jobById.get(app.jobId)! })));
  const placed = students.filter((s) => s.placedAt);
  return {
    partners: partnerMap.size,
    byPartner,
    quota: { total: sum(), full: sum('full'), project: sum('project') },
    students,
    applied: students.filter((s) => s.apps.length > 0),
    // Yang sudah ditempatkan tidak perlu melamar, jadi tidak ikut daftar yang perlu diingatkan / Placed participants need not apply, so they are left off the list to remind
    notApplied: students.filter((s) => s.apps.length === 0 && !s.placedAt),
    accepted,
    placed,
    // Satu orang dihitung sekali walau diterima lewat lamaran dan penempatan sekaligus / One person counts once even when accepted both ways
    acceptedCount: new Set([...accepted.map((a) => a.student.studentId), ...placed.map((s) => s.studentId)]).size,
    applicantsOf,
    funnel: FUNNEL.map((status) => ({ status, count: apps.filter((a) => a.status === status).length })),
  };
}

export type PortalSummary = ReturnType<typeof summarize>;
