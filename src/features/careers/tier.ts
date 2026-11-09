/**
 * Tier peserta magang menurut SPA: kuota lamaran, batas uang saku lowongan, dan jalur skema.
 * Aturan lengkapnya ada di docs/ketentuan-portal-karier.md.
 *
 * Intern tiers by SPA: application quota, job allowance cap, and scheme track.
 * The full rules live in docs/ketentuan-portal-karier.md.
 */
import { canApplyScheme, isOpenApplication, type ApplicationStatus, type Scheme } from './model';

export type Tier = 'A' | 'B' | 'C';
export const TIER_RULES: Record<Tier, Record<Scheme, { quota: number; maxSalary: number }>> = {
  A: { full: { quota: 5, maxSalary: 1_500_000 }, project: { quota: 3, maxSalary: 1_500_000 } },
  B: { full: { quota: 3, maxSalary: 1_000_000 }, project: { quota: 2, maxSalary: 1_000_000 } },
  C: { full: { quota: 2, maxSalary: 750_000 }, project: { quota: 1, maxSalary: 500_000 } },
};
export const QUOTA_MESSAGE = 'Kuota lamaranmu sedang penuh. Tunggu hasil lamaran yang berjalan dulu.';
export const PROJECT_QUOTA_MESSAGE = 'Jatah proyekmu sedang penuh. Kamu bisa melamar lagi setelah ada proyek yang selesai atau lamaran yang tidak lolos.';

// Tanpa nilai diperlakukan paling ketat / No score is treated most strictly
export const tierOf = (spa: number | null): Tier => (spa === null ? 'C' : spa >= 85 ? 'A' : spa >= 75 ? 'B' : 'C');

export interface CareerApp { status: ApplicationStatus; scheme?: Scheme; completedAt?: string | null }
export interface CareerStanding { track: Scheme | null; tier: Tier; locked: boolean; quota: number; used: number }

// Lamaran sebelum skema disimpan semuanya dari lowongan Full Internship / Applications from before the scheme was stored all came from Full Internship jobs
const schemeOf = (a: CareerApp): Scheme => a.scheme ?? 'full';
const ongoing = (a: CareerApp) => a.status === 'bergabung' && schemeOf(a) === 'project' && !a.completedAt;

export const projectsOngoing = (apps: CareerApp[]): number => apps.filter(ongoing).length;

/**
 * Peserta yang menerima tawaran Project Based pindah permanen ke jalur Project Based. Di jalur itu,
 * proyek yang belum selesai ikut memakai kuota.
 *
 * A participant who accepts a Project Based offer moves to the Project Based track for good. On that
 * track, unfinished projects also use up the quota.
 */
export function careerStanding(placement: string | null, spa: number | null, apps: CareerApp[], tier: Tier = tierOf(spa)): CareerStanding {
  const base = placement === 'full' || placement === 'project' ? placement : null;
  const track: Scheme | null = base && apps.some((a) => a.status === 'bergabung' && schemeOf(a) === 'project') ? 'project' : base;
  const locked = apps.some((a) => a.status === 'bergabung' && schemeOf(a) === 'full');
  const running = apps.filter((a) => isOpenApplication(a.status)).length;
  return {
    track, tier, locked,
    quota: TIER_RULES[tier][track ?? 'full'].quota,
    used: running + (track === 'project' ? projectsOngoing(apps) : 0),
  };
}

export const LOCKED_MESSAGE = 'Kamu sudah menerima tawaran magang, jadi tidak bisa melamar lagi';

// Alasan peserta belum bisa mengirim lamaran baru, atau null / Why the participant cannot send a new application yet, or null
export function applyBlock(s: CareerStanding): string | null {
  if (s.locked) return LOCKED_MESSAGE;
  if (s.used >= s.quota) return s.track === 'project' ? PROJECT_QUOTA_MESSAGE : QUOTA_MESSAGE;
  return null;
}

// Lowongan tanpa nominal terbuka untuk semua tier / Jobs without an amount are open to every tier
export const canSeeJob = (s: CareerStanding, job: { scheme: Scheme; salary?: number | null }): boolean =>
  canApplyScheme(s.track, job.scheme) && (!job.salary || job.salary <= TIER_RULES[s.tier][job.scheme].maxSalary);
