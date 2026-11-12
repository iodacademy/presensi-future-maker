import { getAdminDb } from '../../lib/firebase/admin';
import { cancelCalendarEvent } from '../calendar/client';
import { DEMO_CLASS_ID, type Eligibility } from './model';

/**
 * Mengosongkan lamaran semua akun di kelas demo supaya demo bisa diulang dari
 * awal. CV dan profil tetap, agar formulir lamaran tidak perlu diisi dari nol.
 * Hanya lamaran milik akun demo yang disentuh, jadi data peserta asli aman.
 *
 * Clears every demo-class account's applications so a demo can start over.
 * CVs and profiles stay, so the application form need not be filled from
 * scratch. Only demo accounts' applications are touched, so real data is safe.
 */
export async function resetDemoAccounts(): Promise<{ applications: number; jobs: number }> {
  const db = getAdminDb();
  const users = await db.collection('users').where('classId', '==', DEMO_CLASS_ID).select().get();
  let applications = 0;
  for (const u of users.docs) {
    const apps = await db.collection('jobApplications').where('studentId', '==', u.id).select('interview.calendarEventId').get();
    for (const a of apps.docs) {
      const ev = a.get('interview.calendarEventId');
      // Undangan kalender yang gagal dibatalkan tidak boleh menahan reset / A calendar invite that fails to cancel must not block the reset
      if (ev) await cancelCalendarEvent(String(ev)).catch((e) => console.error('[demo] batal acara interview', e));
      await a.ref.delete();
      applications++;
    }
  }
  const jobs = (await db.collection('jobs').where('eligibility.mode', '==', 'classes').select('eligibility').get()).docs
    .filter((j) => ((j.get('eligibility') as Eligibility & { classIds?: string[] }).classIds ?? []).includes(DEMO_CLASS_ID));
  for (const j of jobs) await j.ref.update({ applicantCount: 0 });
  return { applications, jobs: jobs.length };
}
