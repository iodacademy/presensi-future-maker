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
import { isOpenApplication, type ApplicationStatus, type Interview } from './model';
import type { PartnerActor } from './partner-service';

const apps = () => getAdminDb().collection('jobApplications');

export async function respondOffer(actor: Actor, appId: string, response: unknown, now: Date): Promise<void> {
  if (response !== 'terima' && response !== 'tolak') throw new Error('Jawaban tidak dikenal');
  const snap = await apps().doc(appId).get();
  if (!snap.exists || snap.get('studentId') !== actor.uid) throw new Error('Lamaran tidak ditemukan');
  if (snap.get('status') !== 'diterima') throw new Error('Belum ada tawaran untuk lamaran ini');
  const t = now.toISOString();
  if (response === 'tolak') {
    await snap.ref.update({ status: 'menolak', statusChangedAt: t, updatedAt: t });
    return;
  }

  // ponytail: dibaca lalu ditulis dalam satu batch, bukan transaksi; PIC yang mengubah lamaran lain pada detik yang sama bisa lolos. Pindah ke transaksi bila itu terjadi.
  // ponytail: read then written in one batch, not a transaction; a PIC changing another application in the same second can slip through. Move to a transaction if that happens.
  const others = (await apps().where('studentId', '==', actor.uid).select('status', 'interview.calendarEventId').get()).docs
    .filter((d) => d.id !== appId && isOpenApplication(d.get('status') as ApplicationStatus));
  const batch = getAdminDb().batch();
  batch.update(snap.ref, { status: 'bergabung', statusChangedAt: t, updatedAt: t });
  for (const d of others) {
    batch.update(d.ref, { status: 'ditutup', statusChangedAt: t, updatedAt: t, ...(d.get('interview.calendarEventId') ? { 'interview.calendarEventId': null } : {}) });
  }
  await batch.commit();
  // Undangan Calendar dibatalkan setelah status tersimpan: kegagalan membatalkan tidak membuka kembali lamarannya
  // Calendar invites are cancelled after the status is saved: a failed cancel does not reopen the application
  for (const d of others) {
    const ev = d.get('interview.calendarEventId') as string | null;
    if (ev) await cancelCalendarEvent(ev).catch((e) => console.error('[karier] batal interview lamaran yang ditutup', e));
  }
}

/** PIC menandai kandidat lolos sudah dihubungi / The PIC marks a passed candidate as contacted */
export async function markContacted(actor: PartnerActor, appId: string, now: Date): Promise<void> {
  const snap = await apps().doc(appId).get();
  if (!snap.exists || snap.get('partnerId') !== actor.partnerId) throw new Error('Lamaran tidak ditemukan');
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
