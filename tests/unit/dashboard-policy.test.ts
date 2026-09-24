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
    expect(formatDeadlineLabel(true, '23:59')).toBe('DEADLINE SEGERA (23:59)');
    expect(formatDeadlineLabel(false, '30 September')).toBe('DEADLINE: 30 September');
    expect(formatDeadlineLabel(false, null)).toBe('TUGAS MANDIRI');
  });

  it('formats progress ratios safely with fallback for zero divisor', () => {
    expect(formatProgressRatio(18, 20)).toBe('18/20');
    expect(formatProgressRatio(3, 4)).toBe('3/4');
    expect(formatProgressRatio(0, 0)).toBe('0/0');
  });
});
