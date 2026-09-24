import { describe, expect, it } from 'vitest';
import { isOnlineWindowActive, isSessionAttendanceActive } from '../../src/features/attendance/policy';
import type { SessionDocument } from '../../src/features/attendance/types';

function session(overrides: Partial<SessionDocument> = {}): SessionDocument {
  return {
    id: 's1',
    classId: 'c1',
    title: 'Onboarding',
    date: '2026-09-25',
    startTime: '09:00',
    endTime: '16:00',
    startsAt: '2026-09-25T02:00:00.000Z',
    endsAt: '2026-09-25T09:00:00.000Z',
    mode: 'online',
    zoomUrl: null,
    address: null,
    mapsUrl: null,
    attendanceOverride: 'auto',
    qrRevision: 1,
    attendeeCount: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Jendela presensi daring dulu dipaku 19.00-22.00. Sesi gabungan dan sesi pagi
 * memiliki jam sendiri, sehingga rentang tetap membuat presensinya tidak pernah
 * terbuka secara otomatis dan admin harus membukanya manual setiap kali.
 *
 * The online attendance window used to be fixed at 19:00-22:00. Merged and
 * morning sessions have their own hours, so a fixed range left their attendance
 * never opening on its own, forcing an admin to open it by hand every time.
 */
describe('jendela presensi mengikuti jam sesi', () => {
  it('terbuka pada sesi pagi 09.00-16.00', () => {
    // 05.00 UTC adalah 12.00 WIB, di tengah sesi pagi.
    // 05:00 UTC is 12:00 WIB, in the middle of a morning session.
    expect(isOnlineWindowActive('2026-09-25', '2026-09-25T05:00:00.000Z', '09:00', '16:00')).toBe(true);
  });

  it('tertutup sebelum jam mulai dan pada jam selesai', () => {
    // 01.00 UTC = 08.00 WIB, sebelum mulai.
    expect(isOnlineWindowActive('2026-09-25', '2026-09-25T01:00:00.000Z', '09:00', '16:00')).toBe(false);
    // 09.00 UTC = 16.00 WIB tepat, jendelanya sudah tertutup.
    expect(isOnlineWindowActive('2026-09-25', '2026-09-25T09:00:00.000Z', '09:00', '16:00')).toBe(false);
  });

  it('tetap memakai 19.00-22.00 bila jamnya tidak disebutkan', () => {
    // Pemanggil lama tidak meneruskan jam sesi; nilai bawaannya harus tetap.
    // Older callers pass no session hours; the defaults must hold.
    expect(isOnlineWindowActive('2026-09-25', '2026-09-25T13:00:00.000Z')).toBe(true);
    expect(isOnlineWindowActive('2026-09-25', '2026-09-25T05:00:00.000Z')).toBe(false);
  });

  it('tertutup di luar tanggal sesinya', () => {
    expect(isOnlineWindowActive('2026-09-25', '2026-09-26T05:00:00.000Z', '09:00', '16:00')).toBe(false);
  });
});

describe('buka dan tutup manual', () => {
  it('tutup manual mengalahkan jadwal yang sedang berjalan', () => {
    // Inilah yang dipakai admin untuk menutup presensi di sela siang.
    // This is what an admin uses to close attendance during the midday break.
    const s = session({ attendanceOverride: 'closed' });
    expect(isSessionAttendanceActive(s, '2026-09-25T05:00:00.000Z')).toBe(false);
  });

  it('buka manual mengalahkan jadwal yang sudah lewat', () => {
    // Dan inilah yang dipakai membukanya kembali pada malam hari, di luar jam
    // sesi yang tercatat.
    //
    // And this is what reopens it in the evening, outside the session's
    // recorded hours.
    const s = session({ attendanceOverride: 'open' });
    expect(isSessionAttendanceActive(s, '2026-09-25T14:00:00.000Z')).toBe(true);
  });

  it('keduanya dapat ditukar berulang kali', () => {
    // Pola buka pagi, tutup siang, buka lagi malam menuntut peralihan yang
    // dapat diulang, bukan sekali jalan.
    //
    // A pattern of open in the morning, closed at midday, open again in the
    // evening needs repeatable switching, not a one-way door.
    const pagi = session({ attendanceOverride: 'open' });
    const siang = session({ attendanceOverride: 'closed' });
    const malam = session({ attendanceOverride: 'open' });
    expect(isSessionAttendanceActive(pagi, '2026-09-25T03:00:00.000Z')).toBe(true);
    expect(isSessionAttendanceActive(siang, '2026-09-25T06:00:00.000Z')).toBe(false);
    expect(isSessionAttendanceActive(malam, '2026-09-25T14:00:00.000Z')).toBe(true);
  });

  it('kembali ke auto berarti mengikuti jam sesi lagi', () => {
    const s = session({ attendanceOverride: 'auto' });
    expect(isSessionAttendanceActive(s, '2026-09-25T05:00:00.000Z')).toBe(true);
    expect(isSessionAttendanceActive(s, '2026-09-25T14:00:00.000Z')).toBe(false);
  });

  it('sesi luring tetap tertutup sampai dibuka manual', () => {
    // Kehadiran luring diverifikasi di tempat; membukanya otomatis akan
    // memungkinkan pemindaian dari mana saja selama jam sesi.
    //
    // Offline attendance is verified in person; opening it automatically would
    // allow scanning from anywhere during session hours.
    const s = session({ mode: 'offline', attendanceOverride: 'auto' });
    expect(isSessionAttendanceActive(s, '2026-09-25T05:00:00.000Z')).toBe(false);
  });
});
