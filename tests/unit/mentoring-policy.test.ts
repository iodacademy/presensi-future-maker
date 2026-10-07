import { describe, it, expect } from 'vitest';
import {
  calculateSlotEndTime,
  validateSlotInput,
  isSecondSessionEarlyWeek,
  canBookMentoringSlot,
  SLOT_DURATION_MINUTES,
  MAX_MENTORING_QUOTA,
  isSlotPast,
  canStudentCancelBooking,
} from '../../src/features/mentoring/policy';

describe('Mentoring Policy', () => {
  it('calculates 45-minute slot end time correctly', () => {
    expect(calculateSlotEndTime('16:00')).toBe('16:45');
    expect(calculateSlotEndTime('10:15')).toBe('11:00');
    expect(calculateSlotEndTime('14:30')).toBe('15:15');
  });

  it('validates slot creation input', () => {
    expect(() =>
      validateSlotInput({
        classId: 'c1',
        phase: 'bootcamp',
        mentorId: '',
        date: '2026-09-11',
        startTime: '16:00',
      })
    ).toThrowError(/Mentor wajib dipilih/);

    expect(() =>
      validateSlotInput({
        classId: 'c1',
        phase: 'bootcamp',
        mentorId: 'm1',
        date: '',
        startTime: '16:00',
      })
    ).toThrowError(/Tanggal dan Jam wajib diisi/);

    const valid = validateSlotInput({
      classId: 'c1',
      phase: 'bootcamp',
      mentorId: 'm1',
      date: '2026-09-11',
      startTime: '16:00',
    });
    expect(valid.startTime).toBe('16:00');
    expect(valid.endTime).toBe('16:45');
  });

  it('detects second booking in week 1 requiring advisory confirmation', () => {
    const phaseStart = '2026-09-01'; // Hari ke-1 periode / Day 1

    // Booking pertama (kuota terpakai = 0) -> tidak perlu peringatan
    expect(isSecondSessionEarlyWeek(phaseStart, '2026-09-03', 0)).toBe(false);

    // Booking kedua (kuota terpakai = 1) di hari ke-4 (minggu 1) -> butuh peringatan
    expect(isSecondSessionEarlyWeek(phaseStart, '2026-09-04', 1)).toBe(true);

    // Booking kedua (kuota terpakai = 1) di hari ke-10 (minggu 2) -> tidak butuh peringatan
    expect(isSecondSessionEarlyWeek(phaseStart, '2026-09-11', 1)).toBe(false);
  });

  it('checks booking eligibility and quota limits', () => {
    // Kuota habis (sudah 2 sesi) / Quota exhausted
    expect(
      canBookMentoringSlot({
        currentQuotaUsed: 2,
        isSlotAvailable: true,
        isAssignedMentor: true,
      }).canBook
    ).toBe(false);

    // Slot sudah diambil orang lain / Slot already booked
    expect(
      canBookMentoringSlot({
        currentQuotaUsed: 1,
        isSlotAvailable: false,
        isAssignedMentor: true,
      }).canBook
    ).toBe(false);

    // Bukan mentor yang di-assign / Not assigned mentor
    expect(
      canBookMentoringSlot({
        currentQuotaUsed: 1,
        isSlotAvailable: true,
        isAssignedMentor: false,
      }).canBook
    ).toBe(false);

    // Berhak booking / Eligible
    expect(
      canBookMentoringSlot({
        currentQuotaUsed: 0,
        isSlotAvailable: true,
        isAssignedMentor: true,
      }).canBook
    ).toBe(true);
  });

  it('verifies slot constants', () => {
    expect(SLOT_DURATION_MINUTES).toBe(45);
    expect(MAX_MENTORING_QUOTA).toBe(2);
  });
});

describe('jadwal mentoring yang sudah lewat', () => {
  const now = '2026-10-07T10:00:00.000Z';

  it('menganggap slot yang sudah dimulai sebagai lewat', () => {
    expect(isSlotPast('2026-10-07T09:00:00.000Z', now)).toBe(true);
    expect(isSlotPast(now, now)).toBe(true);
    expect(isSlotPast('2026-10-08T09:00:00.000Z', now)).toBe(false);
  });

  it('menolak booking slot yang sudah lewat meski kuota dan slotnya tersedia', () => {
    const r = canBookMentoringSlot({ currentQuotaUsed: 0, isSlotAvailable: true, isAssignedMentor: true, isPast: true });
    expect(r.canBook).toBe(false);
    expect(r.reason).toMatch(/sudah lewat/);
  });
});

describe('pembatalan booking oleh peserta', () => {
  const base = { bookingStudentId: 'u1', actorId: 'u1', status: 'confirmed' as const, startsAt: '2026-10-08T09:00:00.000Z', nowIso: '2026-10-07T10:00:00.000Z' };

  it('mengizinkan pemilik membatalkan sebelum sesi dimulai', () => {
    expect(canStudentCancelBooking(base).canCancel).toBe(true);
  });

  it('menolak booking milik orang lain, yang sudah batal, atau yang sudah dimulai', () => {
    expect(canStudentCancelBooking({ ...base, actorId: 'u2' }).canCancel).toBe(false);
    expect(canStudentCancelBooking({ ...base, status: 'cancelled' }).canCancel).toBe(false);
    expect(canStudentCancelBooking({ ...base, startsAt: '2026-10-07T09:00:00.000Z' }).canCancel).toBe(false);
  });
});
