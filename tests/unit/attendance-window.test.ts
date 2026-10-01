import { describe, expect, it } from 'vitest';
import {
  isAttendanceWindowActive,
  isSessionAttendanceActive,
  subtractMinutes,
  EARLY_OPEN_MINUTES,
} from '../../src/features/attendance/policy';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
    expect(isAttendanceWindowActive('2026-09-25', '2026-09-25T05:00:00.000Z', '09:00', '16:00')).toBe(true);
  });

  it('tertutup lebih dari setengah jam sebelum mulai, dan pada jam selesai', () => {
    // 01.00 UTC = 08.00 WIB, satu jam sebelum mulai -- masih tertutup.
    // 01:00 UTC is 08:00 WIB, an hour before the start -- still closed.
    expect(isAttendanceWindowActive('2026-09-25', '2026-09-25T01:00:00.000Z', '09:00', '16:00')).toBe(false);
    // 09.00 UTC = 16.00 WIB tepat, jendelanya sudah tertutup.
    expect(isAttendanceWindowActive('2026-09-25', '2026-09-25T09:00:00.000Z', '09:00', '16:00')).toBe(false);
  });

  it('terbuka setengah jam sebelum sesinya mulai', () => {
    // Acaranya mulai tepat pada jamnya, sehingga peserta sudah berdatangan
    // setengah jam sebelumnya dan tidak perlu menunggu di depan QR yang belum
    // berlaku.
    //
    // The event starts exactly on the hour, so participants arrive half an hour
    // early and should not wait in front of a QR that does not work yet.
    //
    // 01.30 UTC = 08.30 WIB, tepat saat jendelanya membuka.
    expect(isAttendanceWindowActive('2026-09-25', '2026-09-25T01:30:00.000Z', '09:00', '16:00')).toBe(true);
    // 01.29 UTC = 08.29 WIB, semenit sebelumnya.
    expect(isAttendanceWindowActive('2026-09-25', '2026-09-25T01:29:00.000Z', '09:00', '16:00')).toBe(false);
  });

  it('tetap memakai 19.00-22.00 bila jamnya tidak disebutkan', () => {
    // Pemanggil lama tidak meneruskan jam sesi; nilai bawaannya harus tetap.
    // Older callers pass no session hours; the defaults must hold.
    expect(isAttendanceWindowActive('2026-09-25', '2026-09-25T13:00:00.000Z')).toBe(true);
    expect(isAttendanceWindowActive('2026-09-25', '2026-09-25T05:00:00.000Z')).toBe(false);
  });

  it('membuka jendela sesi dini hari pada 00.00, bukan hari sebelumnya', () => {
    // Sesi pukul 00.15 dikurangi tiga puluh menit jatuh ke hari sebelumnya,
    // sedangkan perbandingannya memakai tanggal sesi itu sendiri -- jam negatif
    // akan membuat jendelanya tidak pernah terbuka.
    //
    // A 00:15 session minus thirty minutes falls on the previous day, while the
    // comparison uses that session's own date -- a negative time would leave
    // the window never opening.
    expect(subtractMinutes('00:15', EARLY_OPEN_MINUTES)).toBe('00:00');
    expect(isAttendanceWindowActive('2026-09-25', '2026-09-24T17:05:00.000Z', '00:15', '02:00')).toBe(true);
  });

  it('tertutup di luar tanggal sesinya', () => {
    expect(isAttendanceWindowActive('2026-09-25', '2026-09-26T05:00:00.000Z', '09:00', '16:00')).toBe(false);
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

  it('sesi luring memakai jendela yang sama dengan daring', () => {
    // Sebelumnya luring tidak pernah terbuka sendiri, sehingga admin yang lupa
    // membukanya meninggalkan satu kelas penuh tanpa cara mencatat
    // kehadirannya -- dan kelalaian itu baru ketahuan dari keluhan peserta di
    // ruangan.
    //
    // Offline previously never opened on its own, so an admin who forgot left a
    // whole class with no way to record attendance -- and the lapse only
    // surfaced through complaints from the room.
    const s = session({ mode: 'offline', attendanceOverride: 'auto' });
    expect(isSessionAttendanceActive(s, '2026-09-25T05:00:00.000Z')).toBe(true);
    // 08.00 WIB, satu jam sebelum mulai: masih tertutup.
    expect(isSessionAttendanceActive(s, '2026-09-25T01:00:00.000Z')).toBe(false);
  });
});

/**
 * Presensi dibuka setengah jam sebelum sesinya mulai.
 *
 * Acara dimulai tepat pada jamnya, sehingga peserta sudah berdatangan sebelum
 * itu. Tanpa jeda ini mereka menunggu di depan QR yang belum berlaku, lalu
 * memindai berbarengan tepat saat acaranya mulai.
 *
 * Attendance opens half an hour before the session starts.
 *
 * The event begins exactly on the hour, so participants arrive before that.
 * Without this lead they wait in front of a QR that does not work yet, then all
 * scan at once just as the event starts.
 */
describe('pembukaan lebih awal', () => {
  it('memakai jeda tiga puluh menit', () => {
    expect(EARLY_OPEN_MINUTES).toBe(30);
  });

  it('mengurangi jam dengan benar melewati batas jam', () => {
    // 09:00 dikurangi 30 menit jatuh ke jam sebelumnya, bukan ke 09:-30.
    // 09:00 minus 30 minutes falls into the previous hour, not 09:-30.
    expect(subtractMinutes('09:00', 30)).toBe('08:30');
    expect(subtractMinutes('19:00', 30)).toBe('18:30');
    expect(subtractMinutes('13:20', 30)).toBe('12:50');
  });

  it('tidak menghasilkan jam negatif', () => {
    // Jam negatif akan membuat perbandingan leksikalnya selalu gagal, sehingga
    // jendelanya tidak pernah terbuka.
    //
    // A negative time would make the lexical comparison always fail, so the
    // window would never open.
    expect(subtractMinutes('00:10', 30)).toBe('00:00');
    expect(subtractMinutes('00:00', 30)).toBe('00:00');
  });

  it('mengembalikan jam apa adanya bila bentuknya tidak terbaca', () => {
    // Jam yang rusak lebih baik dibiarkan daripada menjadi NaN yang menutup
    // jendelanya diam-diam.
    //
    // A malformed time is better left alone than turned into NaN, which would
    // close the window silently.
    expect(subtractMinutes('', 30)).toBe('');
    expect(subtractMinutes('pagi', 30)).toBe('pagi');
  });
});

describe('tombol daftar hadir', () => {
  it('bertulisan, bukan ikon yang harus ditebak', () => {
    // Papan ujian tidak menyatakan dirinya sebagai daftar hadir, dan ikon yang
    // harus ditebak di samping dua ikon lain membuat admin menekannya satu per
    // satu untuk menemukan yang dicarinya.
    //
    // A clipboard does not announce itself as an attendance list, and an icon
    // to be guessed at beside two others has an admin press each in turn.
    const halaman = readFileSync(
      resolve(process.cwd(), 'src/app/(admin)/admin/jadwal/[classId]/page.tsx'),
      'utf-8'
    );
    expect(halaman).toMatch(/onClick=\{\(\) => setAttendanceSessionId\(session\.id\)\}/);
    expect(halaman).not.toContain('ClipboardCheck');
  });
});
