import { describe, it, expect } from 'vitest';
import {
  calculateSlotEndTime,
  validateSlotInput,
  isSecondSessionEarlyWeek,
  canBookMentoringSlot,
  SLOT_DURATION_MINUTES,
  MAX_MENTORING_QUOTA,
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
