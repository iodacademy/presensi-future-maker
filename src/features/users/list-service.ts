// Daftar pengguna untuk panel admin / User listing for the admin panel
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor, Role, UserDocument } from '../auth/types';
import type { ClassDocument } from '../classes/types';

export interface UserListItem {
  uid: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  classId: string | null;
  className: string | null;
}

export interface UserListResult {
  users: UserListItem[];
  counts: Record<Role, number>;
}

/**
 * Mengambil seluruh pengguna beserta nama kelasnya.
 *
 * Nama kelas disusun di sini dari satu kali baca koleksi kelas, bukan dengan
 * membaca dokumen kelas per pengguna: satu angkatan berisi puluhan peserta pada
 * kelas yang sama, sehingga pembacaan per baris mengulang permintaan yang sama
 * berkali-kali.
 *
 * Kolom yang dibaca dibatasi pada yang benar-benar ditampilkan. Dokumen
 * pengguna memuat stempel waktu dan surel ternormalisasi yang tidak dipakai
 * tabel ini.
 *
 * Fetches every user along with their class name.
 *
 * Class names are resolved here from a single read of the classes collection
 * rather than one read per user: a cohort holds dozens of participants in the
 * same class, so per-row reads repeat the same request many times over.
 *
 * The selected fields are limited to what is actually displayed. A user
 * document also carries timestamps and a normalised address this table never
 * shows.
 */
export async function listUsers(actor: Actor): Promise<UserListResult> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan melihat daftar akun');
  }

  const db = getAdminDb();

  const [usersSnap, classesSnap] = await Promise.all([
    db.collection('users').select('uid', 'name', 'email', 'role', 'active', 'classId').get(),
    db.collection('classes').select('canonicalName').get(),
  ]);

  const classNames = new Map<string, string>();
  for (const doc of classesSnap.docs) {
    classNames.set(doc.id, (doc.data() as Pick<ClassDocument, 'canonicalName'>).canonicalName);
  }

  const counts: Record<Role, number> = { admin: 0, mentor: 0, student: 0 };

  const users = usersSnap.docs.map((doc) => {
    const data = doc.data() as Partial<UserDocument>;
    const role = (data.role ?? 'student') as Role;
    if (role in counts) counts[role] += 1;

    return {
      uid: data.uid ?? doc.id,
      name: data.name ?? '(tanpa nama)',
      email: data.email ?? '',
      role,
      active: data.active !== false,
      classId: data.classId ?? null,
      // Kelas yang sudah terhapus menyisakan classId yang tidak menunjuk apa
      // pun; ditampilkan apa adanya agar admin melihat ada yang perlu
      // dibereskan, bukan disamarkan menjadi seolah tanpa kelas.
      //
      // A deleted class leaves a classId pointing nowhere; it is surfaced as
      // such so an admin sees something needs fixing, rather than being masked
      // as having no class at all.
      className: data.classId ? (classNames.get(data.classId) ?? '(kelas terhapus)') : null,
    };
  });

  users.sort((a, b) => a.name.localeCompare(b.name, 'id'));

  return { users, counts };
}

/**
 * Admin menonaktifkan atau mengaktifkan kembali sebuah akun.
 *
 * Penonaktifan dipakai alih-alih penghapusan: field `active` sudah diperiksa
 * pada saat masuk maupun pada tiap pemeriksaan sesi, sehingga akun yang
 * dinonaktifkan langsung kehilangan akses tanpa memusnahkan pengumpulan tugas
 * dan catatan kehadirannya.
 *
 * An admin deactivates or restores an account.
 *
 * Deactivation is used rather than deletion: the `active` field is already
 * checked both at sign-in and on every session check, so a deactivated account
 * loses access at once without destroying its submissions and attendance
 * records.
 */
export async function setUserActive(actor: Actor, uid: string, active: boolean): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan mengubah status akun');
  }

  if (uid === actor.uid && !active) {
    throw new Error('Anda tidak dapat menonaktifkan akun Anda sendiri');
  }

  const db = getAdminDb();
  const ref = db.collection('users').doc(uid);
  if (!(await ref.get()).exists) {
    throw new Error('Akun tidak ditemukan');
  }

  await ref.update({ active, updatedAt: new Date().toISOString() });
}
