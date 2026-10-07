// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pickFocusSessionId } from '../../src/features/attendance/focus-session';

// Pertemuan 4 tanggal 7 pukul 19.00-22.00 WIB, pertemuan 5 tanggal 8.
// Meeting 4 on the 7th at 19:00-22:00 WIB, meeting 5 on the 8th.
const sessions = [
  { id: 'p5', startsAt: '2026-10-08T12:00:00.000Z', endsAt: '2026-10-08T15:00:00.000Z' },
  { id: 'p3', startsAt: '2026-10-05T12:00:00.000Z', endsAt: '2026-10-05T15:00:00.000Z' },
  { id: 'p4', startsAt: '2026-10-07T12:00:00.000Z', endsAt: '2026-10-07T15:00:00.000Z' },
];

describe('pertemuan yang dibuka pertama di jadwal', () => {
  it('membuka pertemuan yang jamnya sedang berjalan', () => {
    expect(pickFocusSessionId(sessions, '2026-10-07T13:00:00.000Z')).toBe('p4');
  });

  it('membuka pertemuan berikutnya yang paling dekat bila tidak ada yang berjalan', () => {
    // Siang tanggal 7, sebelum pertemuan 4 dimulai.
    // Midday on the 7th, before meeting 4 starts.
    expect(pickFocusSessionId(sessions, '2026-10-07T05:00:00.000Z')).toBe('p4');
    // Malam tanggal 7 setelah pertemuan 4 selesai: pertemuan 5 besok.
    // The night of the 7th after meeting 4 ends: meeting 5 tomorrow.
    expect(pickFocusSessionId(sessions, '2026-10-07T16:00:00.000Z')).toBe('p5');
  });

  it('membuka pertemuan terakhir bila semuanya sudah lewat', () => {
    expect(pickFocusSessionId(sessions, '2026-12-01T00:00:00.000Z')).toBe('p5');
  });

  it('mengembalikan null bila belum ada pertemuan', () => {
    expect(pickFocusSessionId([], '2026-10-07T00:00:00.000Z')).toBeNull();
  });
});
