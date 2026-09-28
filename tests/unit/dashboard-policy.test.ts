import { describe, it, expect } from 'vitest';
import {
  isDeadlineUrgent,
  formatDeadlineLabel,
  formatProgressRatio,
} from '../../src/features/dashboard/policy';

describe('Dashboard Home Policy', () => {
  it('detects urgent deadline within 24 hours', () => {
    const now = new Date('2026-09-10T10:00:00.000Z').getTime();

    // 12 jam ke depan -> Urgent
    const in12Hours = new Date('2026-09-10T22:00:00.000Z').toISOString();
    expect(isDeadlineUrgent(in12Hours, now)).toBe(true);

    // 48 jam ke depan -> Tidak urgent
    const in48Hours = new Date('2026-09-12T10:00:00.000Z').toISOString();
    expect(isDeadlineUrgent(in48Hours, now)).toBe(false);

    // Sudah lewat -> Tidak urgent (terlambat)
    const passed = new Date('2026-09-09T10:00:00.000Z').toISOString();
    expect(isDeadlineUrgent(passed, now)).toBe(false);

    expect(isDeadlineUrgent(null, now)).toBe(false);
  });

  it('formats deadline badge label', () => {
    // dueAt kini ISO UTC, bukan teks bebas seperti "30 September". Label lama
    // mencetaknya apa adanya, sehingga peserta membaca
    // "DEADLINE: 2026-09-28T16:59:00.000Z".
    //
    // dueAt is now ISO UTC, not free text such as "30 September". The old
    // label printed it as is, so participants read
    // "DEADLINE: 2026-09-28T16:59:00.000Z".
    expect(formatDeadlineLabel(false, '2026-09-28T16:59:00.000Z')).toBe('DEADLINE 28 Sep 2026, 23.59 WIB');
    expect(formatDeadlineLabel(true, '2026-09-28T16:59:00.000Z')).toBe('DEADLINE SEGERA - 28 Sep 2026, 23.59 WIB');
    expect(formatDeadlineLabel(false, null)).toBe('TANPA BATAS WAKTU');
  });

  it('tidak pernah membocorkan format ISO ke label', () => {
    // Satu huruf T di antara tanggal dan jam adalah tandanya.
    // A lone T between the date and the time is the giveaway.
    for (const urgent of [true, false]) {
      expect(formatDeadlineLabel(urgent, '2026-09-28T16:59:00.000Z')).not.toMatch(/\dT\d/);
    }
  });

  it('formats progress ratios safely with fallback for zero divisor', () => {
    expect(formatProgressRatio(18, 20)).toBe('18/20');
    expect(formatProgressRatio(3, 4)).toBe('3/4');
    expect(formatProgressRatio(0, 0)).toBe('0/0');
  });
});
