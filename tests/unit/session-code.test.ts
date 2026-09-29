// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  generateSessionCode,
  verifySessionCode,
  isSessionCodeShaped,
  generateQrToken,
} from '@/features/attendance/qr';

const SECRET = 'rahasia-uji';

/**
 * Kode presensi statis melengkapi token berotasi, bukan menggantikannya.
 *
 * Token berotasi tiap 30 detik membuat QR tidak dapat difoto lalu ditayangkan
 * di layar, dan peserta yang memotret layar dari jauh sering mendapati kodenya
 * sudah kedaluwarsa. Yang menjaga kode statis bukan perputaran, melainkan
 * jendela presensi dan qrRevision.
 *
 * The static attendance code complements the rotating token rather than
 * replacing it.
 *
 * A token that rotates every 30 seconds makes the QR impossible to photograph
 * and display, and participants shooting the screen from afar often find it
 * expired. What protects a static code is not rotation but the attendance
 * window and qrRevision.
 */
describe('kode presensi statis', () => {
  it('tetap sama selama revisinya tidak berubah', () => {
    // Inti permintaannya: kode yang di-screenshot harus tetap berlaku.
    // The core of the request: a screenshotted code must keep working.
    const a = generateSessionCode('sesi-1', 3, SECRET);
    const b = generateSessionCode('sesi-1', 3, SECRET);
    expect(a).toBe(b);
  });

  it('berubah begitu revisinya naik', () => {
    // Menutup presensi menaikkan qrRevision; tanpa ini kode yang sudah
    // tersebar tetap berlaku setelah sesi ditutup.
    //
    // Closing attendance raises qrRevision; without this a code already passed
    // around would still work after the session closed.
    const sebelum = generateSessionCode('sesi-1', 3, SECRET);
    const sesudah = generateSessionCode('sesi-1', 4, SECRET);
    expect(sesudah).not.toBe(sebelum);
    expect(verifySessionCode(sebelum, 'sesi-1', 4, SECRET).isValid).toBe(false);
  });

  it('berbeda antar sesi meski revisinya sama', () => {
    // Onboarding malam menjalankan beberapa sesi berdampingan; kode yang sama
    // akan mencatatkan peserta pada sesi yang salah.
    //
    // Evening onboarding runs several sessions side by side; a shared code
    // would check participants into the wrong one.
    expect(generateSessionCode('sesi-1', 1, SECRET)).not.toBe(
      generateSessionCode('sesi-2', 1, SECRET)
    );
  });

  it('menolak kode dari rahasia lain', () => {
    const palsu = generateSessionCode('sesi-1', 1, 'rahasia-lain');
    expect(verifySessionCode(palsu, 'sesi-1', 1, SECRET).isValid).toBe(false);
  });

  it('menerima huruf kecil, spasi, dan tanda hubung', () => {
    // Peserta mengetiknya dari layar; menolak "k7m2-qx" hanya menambah
    // kegagalan yang tidak perlu.
    //
    // Participants type it off a screen; rejecting "k7m2-qx" only adds
    // needless failures.
    const kode = generateSessionCode('sesi-1', 1, SECRET);
    const berantakan = `${kode.slice(0, 3).toLowerCase()}-${kode.slice(3)} `;
    expect(verifySessionCode(berantakan, 'sesi-1', 1, SECRET).isValid).toBe(true);
  });

  it('tidak memuat huruf yang mudah tertukar', () => {
    // I/1 dan O/0 tertukar saat dibaca dari layar proyektor.
    // I/1 and O/0 get confused when read off a projector.
    for (let r = 1; r <= 40; r += 1) {
      expect(generateSessionCode(`sesi-${r}`, r, SECRET)).not.toMatch(/[IO01]/);
    }
  });

  it('menolak panjang yang salah dengan pesan yang jelas', () => {
    const hasil = verifySessionCode('AB', 'sesi-1', 1, SECRET);
    expect(hasil.isValid).toBe(false);
    expect(hasil.reason).toContain('6 karakter');
  });
});

describe('pemilihan jalur pemeriksaan', () => {
  it('mengenali kode statis dari bentuknya', () => {
    expect(isSessionCodeShaped(generateSessionCode('sesi-1', 1, SECRET))).toBe(true);
  });

  it('tidak salah mengira token berotasi sebagai kode', () => {
    // Token base64url jauh lebih panjang; bila tertukar, peserta yang memindai
    // QR lama akan ditolak dengan alasan yang keliru.
    //
    // A base64url token is far longer; if confused, a participant scanning an
    // older QR would be refused for the wrong reason.
    expect(isSessionCodeShaped(generateQrToken('sesi-1', 1, SECRET))).toBe(false);
  });
});

describe('presensi memeriksa jendela sesi', () => {
  const service = readFileSync(
    resolve(process.cwd(), 'src/features/attendance/service.ts'),
    'utf-8'
  );
  const body = service.slice(
    service.indexOf('export async function recordStudentAttendance'),
    service.indexOf('export', service.indexOf('export async function recordStudentAttendance') + 10)
  );

  it('menolak presensi saat sesi ditutup', () => {
    // Token berotasi memuat jendela waktunya sendiri, kode statis tidak: tanpa
    // pemeriksaan ini kode yang difoto berlaku berhari-hari setelah sesi usai.
    //
    // A rotating token carries its own window, a static code does not: without
    // this check a photographed code works for days after the session ended.
    expect(body).toContain('isSessionAttendanceActive(session');
  });

  it('memeriksa jendela sebelum memverifikasi kodenya', () => {
    // isSessionCodeShaped kini muncul lebih dulu untuk memilih jalur pencarian
    // sesi; yang harus tetap sesudah jendela adalah verifikasi kodenya.
    //
    // isSessionCodeShaped now appears earlier to pick the session lookup path;
    // what must still follow the window check is verifying the code itself.
    expect(body.indexOf('isSessionAttendanceActive(session, new Date()')).toBeLessThan(
      body.indexOf('const verification =')
    );
  });

  it('menolak kode yang tidak cocok dengan sesi terbuka mana pun', () => {
    // Pencarian sendiri sudah menyaring sesi yang tertutup, sehingga kode
    // untuk sesi kemarin tidak menemukan apa pun.
    //
    // The lookup itself already filters closed sessions, so a code for
    // yesterday's session finds nothing.
    expect(body).toContain('tidak cocok dengan sesi mana pun yang sedang dibuka');
  });
});

describe('kamera pemindai', () => {
  const camera = readFileSync(
    resolve(process.cwd(), 'src/app/(student)/app/presensi/scan/qr-camera.tsx'),
    'utf-8'
  );

  it('menyediakan pengatur zoom', () => {
    // QR di layar proyektor terlalu kecil di frame untuk terbaca dari tempat
    // duduk peserta.
    //
    // A QR on a projector is too small in frame to decode from where
    // participants sit.
    expect(camera).toContain('applyConstraints');
    expect(camera).toMatch(/type="range"/);
  });

  it('menyembunyikan penggeser bila perangkat tidak mendukung zoom', () => {
    // Penggeser yang tidak berefek lebih membingungkan daripada tidak ada.
    // A slider that does nothing confuses more than no slider at all.
    expect(camera).toMatch(/zoomRange && \(/);
  });

  it('tidak menghentikan pemindaian bila zoom ditolak perangkat', () => {
    expect(camera).toMatch(/applyConstraints\([\s\S]{0,120}\)\s*\.catch\(\(\) => \{\}\)/);
  });
});
