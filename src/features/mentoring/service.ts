// Layanan manajemen slot, booking atomik, kuota dan integrasi meeting mentoring
// Mentoring slots management, atomic booking, quota, and meeting service
import crypto from 'crypto';
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor, UserDocument } from '../auth/types';
import type {
  MentoringSlotDocument,
  MentoringBookingDocument,
  CreateSlotInput,
  BookSlotInput,
  MentoringStudentView,
} from './types';
import type { Phase } from '../assignments/types';
import type { ClassDocument } from '../classes/types';
import {
  validateSlotInput,
  canBookMentoringSlot,
  isSecondSessionEarlyWeek,
  MAX_MENTORING_QUOTA,
} from './policy';
import { getStudentAssignment } from '../assignments/service';
import {
  createCalendarEvent,
  cancelCalendarEvent,
  isCalendarConfigured,
} from '../calendar/client';

function toUtcIso(dateStr: string, timeStr: string): string {
  const localWib = `${dateStr}T${timeStr}:00+07:00`;
  return new Date(localWib).toISOString();
}

/**
 * Admin membuat slot jadwal mentoring baru untuk satu mentor di kelas dan fase tertentu.
 *
 * Admin creates a new mentoring slot.
 */
export async function createMentoringSlot(actor: Actor, input: CreateSlotInput): Promise<{ id: string }> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan membuat slot mentoring');
  }

  const validated = validateSlotInput(input);
  const db = getAdminDb();

  const mentorDoc = await db.collection('users').doc(validated.mentorId).get();
  if (!mentorDoc.exists) {
    throw new Error('Mentor tidak ditemukan');
  }
  const mentorData = mentorDoc.data() as UserDocument;

  const classDoc = await db.collection('classes').doc(validated.classId).get();
  if (!classDoc.exists) {
    throw new Error('Kelas tidak ditemukan');
  }
  const classData = classDoc.data() as ClassDocument;

  const slotId = crypto.randomUUID();
  const startsAt = toUtcIso(validated.date, validated.startTime);
  const endsAt = toUtcIso(validated.date, validated.endTime);
  const now = new Date().toISOString();

  // Slot kosong tidak punya tautan Meet. Event kalender baru dibuat saat siswa
  // membooking, sebab Google hanya mengizinkan peserta di luar domain masuk
  // tanpa diketuk bila mereka sudah tercantum sebagai undangan -- dan saat slot
  // dibuat, siswanya belum diketahui.
  //
  // An empty slot has no Meet link. The calendar event is created when a
  // student books, because Google only lets out-of-domain attendees join
  // without knocking if they are already on the invite -- and at slot creation
  // time the student is not yet known.
  const slotDoc: MentoringSlotDocument = {
    id: slotId,
    classId: validated.classId,
    className: classData.canonicalName,
    phase: validated.phase,
    mentorId: validated.mentorId,
    mentorName: mentorData.name,
    date: validated.date,
    startTime: validated.startTime,
    endTime: validated.endTime,
    startsAt,
    endsAt,
    status: 'available',
    bookingId: null,
    studentId: null,
    studentName: null,
    meetUrl: null,
    calendarEventId: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('mentoringSlots').doc(slotId).set(slotDoc);

  return { id: slotId };
}

/**
 * Mengambil daftar seluruh slot mentoring di suatu kelas dan fase untuk tampilan Admin (Frame C1).
 *
 * Retrieves all mentoring slots for a class and phase for Admin view.
 */
export async function listSlotsForClass(classId: string, phase: Phase): Promise<MentoringSlotDocument[]> {
  const db = getAdminDb();
  const snapshot = await db.collection('mentoringSlots')
    .where('classId', '==', classId)
    .where('phase', '==', phase)
    .get();

  const slots = snapshot.docs.map((d) => d.data() as MentoringSlotDocument);
  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * Siswa melihat slot mentoring milik mentor yang ditugaskan kepadanya (Frame 03 & Frame 07).
 *
 * Student views mentoring slots for their assigned mentor.
 */
export async function getMentoringViewForStudent(
  actor: Actor,
  phase: Phase
): Promise<MentoringStudentView> {
  if (actor.role !== 'student' || !actor.classId) {
    return { assignedMentor: null, quotaUsed: 0, maxQuota: MAX_MENTORING_QUOTA, slots: [] };
  }

  const db = getAdminDb();

  // Assignment (mentor) dan kuota independen satu sama lain -- jalankan paralel.
  // Assignment (mentor) and quota are independent of each other -- run in parallel.
  const [assignment, quotaDoc] = await Promise.all([
    getStudentAssignment(actor.uid, phase),
    db.collection('mentoringQuotas').doc(`${actor.uid}_${phase}`).get(),
  ]);

  if (!assignment) {
    return { assignedMentor: null, quotaUsed: 0, maxQuota: MAX_MENTORING_QUOTA, slots: [] };
  }

  const quotaUsed = quotaDoc.exists ? (quotaDoc.data()?.count || 0) : 0;

  // Data mentor dan daftar slot sama-sama butuh assignment.mentorId, tapi tidak
  // saling bergantung satu sama lain -- jalankan paralel.
  // Mentor data and slot list both need assignment.mentorId, but don't depend
  // on each other -- run in parallel.
  const [mentorDoc, slotsSnap] = await Promise.all([
    db.collection('users').doc(assignment.mentorId).get(),
    db.collection('mentoringSlots')
      .where('classId', '==', actor.classId)
      .where('phase', '==', phase)
      .where('mentorId', '==', assignment.mentorId)
      .get(),
  ]);
  const mentorData = mentorDoc.data() as UserDocument;

  const rawSlots = slotsSnap.docs.map((d) => d.data() as MentoringSlotDocument);
  const slots = rawSlots
    .map((s) => ({
      ...s,
      isMyBooking: s.studentId === actor.uid,
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return {
    assignedMentor: {
      uid: mentorData.uid,
      name: mentorData.name,
      email: mentorData.email,
    },
    quotaUsed,
    maxQuota: MAX_MENTORING_QUOTA,
    slots,
  };
}

/**
 * Siswa membooking slot mentoring secara atomik.
 *
 * Student books a mentoring slot atomically.
 */
export async function bookMentoringSlot(
  actor: Actor,
  input: BookSlotInput
): Promise<{ bookingId: string; meetUrl: string | null }> {
  if (actor.role !== 'student') {
    throw new Error('Hanya siswa yang dapat melakukan booking mentoring');
  }

  const db = getAdminDb();
  const slotRef = db.collection('mentoringSlots').doc(input.slotId);
  const slotDoc = await slotRef.get();

  if (!slotDoc.exists) {
    throw new Error('Slot mentoring tidak ditemukan');
  }

  const slotData = slotDoc.data() as MentoringSlotDocument;

  // 1. Verifikasi assignment mentor / Verify assigned mentor
  const assignment = await getStudentAssignment(actor.uid, slotData.phase);
  const isAssignedMentor = assignment?.mentorId === slotData.mentorId;

  // 2. Verifikasi kuota / Verify quota
  const quotaRef = db.collection('mentoringQuotas').doc(`${actor.uid}_${slotData.phase}`);
  const quotaDoc = await quotaRef.get();
  const currentQuotaUsed = quotaDoc.exists ? (quotaDoc.data()?.count || 0) : 0;

  const eligibility = canBookMentoringSlot({
    currentQuotaUsed,
    isSlotAvailable: slotData.status === 'available',
    isAssignedMentor,
  });

  if (!eligibility.canBook) {
    throw new Error(eligibility.reason);
  }

  // 3. Peringatan konfirmasi minggu pertama untuk sesi ke-2
  // Week 1 advisory check for 2nd session
  const phaseStart = slotData.createdAt ? slotData.createdAt.slice(0, 10) : slotData.date;
  const isEarlySecond = isSecondSessionEarlyWeek(phaseStart, slotData.date, currentQuotaUsed);

  if (isEarlySecond && !input.acknowledgeEarlySecondSession) {
    throw new Error('KONFIRMASI_MINGGU_PERTAMA: Anda sedang mengambil sesi ke-2 di minggu pertama. Idealnya sesi kedua diambil di minggu kedua agar ada jeda implementasi materi.');
  }

  const bookingId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Transaksi atomik booking / Atomic booking transaction
  await db.runTransaction(async (transaction) => {
    const freshSlot = await transaction.get(slotRef);
    if (!freshSlot.exists || freshSlot.data()?.status !== 'available') {
      throw new Error('Slot baru saja diambil oleh peserta lain. Silakan pilih slot lain.');
    }

    const bookingDoc: MentoringBookingDocument = {
      id: bookingId,
      slotId: slotData.id,
      classId: slotData.classId,
      phase: slotData.phase,
      studentId: actor.uid,
      studentName: actor.name,
      mentorId: slotData.mentorId,
      mentorName: slotData.mentorName,
      date: slotData.date,
      startTime: slotData.startTime,
      endTime: slotData.endTime,
      startsAt: slotData.startsAt,
      endsAt: slotData.endsAt,
      meetUrl: null,
      calendarEventId: null,
      status: 'confirmed',
      createdAt: now,
    };

    transaction.set(db.collection('bookings').doc(bookingId), bookingDoc);
    transaction.update(slotRef, {
      status: 'booked',
      bookingId,
      studentId: actor.uid,
      studentName: actor.name,
      updatedAt: now,
    });
    transaction.set(
      quotaRef,
      {
        count: currentQuotaUsed + 1,
        updatedAt: now,
      },
      { merge: true }
    );
  });

  // Event kalender dibuat SESUDAH transaksi, bukan di dalamnya: transaksi
  // Firestore dapat diulang beberapa kali saat terjadi contention, dan setiap
  // pengulangan akan membuat satu event Google baru.
  //
  // The calendar event is created AFTER the transaction, not inside it: a
  // Firestore transaction may be retried under contention, and each retry would
  // create another Google event.
  const meetUrl = await attachCalendarEvent(bookingId, slotData, actor);

  return { bookingId, meetUrl };
}

/**
 * Membuat event Google Calendar untuk sebuah booking dan menyimpan hasilnya.
 *
 * Kegagalan di sini tidak membatalkan booking: slot sudah sah ditempati siswa.
 * Tautan Meet ditandai belum siap dan admin dapat menambahkannya kemudian,
 * karena kehilangan slot lebih merugikan peserta daripada kehilangan tautan.
 *
 * Creates the Google Calendar event for a booking and stores the result.
 *
 * A failure here does not undo the booking: the slot is legitimately held by
 * the student. The Meet link is marked not-ready and an admin can add it later,
 * since losing the slot hurts the participant more than losing the link.
 */
async function attachCalendarEvent(
  bookingId: string,
  slot: MentoringSlotDocument,
  actor: Actor
): Promise<string | null> {
  if (!isCalendarConfigured()) return null;

  const db = getAdminDb();

  try {
    const mentorDoc = await db.collection('users').doc(slot.mentorId).get();
    const mentorEmail = (mentorDoc.data() as UserDocument | undefined)?.email;
    if (!mentorEmail) {
      throw new Error(`Email mentor ${slot.mentorId} tidak ditemukan`);
    }

    const result = await createCalendarEvent({
      bookingId,
      summary: `Mentoring ${slot.phase} - ${actor.name}`,
      description: `Sesi mentoring 1-on-1\nKelas: ${slot.className ?? '-'}\nMentor: ${slot.mentorName}\nPeserta: ${actor.name}`,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      studentEmail: actor.email,
      mentorEmail,
    });

    const updatedAt = new Date().toISOString();
    await Promise.all([
      db.collection('bookings').doc(bookingId).update({
        meetUrl: result.meetUrl,
        calendarEventId: result.eventId,
      }),
      db.collection('mentoringSlots').doc(slot.id).update({
        meetUrl: result.meetUrl,
        calendarEventId: result.eventId,
        updatedAt,
      }),
    ]);

    return result.meetUrl;
  } catch (error) {
    console.error('[mentoring] gagal membuat event kalender', { bookingId, error });
    return null;
  }
}

/**
 * Admin membatalkan booking mentoring (melepaskan slot dan mengembalikan kuota siswa).
 *
 * Admin cancels a mentoring booking (releases slot and restores student quota).
 */
export async function cancelBookingByAdmin(actor: Actor, bookingId: string): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan membatalkan sesi mentoring');
  }

  const db = getAdminDb();
  const bookingRef = db.collection('bookings').doc(bookingId);
  const bookingDoc = await bookingRef.get();

  if (!bookingDoc.exists) {
    throw new Error('Booking tidak ditemukan');
  }

  const booking = bookingDoc.data() as MentoringBookingDocument;
  if (booking.status === 'cancelled') {
    return; // Sudah dibatalkan sebelumnya / Already cancelled
  }

  const now = new Date().toISOString();
  const slotRef = db.collection('mentoringSlots').doc(booking.slotId);
  const quotaRef = db.collection('mentoringQuotas').doc(`${booking.studentId}_${booking.phase}`);

  await db.runTransaction(async (transaction) => {
    // Kuota dibaca lebih dulu: Firestore membatalkan transaksi bila ada
    // pembacaan setelah penulisan pertama, dan sebelumnya pembacaan ini berada
    // di bawah ketiga update.
    //
    // The quota is read first: Firestore aborts a transaction on any read after
    // the first write, and this read previously sat below all three updates.
    const quotaSnap = await transaction.get(quotaRef);

    transaction.update(bookingRef, {
      status: 'cancelled',
      cancelledAt: now,
    });

    // Slot kembali kosong, termasuk tautan Meet-nya: booking berikutnya
    // mendapat conference sendiri. Memakai ulang tautan lama akan membuka
    // detail rapat peserta sebelumnya kepada siswa yang baru.
    //
    // The slot returns to empty, including its Meet link: the next booking gets
    // its own conference. Reusing the old link would expose the previous
    // participant's meeting details to the new student.
    transaction.update(slotRef, {
      status: 'available',
      bookingId: null,
      studentId: null,
      studentName: null,
      meetUrl: null,
      calendarEventId: null,
      updatedAt: now,
    });

    const current = quotaSnap.exists ? (quotaSnap.data()?.count || 1) : 1;
    transaction.update(quotaRef, {
      count: Math.max(0, current - 1),
      updatedAt: now,
    });
  });

  // Pembatalan di Google dilakukan sesudah transaksi agar percobaan ulang
  // transaksi tidak memanggil Google berkali-kali. Kegagalan di sini
  // menyisakan event yatim di kalender, bukan booking yang batal setengah.
  //
  // The Google-side cancellation runs after the transaction so that transaction
  // retries do not call Google repeatedly. A failure here leaves an orphan
  // event on the calendar rather than a half-cancelled booking.
  if (booking.calendarEventId && isCalendarConfigured()) {
    try {
      await cancelCalendarEvent(booking.calendarEventId);
    } catch (error) {
      console.error('[mentoring] gagal membatalkan event kalender', {
        bookingId,
        calendarEventId: booking.calendarEventId,
        error,
      });
    }
  }
}

/**
 * Mentor melihat jadwal sesi bimbingan yang telah dibooking dengannya.
 *
 * Mentor views their booked mentoring sessions schedule.
 */
export async function listMentorSchedule(actor: Actor): Promise<MentoringSlotDocument[]> {
  if (actor.role !== 'mentor' && actor.role !== 'admin') {
    throw new Error('Hanya mentor atau admin yang diizinkan melihat jadwal mentoring');
  }

  const db = getAdminDb();
  const snapshot = await db.collection('mentoringSlots')
    .where('mentorId', '==', actor.uid)
    .where('status', '==', 'booked')
    .get();

  const slots = snapshot.docs.map((d) => d.data() as MentoringSlotDocument);
  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
