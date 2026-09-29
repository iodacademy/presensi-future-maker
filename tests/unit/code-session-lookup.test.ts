// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateSessionCode, isSessionCodeShaped, generateQrToken } from '@/features/attendance/qr';

const service = readFileSync(
  resolve(process.cwd(), 'src/features/attendance/service.ts'),
  'utf-8'
);

const record = service.slice(
  service.indexOf('export async function recordStudentAttendance'),
  service.indexOf('export', service.indexOf('export async function recordStudentAttendance') + 10)
);

const lookup = service.slice(
  service.indexOf('async function findOpenSessionByCode'),
  service.indexOf('export async function recordStudentAttendance')
);

/**
 * Token berotasi memuat sessionId di dalam dirinya; kode statis tidak.
 *
 * Membongkar kode statis sebagai base64url menghasilkan byte sampah, dan
 * potongan sebelum ':' menjadi id yang tidak pernah ada, sehingga seluruh
 * presensi lewat kode ditolak dengan "Sesi presensi tidak ditemukan".
 *
 * A rotating token carries its sessionId inside it; a static code does not.
 *
 * Decoding a static code as base64url yields junk bytes, and the part before
 * ':' becomes an id that never exists, so every code-based check-in was
 * refused with "session not found".
 */
describe('kode statis tidak dapat dibongkar menjadi sessionId', () => {
  it('membuktikan pembongkaran menghasilkan id yang salah', () => {
    const kode = generateSessionCode('sesi-nyata', 1, 'rahasia');
    const dibongkar = Buffer.from(kode, 'base64url').toString('utf-8').split(':')[0];
    expect(dibongkar).not.toBe('sesi-nyata');
  });

  it('token berotasi tetap dapat dibongkar', () => {
    // Jalur lama harus tetap bekerja: QR yang sudah tersebar memakainya.
    // The old path must keep working: QR codes already handed out use it.
    const token = generateQrToken('sesi-nyata', 1, 'rahasia');
    const dibongkar = Buffer.from(token, 'base64url').toString('utf-8').split(':')[0];
    expect(dibongkar).toBe('sesi-nyata');
  });

  it('kedua bentuk dapat dibedakan sebelum diproses', () => {
    expect(isSessionCodeShaped(generateSessionCode('s', 1, 'r'))).toBe(true);
    expect(isSessionCodeShaped(generateQrToken('s', 1, 'r'))).toBe(false);
  });
});

describe('presensi mencari sesi sesuai bentuk masukannya', () => {
  it('kode statis dicari, tidak dibongkar', () => {
    expect(record).toContain('findOpenSessionByCode(token, actor.classId)');
  });

  it('token berotasi tetap dibongkar seperti semula', () => {
    expect(record).toMatch(/Buffer\.from\(token, 'base64url'\)/);
  });

  it('memilih jalur menurut bentuk masukan', () => {
    expect(record).toMatch(/if \(isSessionCodeShaped\(token\)\)/);
  });

  it('memberi pesan yang menunjuk sebabnya', () => {
    // "Sesi presensi tidak ditemukan" tidak memberi tahu peserta apa pun yang
    // dapat ia lakukan.
    //
    // "Session not found" tells a participant nothing they can act on.
    expect(record).toContain('tidak cocok dengan sesi mana pun yang sedang dibuka');
  });
});

describe('pencarian sesi menurut kode', () => {
  it('dibatasi pada sesi hari ini', () => {
    // Tanpa batas ini setiap pemindaian membaca seluruh koleksi sesi.
    // Without this limit every scan reads the entire sessions collection.
    expect(lookup).toMatch(/where\('date', '==', today\)/);
  });

  it('dibatasi pada kelas peserta', () => {
    // Kode kelas lain yang kebetulan sama akan mencatatkan peserta pada sesi
    // yang bukan miliknya.
    //
    // Another class's code that happens to match would check a participant
    // into a session that is not theirs.
    expect(lookup).toContain('sessionIncludesClass(session, classId)');
    expect(lookup).toMatch(/if \(!classId\) return null/);
  });

  it('hanya menerima sesi yang sedang dibuka', () => {
    expect(lookup).toContain('isSessionAttendanceActive(session, nowIso)');
  });

  it('memakai tanggal WIB, bukan tanggal UTC', () => {
    // Pukul 20.00 WIB adalah 13.00 UTC di hari yang sama, tetapi pukul 06.00
    // WIB adalah 23.00 UTC hari sebelumnya: tanggal UTC akan melewatkan sesi
    // pagi.
    //
    // 20:00 WIB is 13:00 UTC the same day, but 06:00 WIB is 23:00 UTC the day
    // before: a UTC date would miss morning sessions.
    expect(lookup).toContain("timeZone: 'Asia/Jakarta'");
  });

  it('membandingkan kode dengan verifikasi, bukan dengan ===', () => {
    // Perbandingan biasa keluar pada karakter pertama yang berbeda, sehingga
    // lamanya membocorkan berapa karakter awal yang sudah benar.
    //
    // A plain comparison returns at the first differing character, so its
    // duration leaks how many leading characters were right.
    expect(lookup).toContain('verifySessionCode(code, session.id, session.qrRevision, secret)');
  });
});
