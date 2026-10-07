// Aturan bisnis slot mentoring, durasi 45 menit, kuota maksimal 2x dan konfirmasi minggu pertama
// Mentoring business policy: 45-min duration, max 2 quota, and week 1 second-session advisory
import type { Phase } from '../assignments/types';
import type { CreateSlotInput } from './types';

export const SLOT_DURATION_MINUTES = 45;
export const MAX_MENTORING_QUOTA = 2;

/**
 * Menghitung jam selesai sesi mentoring dengan menambah 45 menit ke jam mulai.
 *
 * Calculates mentoring session end time by adding 45 minutes to start time.
 */
export function calculateSlotEndTime(startTime: string): string {
  const [hourStr, minStr] = startTime.split(':');
  let hour = parseInt(hourStr, 10);
  let min = parseInt(minStr, 10) + SLOT_DURATION_MINUTES;

  if (min >= 60) {
    hour += Math.floor(min / 60);
    min = min % 60;
  }

  const formattedHour = String(hour).padStart(2, '0');
  const formattedMin = String(min).padStart(2, '0');
  return `${formattedHour}:${formattedMin}`;
}

/**
 * Memvalidasi input pembuatan slot mentoring.
 *
 * Validates mentoring slot creation input.
 */
export function validateSlotInput(input: CreateSlotInput): {
  classId: string;
  phase: Phase;
  mentorId: string;
  date: string;
  startTime: string;
  endTime: string;
} {
  const classId = input.classId ? input.classId.trim() : '';
  const phase = input.phase;
  const mentorId = input.mentorId ? input.mentorId.trim() : '';
  const date = input.date ? input.date.trim() : '';
  const startTime = input.startTime ? input.startTime.trim() : '';

  if (!classId || !mentorId) {
    throw new Error('Mentor wajib dipilih / Mentor is required');
  }

  if (!date || !startTime) {
    throw new Error('Tanggal dan Jam wajib diisi / Date and start time are required');
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(startTime)) {
    throw new Error('Format jam harus HH:mm (contoh 16:00)');
  }

  const endTime = calculateSlotEndTime(startTime);

  return {
    classId,
    phase,
    mentorId,
    date,
    startTime,
    endTime,
  };
}

/**
 * Mendeteksi apakah booking kedua diambil di minggu pertama (7 hari pertama periode fase).
 * Jika ya, sistem menampilkan peringatan konfirmasi agar ada jeda implementasi sebelum sesi kedua.
 *
 * Detects if a 2nd session booking is in week 1, requiring an advisory confirmation.
 */
export function isSecondSessionEarlyWeek(
  phaseStartDateStr: string,
  slotDateStr: string,
  currentBookingCount: number
): boolean {
  // Hanya relevan untuk booking ke-2 (currentBookingCount === 1)
  if (currentBookingCount !== 1) {
    return false;
  }

  const startMs = new Date(phaseStartDateStr).getTime();
  const slotMs = new Date(slotDateStr).getTime();

  if (isNaN(startMs) || isNaN(slotMs)) {
    return false;
  }

  const diffDays = Math.floor((slotMs - startMs) / (24 * 60 * 60 * 1000));
  // Jika masih di dalam 7 hari pertama periode (minggu 1)
  return diffDays >= 0 && diffDays < 7;
}

/**
 * Memvalidasi apakah siswa berhak melakukan booking slot mentoring tertentu.
 *
 * Validates whether student is eligible to book a specific mentoring slot.
 */
export function canBookMentoringSlot(params: {
  currentQuotaUsed: number;
  isSlotAvailable: boolean;
  isAssignedMentor: boolean;
  /** Slot sudah dimulai atau lewat / The slot has started or passed */
  isPast?: boolean;
}): { canBook: boolean; reason?: string } {
  // Diperiksa lebih dulu: slot yang sudah lewat tidak dapat diikuti, apa pun
  // kuota dan statusnya.
  //
  // Checked first: a slot that has passed cannot be attended, whatever the
  // quota and status.
  if (params.isPast) {
    return { canBook: false, reason: 'Jadwal mentoring ini sudah lewat. Silakan pilih slot lain.' };
  }

  if (params.currentQuotaUsed >= MAX_MENTORING_QUOTA) {
    return {
      canBook: false,
      reason: `Kuota mentoring Anda untuk fase ini sudah habis (maksimal ${MAX_MENTORING_QUOTA} kali).`,
    };
  }

  if (!params.isSlotAvailable) {
    return {
      canBook: false,
      reason: 'Slot mentoring ini sudah dibooking oleh peserta lain.',
    };
  }

  if (!params.isAssignedMentor) {
    return {
      canBook: false,
      reason: 'Anda hanya dapat membooking slot dari mentor yang telah ditugaskan kepada Anda.',
    };
  }

  return { canBook: true };
}

/**
 * Menentukan apakah sebuah slot sudah dimulai atau lewat.
 *
 * Diukur dari jam mulainya, bukan jam selesai: sesi yang sedang berjalan
 * pun sudah terlambat untuk dipesan atau dibatalkan.
 *
 * Determines whether a slot has started or passed.
 *
 * Measured from its start time, not its end: a session already running is too
 * late to book or cancel.
 */
export function isSlotPast(startsAt: string, nowIso: string): boolean {
  return startsAt <= nowIso;
}

/**
 * Menentukan apakah peserta boleh membatalkan bookingnya sendiri.
 *
 * Hanya pemilik booking, hanya booking yang masih aktif, dan hanya sebelum
 * sesinya dimulai: membatalkan sesi yang sudah berjalan akan mengembalikan
 * kuota untuk sesi yang sudah dipakai mentor.
 *
 * Determines whether a participant may cancel their own booking.
 *
 * Only the booking's owner, only an active booking, and only before the
 * session starts: cancelling a session already running would return quota for
 * time the mentor already spent.
 */
export function canStudentCancelBooking(params: {
  bookingStudentId: string;
  actorId: string;
  status: 'confirmed' | 'cancelled';
  startsAt: string;
  nowIso: string;
}): { canCancel: boolean; reason?: string } {
  if (params.bookingStudentId !== params.actorId) {
    return { canCancel: false, reason: 'Anda hanya dapat membatalkan booking milik sendiri.' };
  }
  if (params.status === 'cancelled') {
    return { canCancel: false, reason: 'Booking ini sudah dibatalkan.' };
  }
  if (isSlotPast(params.startsAt, params.nowIso)) {
    return { canCancel: false, reason: 'Sesi sudah dimulai atau lewat sehingga tidak dapat dibatalkan.' };
  }
  return { canCancel: true };
}
