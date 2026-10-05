// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page = readFileSync(resolve(process.cwd(), 'src/app/presensi/page.tsx'), 'utf-8');
const route = readFileSync(resolve(process.cwd(), 'src/app/api/attendance/scan/route.ts'), 'utf-8');
const middleware = readFileSync(resolve(process.cwd(), 'src/middleware.ts'), 'utf-8');

/**
 * Peserta yang memindai QR dengan kamera bawaan ponsel tiba di /presensi tanpa
 * sesi. Halaman itu kini meminta surel di tempat, lalu mencatat kehadiran --
 * tanpa memutar mereka ke halaman masuk di tengah sesi yang sedang berlangsung.
 *
 * A participant scanning the QR with their phone's built-in camera arrives at
 * /presensi with no session. The page now asks for their address on the spot,
 * then records attendance -- without routing them through the sign-in page
 * mid-session.
 */
describe('presensi tanpa sesi', () => {
  it('halaman presensi tidak dijaga middleware', () => {
    // Bila /presensi ikut dijaga, peserta dialihkan ke halaman masuk sebelum
    // sempat melihat formulir surelnya.
    //
    // If /presensi were guarded, participants would be redirected to sign-in
    // before ever seeing the email form.
    expect(middleware).not.toMatch(/startsWith\('\/presensi'\)/);
    expect(middleware).not.toMatch(/'\/presensi/);
  });

  it('menawarkan formulir surel hanya pada 401', () => {
    expect(page).toMatch(/res\.status === 401/);
    expect(page).toContain('setNeedsEmail(true)');
  });

  it('menukar surel menjadi sesi bertanda tangan, bukan mencatat langsung', () => {
    // Surel bukan rahasia. Jalur yang mencatat kehadiran hanya berbekal surel
    // akan memungkinkan siapa pun menitipkan absen atas nama orang lain, jadi
    // alur masuk yang sudah ada dipakai apa adanya.
    //
    // An address is not a secret. A path recording attendance from one alone
    // would let anyone mark someone else present, so the existing sign-in flow
    // is reused as it is.
    // Surelnya hanya dikirim ke jalur masuk, yang menukarnya menjadi session
    // cookie bertanda tangan; pencatatan kehadirannya membaca sesi itu.
    //
    // The address is only sent to the sign-in path, which turns it into a signed
    // session cookie; recording attendance reads that session.
    expect(page).toContain("fetch('/api/auth/login'");
    expect(page.match(/JSON\.stringify\(\{ email \}\)/g)).toHaveLength(1);
  });

  it('mencatat kehadiran segera setelah sesi terbentuk', () => {
    // Meminta peserta memindai ulang setelah masuk akan menggagalkan tujuannya;
    // token berganti tiap 30 detik.
    //
    // Asking them to rescan after signing in would defeat the purpose; the
    // token rotates every 30 seconds.
    expect(page).toMatch(/setNeedsEmail\(false\);\s*await recordAttendance\(\)/);
  });
});

describe('endpoint scan membedakan sebab penolakan', () => {
  it('mengembalikan 401 ketika tidak ada sesi', () => {
    expect(route).toMatch(/if \(!actor\) \{[\s\S]{0,300}status: 401/);
  });

  it('mengembalikan 403 ketika perannya bukan peserta', () => {
    // Admin atau mentor yang memindai QR perlu tahu bahwa masuk ulang tidak
    // akan menolong; formulir surel di halaman presensi tidak ditawarkan untuk
    // keadaan ini.
    //
    // An admin or mentor scanning the QR needs to know signing in again will
    // not help; the email form is not offered for this case.
    expect(route).toMatch(/actor\.role !== 'student'[\s\S]{0,400}status: 403/);
  });

  it('tetap menuntut token QR yang sah setelah peran terverifikasi', () => {
    // Peran yang benar tidak menggantikan pemeriksaan token; tanpa itu peserta
    // dapat mencatat kehadiran tanpa hadir.
    //
    // The right role does not replace the token check; without it a
    // participant could record attendance without being present.
    expect(route).toContain('recordStudentAttendance');
  });
});
