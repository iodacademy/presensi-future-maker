import { getAdminDb } from '../../lib/firebase/admin';

/**
 * Sakelar pendaftaran lamaran Job Portal. Tanpa pengaturan, pendaftaran
 * dianggap tutup: siswa sudah bisa melihat lowongan sebelum penempatan magang
 * siap diumumkan, dan admin yang membukanya.
 *
 * The Job Portal application switch. With no setting, applications count as
 * closed: students can already browse jobs before internship placement is
 * ready to announce, and an admin opens them.
 */
const ref = () => getAdminDb().collection('settings').doc('careers');

export async function applicationsOpen(): Promise<boolean> {
  return (await ref().get()).get('applicationsOpen') === true;
}

export async function setApplicationsOpen(open: boolean): Promise<void> {
  await ref().set({ applicationsOpen: open, updatedAt: new Date().toISOString() }, { merge: true });
}

export const CLOSED_MESSAGE = 'Pendaftaran lamaran belum dibuka';
