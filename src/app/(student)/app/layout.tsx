import { getSessionActor } from '@/features/auth/session';
import { getProfile } from '@/features/users/profile-service';
import { recordDailyLogin } from '@/features/dashboard/login-service';
import { ProfileGateClient } from '@/components/profile-gate-client';
import { StudentContextProvider } from '@/components/student-shell';
import { listStudentReminders } from '@/features/dashboard/reminder-service';
import { careerAccess } from '@/features/careers/student-service';
import { careerReminders } from '@/features/careers/offer-service';

/**
 * Gerbang profil untuk seluruh halaman peserta.
 *
 * Dipasang di layout, bukan hanya pada kerangka tampilannya: empat halaman --
 * pengerjaan ujian, hasil ujian, pemindaian QR, dan pengisian survei -- tidak
 * memakai kerangka itu, dan tautan langsung ke salah satunya akan melewati
 * gerbangnya.
 *
 * Diperiksa di server, bukan di peramban. Pemeriksaan di peramban hanya
 * menyembunyikan halamannya; datanya tetap dapat diambil lewat endpoint-nya.
 * Yang ditahan di sini adalah halamannya, bukan datanya -- tiap endpoint sudah
 * menjaga perannya sendiri -- tetapi menahannya di satu tempat membuat tidak
 * ada halaman peserta yang terlewat.
 *
 * The profile gate for every participant page.
 *
 * Placed in the layout rather than only in the view shell: four pages -- the
 * exam runner, the exam result, QR scanning, and filling in a survey -- do not
 * use that shell, and a direct link to any of them would bypass the gate.
 *
 * Checked on the server, not in the browser. A browser check only hides the
 * page; its data stays reachable through the endpoint. What is held back here
 * is the page, not the data -- each endpoint already guards its own role -- but
 * holding it in one place means no participant page is missed.
 */
export default async function StudentAppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getSessionActor();

  // Tanpa sesi, middleware sudah mengalihkannya ke login. Tidak ada yang perlu
  // dilakukan di sini selain membiarkannya lewat.
  //
  // With no session, middleware has already sent them to login. Nothing to do
  // here but let it through.
  if (!actor || actor.role !== 'student') {
    return <>{children}</>;
  }

  // Formulirnya digambar di tempat, bukan dialihkan ke halaman lain.
  // Halaman pengisiannya pun berada di bawah layout ini, sehingga mengalihkan
  // ke sana akan memicu pemeriksaan yang sama dan mengalihkannya lagi --
  // lingkaran yang tidak pernah berhenti.
  //
  // The form renders in place rather than redirecting elsewhere. The form's own
  // page would also sit under this layout, so redirecting to it would trigger
  // the same check and redirect again -- a loop that never ends.
  // Kehadirannya di LMS dicatat di sini, bukan pada halaman masuk: peserta
  // membuka aplikasi dari ikon layar utama berhari-hari tanpa pernah melewati
  // halaman masuk lagi, dan grafiknya akan memperlihatkan nol pada hari-hari
  // peserta justru paling aktif.
  //
  // Tidak ditunggu: sisa layout ini tidak bergantung padanya, dan menahan
  // halamannya demi satu tulis untuk grafik admin adalah pertukaran yang salah
  // arah. Kegagalannya ditangani di dalam fungsinya.
  //
  // Their LMS presence is recorded here rather than on the login page:
  // participants open the app from a home-screen icon for days without passing
  // through login again, and the chart would show zero on exactly the days they
  // were most active.
  //
  // Not awaited: nothing else in this layout depends on it, and holding the page
  // for one write that feeds an admin's chart is the wrong trade. Its failure is
  // handled inside the function.
  void recordDailyLogin(actor.uid);

  // Pengingat dihitung bersamaan dengan pemeriksaan profil, bukan sesudahnya,
  // dan kegagalannya tidak boleh menahan halaman: pengingat hanya pelengkap.
  //
  // Reminders are computed alongside the profile check rather than after it,
  // and their failure must not hold the page: reminders are only a helper.
  const [profile, reminders, karier, careers] = await Promise.all([
    getProfile(actor.uid),
    listStudentReminders(actor).catch(() => ({ surveys: [], exams: [] })),
    // Akses Karier dari ringkasan dashboard yang di-cache; kegagalannya hanya menyembunyikan menu
    // Karier access from the cached dashboard snapshot; a failure only hides the menu
    careerAccess(actor.uid, actor.classId).catch(() => false),
    careerReminders(actor.uid).catch(() => []),
  ]);
  if (!profile) {
    return <ProfileGateClient />;
  }

  return <StudentContextProvider value={{ name: actor.name, reminders: { ...reminders, careers }, careerAccess: karier }}>{children}</StudentContextProvider>;
}
