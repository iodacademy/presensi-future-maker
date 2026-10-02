import { getSessionActor } from '@/features/auth/session';
import { getProfile } from '@/features/users/profile-service';
import { ProfileGateClient } from '@/components/profile-gate-client';

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
  const profile = await getProfile(actor.uid);
  if (!profile) {
    return <ProfileGateClient />;
  }

  return <>{children}</>;
}
