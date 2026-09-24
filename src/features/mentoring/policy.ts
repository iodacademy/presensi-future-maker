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
}): { canBook: boolean; reason?: string } {
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
