import { describe, it, expect } from 'vitest';
import {
  validateSessionInput,
  isOnlineWindowActive,
  isSessionAttendanceActive,
} from '../../src/features/attendance/policy';
import {
  generateQrToken,
  verifyQrToken,
} from '../../src/features/attendance/qr';

describe('Attendance Policy', () => {
  it('validates manual session creation input for online mode', () => {
    // Online tanpa link zoom diterima: jadwal umumnya disusun jauh sebelum
    // tautan rapatnya terbit, dan mewajibkannya memaksa admin mengisi nilai
    // karangan yang kemudian harus dibersihkan.
    //
    // Online without a zoom link is accepted: schedules are usually drawn up
    // well before the meeting link exists, and requiring it forces admins to
    // enter a made-up value they must clean up later.
    const onlineTanpaZoom = validateSessionInput({
      classId: 'c1',
      title: 'React Fundamentals',
      date: '2026-09-10',
      startTime: '19:00',
      endTime: '22:00',
      mode: 'online',
      zoomUrl: '',
    });
    expect(onlineTanpaZoom.zoomUrl).toBeNull();

    // Tautan yang diisi tetap wajib HTTPS / A link that is present must still be HTTPS
    expect(() =>
      validateSessionInput({
        classId: 'c1',
        title: 'React Fundamentals',
        date: '2026-09-10',
        startTime: '19:00',
        endTime: '22:00',
        mode: 'online',
        zoomUrl: 'http://zoom.us/j/123',
      })
    ).toThrowError(/Link Zoom harus berupa URL HTTPS/);

    // Online valid
    const validOnline = validateSessionInput({
      classId: 'c1',
      title: ' React Fundamentals ',
      date: '2026-09-10',
      startTime: '19:00',
      endTime: '22:00',
      mode: 'online',
      zoomUrl: 'https://zoom.us/j/1234567890',
    });
    expect(validOnline.title).toBe('React Fundamentals');
    expect(validOnline.zoomUrl).toBe('https://zoom.us/j/1234567890');
  });

  it('validates manual session creation input for offline mode', () => {
    // Offline tanpa alamat / Offline without address
    expect(() =>
      validateSessionInput({
        classId: 'c1',
        title: 'Workshop Offline',
        date: '2026-09-11',
        startTime: '09:00',
        endTime: '12:00',
        mode: 'offline',
        address: '',
      })
    ).toThrowError(/Sesi Offline wajib menyertakan Alamat dan Link Maps/);

    // Offline valid
    const validOffline = validateSessionInput({
      classId: 'c1',
      title: 'UI/UX Workshop',
      date: '2026-09-11',
      startTime: '09:00',
      endTime: '12:00',
      mode: 'offline',
      address: 'Kampus Semarang, Gedung B',
      mapsUrl: 'https://maps.google.com/?q=semarang',
    });
    expect(validOffline.address).toBe('Kampus Semarang, Gedung B');
  });

  it('validates time order (endTime must be after startTime)', () => {
    expect(() =>
      validateSessionInput({
        classId: 'c1',
        title: 'Error Time',
        date: '2026-09-10',
        startTime: '20:00',
        endTime: '19:00',
        mode: 'online',
        zoomUrl: 'https://zoom.us/j/123',
      })
    ).toThrowError(/Jam selesai harus lebih akhir dari jam mulai/);
  });

  it('checks online attendance window [19:00, 22:00) WIB', () => {
    const sessionDate = '2026-09-10';

    // 18:59:59 WIB pada hari yang sama -> false
    expect(isOnlineWindowActive(sessionDate, '2026-09-10T18:59:59+07:00')).toBe(false);

    // 19:00:00 WIB -> true
    expect(isOnlineWindowActive(sessionDate, '2026-09-10T19:00:00+07:00')).toBe(true);

    // 21:59:59 WIB -> true
    expect(isOnlineWindowActive(sessionDate, '2026-09-10T21:59:59+07:00')).toBe(true);

    // 22:00:00 WIB -> false (otomatis tutup)
    expect(isOnlineWindowActive(sessionDate, '2026-09-10T22:00:00+07:00')).toBe(false);

    // Tanggal berbeda -> false
    expect(isOnlineWindowActive(sessionDate, '2026-09-11T19:30:00+07:00')).toBe(false);
  });

  it('generates and verifies 30-second rotating QR token', () => {
    const sessionId = 'session-456';
    const secret = 'secret-key-test-123';
    const revision = 1;
    const nowMs = 1757500000000;

    const token = generateQrToken(sessionId, revision, secret, nowMs);
    expect(token).toBeDefined();

    // Verifikasi pada detik ke-10 (masih valid) / Verified at 10s (still valid)
    const result1 = verifyQrToken(token, sessionId, revision, secret, nowMs + 10000);
    expect(result1.isValid).toBe(true);

    // Verifikasi pada detik ke-35 (kedaluwarsa) / Verified at 35s (expired)
    const result2 = verifyQrToken(token, sessionId, revision, secret, nowMs + 35000);
    expect(result2.isValid).toBe(false);
    expect(result2.reason).toMatch(/Token QR sudah kedaluwarsa/);

    // Verifikasi dengan revisi yang sudah ditutup/diubah admin / Verified with outdated revision
    const result3 = verifyQrToken(token, sessionId, 2, secret, nowMs + 10000);
    expect(result3.isValid).toBe(false);
    expect(result3.reason).toMatch(/Revisi QR tidak cocok/);
  });
});
