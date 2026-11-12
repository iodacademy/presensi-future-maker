import type { Actor } from '../auth/types';
import { jobPicEmails } from './model';

/**
 * Lowongan yang terlihat oleh seorang PIC: hanya yang di-assign kepadanya.
 * PIC yang tidak di-assign ke lowongan mana pun, mis. HR, melihat semua
 * lowongan perusahaannya (null berarti tanpa batas).
 *
 * The jobs a PIC can see: only those assigned to them. A PIC assigned to no
 * job at all, e.g. HR, sees every job of their company (null means no limit).
 */
export function picJobScope(
  actor: Pick<Actor, 'email'>,
  jobs: { id: string; data: { picEmails?: unknown; picEmail?: unknown } }[],
): Set<string> | null {
  const me = actor.email.toLowerCase();
  const mine = jobs.filter((j) => jobPicEmails(j.data).includes(me)).map((j) => j.id);
  return mine.length ? new Set(mine) : null;
}

export const inScope = (scope: Set<string> | null, jobId: string): boolean => !scope || scope.has(jobId);
