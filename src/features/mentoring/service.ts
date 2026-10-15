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
  MentorScheduleSlot,
  NumberedSlot,
} from './types';
import type { Phase } from '../assignments/types';
import type { ClassDocument } from '../classes/types';
import {
  validateSlotInput,
  canBookMentoringSlot,
  isSecondSessionEarlyWeek,
  MAX_MENTORING_QUOTA,
  isSlotPast,
  canStudentCancelBooking,
} from './policy';
import { getStudentAssignment } from '../assignments/service';
import { sessionNumbers } from './progress';
import { DISABILITY_LABELS, ENTRY_STATUS_LABELS, GENDER_LABELS, type StudentProfileDocument } from '../users/profile-types';
import { ageFrom } from '../users/profile-service';
import {
  createCalendarEvent,
  refreshMeetSpace,
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
  const nowIso = new Date().toISOString();
  // Peserta hanya menerima slot yang masih dapat dipilih dan booking miliknya
  // sendiri. Slot yang dibooking peserta lain memuat nama dan tautan Meet
  // orang itu; menyembunyikannya di tampilan saja tetap membiarkannya
  // terbaca dari peramban.
  //
  // A participant receives only slots still open to pick and their own
  // bookings. A slot booked by someone else carries that person's name and
  // Meet link; hiding it in the view alone would leave it readable in the
  // browser.
  const slots = rawSlots
    .filter((s) => s.studentId === actor.uid || (s.status === 'available' && !isSlotPast(s.startsAt, nowIso)))
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
    isPast: isSlotPast(slotData.startsAt, new Date().toISOString()),
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
  student: { name: string; email: string }
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
      summary: `Mentoring ${slot.phase} - ${student.name}`,
      description: `Sesi mentoring 1-on-1\nKelas: ${slot.className ?? '-'}\nMentor: ${slot.mentorName}\nPeserta: ${student.name}`,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      studentEmail: student.email,
      mentorEmail,
    });

    // Ditulis hanya bila booking masih aktif dan slot masih miliknya. Membuat
    // event dapat memakan hingga 45 detik; bila dalam jeda itu booking dibatalkan
    // dan slotnya diambil peserta lain, menulis tanpa memeriksa akan memasang
    // tautan Meet peserta pertama pada slot peserta kedua, dan undangan pertama
    // tertinggal tanpa pernah dibatalkan.
    //
    // Written only while the booking is still active and the slot still belongs
    // to it. Creating the event can take up to 45 seconds; if the booking is
    // cancelled and the slot taken by someone else in that gap, writing without
    // checking would put the first participant's Meet link on the second
    // participant's slot, and the first invitation would linger, never cancelled.
    const bookingRef = db.collection('bookings').doc(bookingId);
    const slotRef = db.collection('mentoringSlots').doc(slot.id);
    const stillMine = await db.runTransaction(async (tx) => {
      const [bookingSnap, slotSnap] = await Promise.all([tx.get(bookingRef), tx.get(slotRef)]);
      const booking = bookingSnap.data() as MentoringBookingDocument | undefined;
      const current = slotSnap.data() as MentoringSlotDocument | undefined;
      // Event yang sudah tercatat berarti percobaan lain mendahului; event kedua
      // hanya akan menjadi undangan ganda.
      // An already-recorded event means another attempt got there first; a
      // second event would only be a duplicate invitation.
      if (booking?.status !== 'confirmed' || booking.calendarEventId || current?.bookingId !== bookingId) return false;

      tx.update(bookingRef, { meetUrl: result.meetUrl, calendarEventId: result.eventId });
      tx.update(slotRef, { meetUrl: result.meetUrl, calendarEventId: result.eventId, updatedAt: new Date().toISOString() });
      return true;
    });

    if (!stillMine) {
      await cancelCalendarEvent(result.eventId);
      return null;
    }
    return result.meetUrl;
  } catch (error) {
    console.error('[mentoring] gagal membuat event kalender', { bookingId, error });
    return null;
  }
}

/**
 * Admin membuat ulang event kalender untuk booking yang belum punya tautan
 * Meet, misalnya karena dibooking sebelum kalender tersambung atau karena
 * jembatan Apps Script kehabisan waktu.
 *
 * An admin recreates the calendar event for a booking without a Meet link,
 * e.g. booked before the calendar was connected or after the Apps Script
 * bridge timed out.
 */
export async function retryBookingCalendarEvent(actor: Actor, bookingId: string): Promise<string> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang dapat membuat ulang link Meet');
  }
  if (!isCalendarConfigured()) {
    throw new Error('Google Calendar belum dikonfigurasi');
  }

  const db = getAdminDb();
  const bookingDoc = await db.collection('bookings').doc(bookingId).get();
  const booking = bookingDoc.data() as MentoringBookingDocument | undefined;
  if (!booking || booking.status !== 'confirmed') {
    throw new Error('Booking tidak ditemukan atau sudah dibatalkan');
  }
  if (booking.meetUrl) return booking.meetUrl;

  const [slotDoc, studentDoc] = await Promise.all([
    db.collection('mentoringSlots').doc(booking.slotId).get(),
    db.collection('users').doc(booking.studentId).get(),
  ]);
  const slot = slotDoc.data() as MentoringSlotDocument | undefined;
  const studentEmail = (studentDoc.data() as UserDocument | undefined)?.email;
  if (!slot || !studentEmail) {
    throw new Error('Data slot atau email peserta tidak ditemukan');
  }

  const meetUrl = await attachCalendarEvent(bookingId, slot, { name: booking.studentName, email: studentEmail });
  if (!meetUrl) {
    throw new Error('Google Calendar belum berhasil membuat link Meet. Coba lagi beberapa saat lagi.');
  }
  return meetUrl;
}

/**
 * Admin memperbarui ruang Meet sebuah booking yang akan datang agar mentornya
 * menjadi co-host, untuk booking yang dibuat sebelum fitur itu ada.
 *
 * Event kalendernya diperbarui di tempat tanpa email: mentor dan peserta
 * melihat tautan baru di kalender dan aplikasi tanpa menerima undangan atau
 * pembatalan yang membingungkan.
 *
 * An admin refreshes an upcoming booking's Meet space so its mentor becomes
 * co-host, for bookings made before that feature existed.
 *
 * The calendar event is updated in place without email: the mentor and
 * participant see the new link in their calendar and the app without
 * receiving a confusing invitation or cancellation.
 */
export async function refreshBookingMeet(actor: Actor, bookingId: string): Promise<string> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang dapat memperbarui link Meet');
  }
  if (!isCalendarConfigured()) {
    throw new Error('Google Calendar belum dikonfigurasi');
  }

  const db = getAdminDb();
  const bookingRef = db.collection('bookings').doc(bookingId);
  const booking = (await bookingRef.get()).data() as MentoringBookingDocument | undefined;
  if (!booking || booking.status !== 'confirmed') {
    throw new Error('Booking tidak ditemukan atau sudah dibatalkan');
  }
  if (booking.endsAt <= new Date().toISOString()) {
    throw new Error('Sesi ini sudah selesai');
  }
  if (!booking.calendarEventId) {
    throw new Error('Booking ini belum punya undangan kalender. Pakai tombol Buat link Meet.');
  }

  const [mentorDoc, studentDoc] = await Promise.all([
    db.collection('users').doc(booking.mentorId).get(),
    db.collection('users').doc(booking.studentId).get(),
  ]);
  const mentorEmail = (mentorDoc.data() as UserDocument | undefined)?.email;
  const studentEmail = (studentDoc.data() as UserDocument | undefined)?.email;
  if (!mentorEmail || !studentEmail) {
    throw new Error('Email mentor atau peserta tidak ditemukan');
  }

  let meetUrl: string;
  try {
    ({ meetUrl } = await refreshMeetSpace({ eventId: booking.calendarEventId, mentorEmail, studentEmail }));
  } catch (err) {
    // Biasanya karena jembatan Apps Script belum diperbarui ke versi Meet API.
    // Usually because the Apps Script bridge is not yet updated to the Meet API version.
    throw new Error(`Gagal memperbarui link Meet: ${(err as Error).message}`);
  }

  // Ditulis hanya bila booking masih aktif dan masih memakai event yang sama.
  // Written only while the booking is still active and on the same event.
  const slotRef = db.collection('mentoringSlots').doc(booking.slotId);
  await db.runTransaction(async (tx) => {
    const [b, sl] = await Promise.all([tx.get(bookingRef), tx.get(slotRef)]);
    const fresh = b.data() as MentoringBookingDocument | undefined;
    if (fresh?.status !== 'confirmed' || fresh.calendarEventId !== booking.calendarEventId) {
      throw new Error('Booking berubah saat link diperbarui. Muat ulang halaman lalu coba lagi.');
    }
    tx.update(bookingRef, { meetUrl });
    if ((sl.data() as MentoringSlotDocument | undefined)?.bookingId === bookingId) {
      tx.update(slotRef, { meetUrl, updatedAt: new Date().toISOString() });
    }
  });
  return meetUrl;
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
  await releaseBooking(bookingId, () => null);
}

/**
 * Peserta membatalkan bookingnya sendiri sebelum sesi dimulai. Slot kembali
 * tersedia, kuotanya dikembalikan, dan event Google Calendar-nya dihapus --
 * sama seperti pembatalan oleh admin.
 *
 * A participant cancels their own booking before the session starts. The slot
 * becomes available again, the quota is returned, and its Google Calendar
 * event is removed -- the same as an admin cancellation.
 */
export async function cancelBookingByStudent(actor: Actor, bookingId: string): Promise<void> {
  if (actor.role !== 'student') {
    throw new Error('Hanya peserta yang dapat membatalkan booking miliknya');
  }
  await releaseBooking(bookingId, (booking) => {
    const check = canStudentCancelBooking({
      bookingStudentId: booking.studentId,
      actorId: actor.uid,
      status: booking.status,
      startsAt: booking.startsAt,
      nowIso: new Date().toISOString(),
    });
    return check.canCancel ? null : check.reason ?? 'Booking tidak dapat dibatalkan';
  });
}

/**
 * Melepaskan satu booking: booking ditandai batal, slot kembali kosong, kuota
 * dikembalikan, lalu event kalendernya dihapus.
 *
 * `reject` diperiksa di dalam transaksi terhadap data terbaru, sehingga dua
 * pembatalan yang hampir bersamaan tidak mengembalikan kuota dua kali.
 *
 * Releases one booking: the booking is marked cancelled, the slot returns to
 * empty, the quota is returned, then its calendar event is removed.
 *
 * `reject` is checked inside the transaction against the latest data, so two
 * near-simultaneous cancellations never return the quota twice.
 */
async function releaseBooking(
  bookingId: string,
  reject: (booking: MentoringBookingDocument) => string | null
): Promise<void> {
  const db = getAdminDb();
  const bookingRef = db.collection('bookings').doc(bookingId);
  const now = new Date().toISOString();

  const released = await db.runTransaction(async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) {
      throw new Error('Booking tidak ditemukan');
    }
    const booking = bookingSnap.data() as MentoringBookingDocument;
    const reason = reject(booking);
    if (reason) throw new Error(reason);
    if (booking.status === 'cancelled') {
      return null; // Sudah dibatalkan sebelumnya / Already cancelled
    }

    const slotRef = db.collection('mentoringSlots').doc(booking.slotId);
    const quotaRef = db.collection('mentoringQuotas').doc(`${booking.studentId}_${booking.phase}`);
    // Kuota dibaca lebih dulu: Firestore membatalkan transaksi bila ada
    // pembacaan setelah penulisan pertama.
    //
    // The quota is read first: Firestore aborts a transaction on any read after
    // the first write.
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
    return booking;
  });

  // Pembatalan di Google dilakukan sesudah transaksi agar percobaan ulang
  // transaksi tidak memanggil Google berkali-kali. Kegagalan di sini
  // menyisakan event yatim di kalender, bukan booking yang batal setengah.
  //
  // The Google-side cancellation runs after the transaction so that transaction
  // retries do not call Google repeatedly. A failure here leaves an orphan
  // event on the calendar rather than a half-cancelled booking.
  if (released?.calendarEventId && isCalendarConfigured()) {
    try {
      await cancelCalendarEvent(released.calendarEventId);
    } catch (error) {
      console.error('[mentoring] gagal membatalkan event kalender', {
        bookingId,
        calendarEventId: released.calendarEventId,
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
export async function listMentorSchedule(actor: Actor): Promise<MentorScheduleSlot[]> {
  if (actor.role !== 'mentor' && actor.role !== 'admin') {
    throw new Error('Hanya mentor atau admin yang diizinkan melihat jadwal mentoring');
  }

  const db = getAdminDb();
  const snapshot = await db.collection('mentoringSlots')
    .where('mentorId', '==', actor.uid)
    .where('status', '==', 'booked')
    .get();

  const slots = snapshot.docs.map((d) => d.data() as MentoringSlotDocument);
  const studentIds = slots.map((s) => s.studentId ?? '').filter(Boolean);

  // Nomor WhatsApp ikut dikirim agar tombol Hubungi Peserta langsung bekerja di
  // kartunya. Hanya peserta yang membooking mentor ini, yaitu peserta yang
  // memang boleh ia hubungi.
  //
  // The WhatsApp number is sent along so the Contact button works straight from
  // the card. Only participants who booked this mentor, i.e. those they may
  // contact anyway.
  const [numbers, profileSnaps] = await Promise.all([
    numberedPhaseSessions(slots, studentIds),
    studentIds.length > 0
      ? db.getAll(...studentIds.map((id) => db.collection('studentProfiles').doc(id)), { fieldMask: ['phone'] })
      : Promise.resolve([]),
  ]);
  const phones = new Map(profileSnaps.map((p) => [p.id, (p.data()?.phone as string | undefined) ?? null]));

  return slots
    .map((s) => ({
      ...s,
      sessionNumber: s.bookingId ? numbers.get(s.bookingId) ?? null : null,
      studentPhone: s.studentId ? phones.get(s.studentId) ?? null : null,
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * Nomor sesi tiap slot terbooking. Slot dapat berasal dari dua fase, jadi
 * penomorannya dihitung per fase.
 *
 * The session number of each booked slot. Slots can span two phases, so the
 * numbering is computed per phase.
 */
async function numberedPhaseSessions(slots: MentoringSlotDocument[], studentIds: string[]): Promise<Map<string, number>> {
  const phases = [...new Set(slots.map((s) => s.phase))];
  const maps = await Promise.all(phases.map((p) => sessionNumbers(studentIds, p)));
  return new Map(maps.flatMap((m) => [...m]));
}

/**
 * Slot sebuah kelas dengan nomor sesi pada slot yang terbooking.
 *
 * A class's slots with the session number on the booked ones.
 */
export async function listNumberedSlotsForClass(classId: string, phase: Phase): Promise<NumberedSlot[]> {
  const slots = await listSlotsForClass(classId, phase);
  const numbers = await sessionNumbers(slots.map((s) => s.studentId ?? '').filter(Boolean), phase);
  return slots.map((s) => ({ ...s, sessionNumber: s.bookingId ? numbers.get(s.bookingId) ?? null : null }));
}

/**
 * Peserta termasuk bimbingan seorang mentor bila ditugaskan kepadanya atau
 * sedang membooking slotnya. Booking ikut dihitung karena penugasan dapat
 * dipindah admin setelah peserta membooking, sementara sesinya tetap berjalan.
 *
 * A participant is a mentor's mentee when assigned to them or holding one of
 * their slots. Bookings count too because an admin may move the assignment
 * after the participant booked, while the session still goes ahead.
 */
export async function isMenteeOf(mentorId: string, studentId: string): Promise<boolean> {
  const db = getAdminDb();
  const [assigned, booked] = await Promise.all([
    db.collection('assignments').where('mentorId', '==', mentorId).where('studentId', '==', studentId).limit(1).select().get(),
    db.collection('mentoringSlots').where('mentorId', '==', mentorId).where('studentId', '==', studentId).limit(1).select().get(),
  ]);
  return !assigned.empty || !booked.empty;
}

export interface MenteeProfile {
  uid: string;
  name: string;
  email: string;
  className: string;
  phone: string | null;
  age: number | null;
  gender: string | null;
  entryStatus: string | null;
  disability: string | null;
}

/**
 * Profil peserta untuk mentornya, agar mentor dapat menghubungi dan
 * mengingatkan peserta sebelum sesi.
 *
 * Hanya dibuka bagi mentor yang memang dibooking peserta itu. Profil memuat
 * nomor WhatsApp dan status disabilitas; mentor lain tidak punya alasan
 * melihatnya, dan studentId di URL mudah diganti.
 *
 * A participant's profile for their mentor, so the mentor can contact and
 * remind the participant before the session.
 *
 * Opened only to a mentor the participant actually booked. The profile holds a
 * WhatsApp number and a disability status; other mentors have no reason to see
 * it, and the studentId in the URL is easy to swap.
 */
export async function getMenteeProfile(actor: Actor, studentId: string): Promise<MenteeProfile> {
  if (actor.role !== 'mentor' && actor.role !== 'admin') {
    throw new Error('Hanya mentor atau admin yang diizinkan melihat profil peserta');
  }

  const db = getAdminDb();
  if (actor.role === 'mentor' && !(await isMenteeOf(actor.uid, studentId))) {
    throw new Error('Peserta ini bukan peserta bimbingan Anda');
  }

  const [userSnap, profileSnap] = await Promise.all([
    db.collection('users').doc(studentId).get(),
    db.collection('studentProfiles').doc(studentId).get(),
  ]);
  const user = userSnap.data() as UserDocument | undefined;
  if (!user) throw new Error('Peserta tidak ditemukan');

  const kelas = user.classId ? (await db.collection('classes').doc(user.classId).get()).data() as ClassDocument | undefined : undefined;
  const profile = profileSnap.exists ? (profileSnap.data() as StudentProfileDocument) : null;

  return {
    uid: studentId,
    name: user.name,
    email: user.email,
    className: kelas?.canonicalName ?? '',
    phone: profile?.phone ?? null,
    age: profile ? ageFrom(profile.birthDate) : null,
    gender: profile ? GENDER_LABELS[profile.gender] ?? profile.gender : null,
    entryStatus: profile ? ENTRY_STATUS_LABELS[profile.entryStatus] ?? profile.entryStatus : null,
    disability: profile
      ? profile.disability === 'lainnya' && profile.disabilityNote
        ? `Lainnya: ${profile.disabilityNote}`
        : DISABILITY_LABELS[profile.disability] ?? profile.disability
      : null,
  };
}
