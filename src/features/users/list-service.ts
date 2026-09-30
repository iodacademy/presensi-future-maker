// Daftar pengguna untuk panel admin / User listing for the admin panel
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor, Role, UserDocument } from '../auth/types';
import { normalizeEmail, getEmailHash } from '../auth/policy';
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

/**
 * Mengubah nama, surel, atau kelas sebuah akun.
 *
 * Surel disimpan pada dokumen pengguna sekaligus sebagai kunci dokumen
 * emailIndex, yang dinamai menurut hash surelnya. Mengganti surel berarti
 * memindahkan dokumen indeks itu, bukan menyuntingnya: indeks lama harus
 * dihapus agar surel lama tidak lagi membuka akun ini, dan yang baru dibuat
 * agar surel barunya dikenali saat masuk.
 *
 * Changes an account's name, email, or class.
 *
 * The email lives on the user document and doubles as the key of an emailIndex
 * document, which is named after the email's hash. Changing the email means
 * moving that index document rather than editing it: the old index must be
 * removed so the old address no longer opens this account, and a new one
 * written so the new address is recognised at sign-in.
 */
export async function updateUserAccount(
  actor: Actor,
  uid: string,
  input: { name?: string; email?: string; classId?: string | null }
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan mengubah akun');
  }

  const db = getAdminDb();
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new Error('Akun tidak ditemukan');
  }

  const user = userSnap.data() as UserDocument;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error('Nama wajib diisi');
    patch.name = name;
  }

  let oldHash: string | null = null;
  let newHash: string | null = null;

  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);
    if (!email || !email.includes('@')) {
      throw new Error('Surel tidak valid');
    }

    if (email !== normalizeEmail(user.email)) {
      newHash = getEmailHash(email);
      // Surel adalah satu-satunya cara masuk, sehingga surel yang sudah
      // dipakai akun lain akan membuat dua akun berebut satu identitas.
      //
      // The email is the only way in, so one already used by another account
      // would leave two accounts contesting a single identity.
      const bentrok = await db.collection('emailIndex').doc(newHash).get();
      if (bentrok.exists && bentrok.data()?.uid !== uid) {
        throw new Error('Surel ini sudah dipakai akun lain');
      }
      oldHash = getEmailHash(user.email);
      patch.email = email;
      patch.normalizedEmail = email;
    }
  }

  // Kelas hanya berlaku bagi peserta. Mentor terhubung ke kelas lewat
  // mentorIds pada dokumen kelasnya, dan admin tidak terikat kelas mana pun.
  //
  // A class only applies to participants. Mentors are linked through their
  // class's mentorIds, and an admin belongs to no class.
  const classChanged =
    input.classId !== undefined && user.role === 'student' && (input.classId || null) !== (user.classId || null);

  if (classChanged) {
    patch.classId = input.classId || null;
  }

  // Seluruh pembacaan diselesaikan sebelum batch disusun. Batch memang tidak
  // menuntutnya seperti transaction, tetapi await yang berselang-seling dengan
  // penulisan membuat urutan operasinya sulit ditelusuri saat salah satunya
  // gagal.
  //
  // Every read completes before the batch is assembled. A batch does not
  // require this the way a transaction does, but awaits interleaved with
  // writes make the order of operations hard to follow when one of them fails.
  const kelasSnapshots: { ref: FirebaseFirestore.DocumentReference; current: number; delta: number }[] = [];
  let assignmentDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  if (classChanged) {
    const perubahanKelas: [string | null, number][] = [
      [user.classId ?? null, -1],
      [(patch.classId as string | null) ?? null, 1],
    ];

    for (const [classId, delta] of perubahanKelas) {
      if (!classId) continue;
      const ref = db.collection('classes').doc(classId);
      const snap = await ref.get();
      if (!snap.exists) continue;
      kelasSnapshots.push({ ref, current: (snap.data()?.studentCount as number) || 0, delta });
    }

    assignmentDocs = (await db.collection('assignments').where('studentId', '==', uid).get()).docs;
  }

  const batch = db.batch();
  batch.update(userRef, patch);

  if (oldHash && newHash) {
    batch.delete(db.collection('emailIndex').doc(oldHash));
    batch.set(db.collection('emailIndex').doc(newHash), {
      uid,
      normalizedEmail: patch.email,
      role: user.role,
      createdAt: now,
    });
  }

  if (classChanged) {
    // studentCount dipakai sebagai pembagi pada rekap kehadiran dan
    // pengumpulan; membiarkannya membuat kelas asal tampak kekurangan peserta
    // selamanya dan kelas tujuan tampak kelebihan.
    //
    // studentCount is the divisor in attendance and submission reports;
    // leaving it makes the source class look permanently short and the
    // destination long.
    for (const { ref, current, delta } of kelasSnapshots) {
      batch.update(ref, { studentCount: Math.max(0, current + delta), updatedAt: now });
    }

    // Penugasan mentoring terikat pada kelas lamanya. Dibiarkan, peserta
    // tercatat dibimbing mentor kelas lain dan muncul pada daftar bimbingan
    // yang bukan kelasnya.
    //
    // Mentoring assignments are tied to the old class. Left alone, the
    // participant stays listed under a mentor from another class and appears
    // on a guidance list that is not theirs.
    for (const doc of assignmentDocs) {
      batch.delete(doc.ref);
    }
  }

  await batch.commit();
}
