// Penghapusan berantai untuk entitas yang dikelola admin
// Cascading deletion for admin-managed entities
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import type { ClassDocument } from '../classes/types';
import type { TaskDocument } from '../tasks/types';
import type { SessionDocument } from '../attendance/types';
import { cancelCalendarEvent, isCalendarConfigured } from '../calendar/client';
import type { MentoringBookingDocument } from '../mentoring/types';

/**
 * Ringkasan dampak sebelum penghapusan dijalankan.
 *
 * Ditampilkan kepada admin lebih dulu karena penghapusan ini memusnahkan hasil
 * kerja peserta -- berkas yang dikumpulkan, nilai, umpan balik, dan catatan
 * kehadiran -- yang tidak memiliki salinan lain.
 *
 * Impact summary shown before a deletion runs.
 *
 * Presented to the admin first because these deletions destroy participant work
 * -- submitted files, scores, feedback, and attendance records -- that has no
 * other copy.
 */
export interface DeletionImpact {
  label: string;
  /** Apa saja yang ikut terhapus, untuk ditampilkan ke admin / What goes with it, to show the admin */
  cascade: { collection: string; count: number; destroysWork: boolean }[];
}

/** Batas satu batch Firestore / Firestore batch limit */
const BATCH_LIMIT = 450;

/**
 * Menghapus banyak dokumen dalam beberapa batch.
 *
 * Firestore membatasi 500 operasi per batch; kelas dengan puluhan peserta
 * melampauinya dengan mudah.
 *
 * Deletes many documents across several batches.
 *
 * Firestore caps a batch at 500 operations; a class with dozens of participants
 * exceeds that easily.
 */
async function deleteAll(refs: FirebaseFirestore.DocumentReference[]): Promise<void> {
  const db = getAdminDb();
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(ref);
    await batch.commit();
  }
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan menghapus data');
  }
}

// ---------------------------------------------------------------------------
// Tugas / Task
// ---------------------------------------------------------------------------

export async function getTaskDeletionImpact(actor: Actor, taskId: string): Promise<DeletionImpact> {
  requireAdmin(actor);
  const db = getAdminDb();

  const taskDoc = await db.collection('tasks').doc(taskId).get();
  if (!taskDoc.exists) throw new Error('Tugas tidak ditemukan');
  const task = taskDoc.data() as TaskDocument;

  const subs = await db.collection('submissions').where('taskId', '==', taskId).get();

  return {
    label: task.title,
    cascade: [
      { collection: 'Pengumpulan tugas peserta', count: subs.size, destroysWork: true },
      { collection: 'Nilai dan umpan balik', count: subs.docs.filter((d) => d.data().score !== null).length, destroysWork: true },
    ],
  };
}

/**
 * Menghapus satu tugas beserta seluruh pengumpulan dan penilaiannya.
 *
 * Membersihkan pula rujukan pada dokumen kelas. Tanpa itu, `requiredDailyTaskIds`
 * tetap memuat tugas yang sudah tiada: Capstone hanya terbuka bila setiap tugas
 * dalam daftar itu sudah dikumpulkan, sehingga tugas yang terhapus mengunci
 * Capstone secara permanen bagi seluruh kelas.
 *
 * Deletes a task along with every submission and grade for it.
 *
 * Also clears the references on the class document. Without that,
 * `requiredDailyTaskIds` still lists a task that no longer exists: the Capstone
 * unlocks only when every task in that list has been submitted, so a deleted
 * task locks the Capstone permanently for the whole class.
 */
export async function deleteTask(actor: Actor, taskId: string): Promise<void> {
  requireAdmin(actor);
  const db = getAdminDb();

  const taskRef = db.collection('tasks').doc(taskId);
  const taskDoc = await taskRef.get();
  if (!taskDoc.exists) throw new Error('Tugas tidak ditemukan');
  const task = taskDoc.data() as TaskDocument;

  const subsSnap = await db.collection('submissions').where('taskId', '==', taskId).get();

  // Hapus anak-anaknya lebih dulu; bila proses terputus di tengah, yang tersisa
  // adalah tugas tanpa pengumpulan, bukan pengumpulan tanpa tugas yang tidak
  // dapat ditemukan admin mana pun.
  //
  // Delete the children first; if the process is interrupted midway, what
  // remains is a task without submissions rather than submissions without a
  // task, which no admin could find.
  await deleteAll([
    ...subsSnap.docs.map((d) => d.ref),
    ...subsSnap.docs.map((d) => db.collection('submissionFeedback').doc(d.id)),
    db.collection('taskDetails').doc(taskId),
  ]);

  await db.runTransaction(async (tx) => {
    const classRef = db.collection('classes').doc(task.classId);
    const classSnap = await tx.get(classRef);
    if (!classSnap.exists) {
      tx.delete(taskRef);
      return;
    }

    const cls = classSnap.data() as ClassDocument;
    const field = task.kind === 'daily' ? 'dailyTaskCount' : 'capstoneTaskCount';

    tx.update(classRef, {
      [field]: Math.max(0, (cls[field] || 0) - 1),
      requiredDailyTaskIds: (cls.requiredDailyTaskIds || []).filter((id) => id !== taskId),
      ...(cls.capstoneTaskId === taskId ? { capstoneTaskId: null } : {}),
      updatedAt: new Date().toISOString(),
    });
    tx.delete(taskRef);
  });
}

// ---------------------------------------------------------------------------
// Sesi / Session
// ---------------------------------------------------------------------------

export async function getSessionDeletionImpact(actor: Actor, sessionId: string): Promise<DeletionImpact> {
  requireAdmin(actor);
  const db = getAdminDb();

  const doc = await db.collection('sessions').doc(sessionId).get();
  if (!doc.exists) throw new Error('Sesi tidak ditemukan');

  const attendance = await db.collection('attendance').where('sessionId', '==', sessionId).get();

  return {
    label: (doc.data() as SessionDocument).title,
    cascade: [{ collection: 'Catatan kehadiran peserta', count: attendance.size, destroysWork: true }],
  };
}

/**
 * Menghapus satu sesi beserta seluruh catatan kehadirannya.
 *
 * Kehadiran adalah satu-satunya bukti peserta hadir dan tidak dapat disusun
 * ulang: token QR terikat jendela waktu dan nomor revisi sesi. Ekspor CSV lebih
 * dulu bila rekapnya masih dibutuhkan.
 *
 * Deletes a session along with all its attendance records.
 *
 * Attendance is the only proof a participant was present and cannot be
 * reconstructed: QR tokens are bound to a time window and the session's revision
 * number. Export the CSV first if the record is still needed.
 */
export async function deleteSession(actor: Actor, sessionId: string): Promise<void> {
  requireAdmin(actor);
  const db = getAdminDb();

  const sessionRef = db.collection('sessions').doc(sessionId);
  if (!(await sessionRef.get()).exists) throw new Error('Sesi tidak ditemukan');

  const attendance = await db.collection('attendance').where('sessionId', '==', sessionId).get();
  await deleteAll(attendance.docs.map((d) => d.ref));
  await sessionRef.delete();
}

// ---------------------------------------------------------------------------
// Slot mentoring / Mentoring slot
// ---------------------------------------------------------------------------

export async function getSlotDeletionImpact(actor: Actor, slotId: string): Promise<DeletionImpact> {
  requireAdmin(actor);
  const db = getAdminDb();

  const doc = await db.collection('mentoringSlots').doc(slotId).get();
  if (!doc.exists) throw new Error('Slot mentoring tidak ditemukan');
  const slot = doc.data();

  return {
    label: `${slot?.date} ${slot?.startTime} - ${slot?.mentorName}`,
    cascade:
      slot?.status === 'booked'
        ? [{ collection: 'Sesi mentoring yang sudah dipesan peserta', count: 1, destroysWork: true }]
        : [],
  };
}

/**
 * Menghapus slot mentoring, membatalkan booking yang menempatinya lebih dulu.
 *
 * Kuota dikembalikan dan undangan Google Calendar dibatalkan; tanpa keduanya
 * peserta kehilangan satu jatah sesi dan tetap memegang undangan untuk pertemuan
 * yang sudah tidak ada.
 *
 * Deletes a mentoring slot, cancelling any booking on it first.
 *
 * The quota is refunded and the Google Calendar invitation cancelled; without
 * both, the participant loses one of their session allowance and keeps an
 * invitation to a meeting that no longer exists.
 */
export async function deleteMentoringSlot(actor: Actor, slotId: string): Promise<void> {
  requireAdmin(actor);
  const db = getAdminDb();

  const slotRef = db.collection('mentoringSlots').doc(slotId);
  const slotDoc = await slotRef.get();
  if (!slotDoc.exists) throw new Error('Slot mentoring tidak ditemukan');
  const slot = slotDoc.data()!;

  let calendarEventId: string | null = null;

  if (slot.bookingId) {
    const bookingRef = db.collection('bookings').doc(slot.bookingId);
    const bookingDoc = await bookingRef.get();

    if (bookingDoc.exists) {
      const booking = bookingDoc.data() as MentoringBookingDocument;
      calendarEventId = booking.calendarEventId;

      if (booking.status === 'confirmed') {
        const quotaRef = db.collection('mentoringQuotas').doc(`${booking.studentId}_${booking.phase}`);
        await db.runTransaction(async (tx) => {
          const quotaSnap = await tx.get(quotaRef);
          // set-merge, bukan update: update melempar galat bila dokumen kuota
          // belum pernah dibuat, dan itu membatalkan seluruh penghapusan.
          //
          // set-merge rather than update: update throws when the quota document
          // was never created, and that aborts the whole deletion.
          tx.set(
            quotaRef,
            {
              count: Math.max(0, (quotaSnap.exists ? quotaSnap.data()?.count || 1 : 1) - 1),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        });
      }
      await bookingRef.delete();
    }
  }

  await slotRef.delete();

  // Google dipanggil terakhir: kegagalan di sini menyisakan undangan yatim,
  // bukan data Firestore yang setengah terhapus.
  //
  // Google is called last: a failure here leaves an orphan invitation rather
  // than half-deleted Firestore data.
  if (calendarEventId && isCalendarConfigured()) {
    try {
      await cancelCalendarEvent(calendarEventId);
    } catch (error) {
      console.error('[admin] gagal membatalkan event kalender saat hapus slot', { slotId, error });
    }
  }
}

// ---------------------------------------------------------------------------
// Kelas / Class
// ---------------------------------------------------------------------------

export async function getClassDeletionImpact(actor: Actor, classId: string): Promise<DeletionImpact> {
  requireAdmin(actor);
  const db = getAdminDb();

  const classDoc = await db.collection('classes').doc(classId).get();
  if (!classDoc.exists) throw new Error('Kelas tidak ditemukan');
  const cls = classDoc.data() as ClassDocument;

  const [tasks, sessions, attendance, slots, students] = await Promise.all([
    db.collection('tasks').where('classId', '==', classId).count().get(),
    db.collection('sessions').where('classId', '==', classId).count().get(),
    db.collection('attendance').where('classId', '==', classId).count().get(),
    db.collection('mentoringSlots').where('classId', '==', classId).count().get(),
    db.collection('users').where('classId', '==', classId).count().get(),
  ]);

  const submissions = await db.collection('submissions').where('classId', '==', classId).count().get();

  return {
    label: cls.canonicalName,
    cascade: [
      { collection: 'Instruksi tugas', count: tasks.data().count, destroysWork: false },
      { collection: 'Jadwal pertemuan', count: sessions.data().count, destroysWork: false },
      { collection: 'Slot mentoring', count: slots.data().count, destroysWork: false },
      { collection: 'Pengumpulan tugas peserta', count: submissions.data().count, destroysWork: true },
      { collection: 'Catatan kehadiran peserta', count: attendance.data().count, destroysWork: true },
      { collection: 'Peserta kehilangan kelasnya', count: students.data().count, destroysWork: false },
    ],
  };
}

/**
 * Menghapus kelas beserta seluruh isinya.
 *
 * Akun peserta sengaja tidak dihapus, hanya `classId`-nya dikosongkan: akun
 * memuat riwayat dan identitas login yang tidak ada hubungannya dengan satu
 * kelas. `classKeys` wajib ikut terhapus, sebab dokumen itulah penjaga keunikan
 * Kota+Program -- bila tertinggal, kombinasi yang sama tidak akan pernah bisa
 * dibuat lagi.
 *
 * Deletes a class and everything inside it.
 *
 * Participant accounts are deliberately kept, with only their `classId`
 * cleared: an account carries history and a login identity unrelated to any one
 * class. `classKeys` must go too, since that document is the City+Program
 * uniqueness guard -- left behind, the same combination could never be created
 * again.
 */
export async function deleteClass(actor: Actor, classId: string): Promise<void> {
  requireAdmin(actor);
  const db = getAdminDb();

  const classRef = db.collection('classes').doc(classId);
  const classDoc = await classRef.get();
  if (!classDoc.exists) throw new Error('Kelas tidak ditemukan');
  const cls = classDoc.data() as ClassDocument;

  const [tasks, sessions, attendance, submissions, slots, bookings, assignments, students] = await Promise.all([
    db.collection('tasks').where('classId', '==', classId).get(),
    db.collection('sessions').where('classId', '==', classId).get(),
    db.collection('attendance').where('classId', '==', classId).get(),
    db.collection('submissions').where('classId', '==', classId).get(),
    db.collection('mentoringSlots').where('classId', '==', classId).get(),
    db.collection('bookings').where('classId', '==', classId).get(),
    db.collection('assignments').where('classId', '==', classId).get(),
    db.collection('users').where('classId', '==', classId).get(),
  ]);

  const calendarEventIds = bookings.docs
    .map((d) => (d.data() as MentoringBookingDocument).calendarEventId)
    .filter((id): id is string => Boolean(id));

  await deleteAll([
    ...tasks.docs.map((d) => d.ref),
    ...tasks.docs.map((d) => db.collection('taskDetails').doc(d.id)),
    ...sessions.docs.map((d) => d.ref),
    ...attendance.docs.map((d) => d.ref),
    ...submissions.docs.map((d) => d.ref),
    ...submissions.docs.map((d) => db.collection('submissionFeedback').doc(d.id)),
    ...slots.docs.map((d) => d.ref),
    ...bookings.docs.map((d) => d.ref),
    ...assignments.docs.map((d) => d.ref),
  ]);

  // Lepaskan peserta dari kelas yang sudah tiada. Tanpa ini dasbor mereka
  // menampilkan data kosong dan pengumpulan tugas gagal dengan "Kelas tidak
  // ditemukan".
  //
  // Detach participants from a class that no longer exists. Without this their
  // dashboard shows empty data and submitting a task fails with "class not
  // found".
  const now = new Date().toISOString();
  for (let i = 0; i < students.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const d of students.docs.slice(i, i + BATCH_LIMIT)) {
      batch.update(d.ref, { classId: null, updatedAt: now });
    }
    await batch.commit();
  }

  await deleteAll([db.collection('classKeys').doc(cls.classKey), classRef]);

  if (isCalendarConfigured()) {
    for (const eventId of calendarEventIds) {
      try {
        await cancelCalendarEvent(eventId);
      } catch (error) {
        console.error('[admin] gagal membatalkan event kalender saat hapus kelas', { classId, eventId, error });
      }
    }
  }
}
