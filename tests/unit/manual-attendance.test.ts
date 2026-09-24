// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ATTENDANCE_STATUS_LABELS, type AttendanceStatus } from '../../src/features/attendance/types';

const service = readFileSync(resolve(process.cwd(), 'src/features/attendance/service.ts'), 'utf-8');
const dashboard = readFileSync(resolve(process.cwd(), 'src/features/dashboard/service.ts'), 'utf-8');
const route = readFileSync(resolve(process.cwd(), 'src/app/api/sessions/[sessionId]/attendance/route.ts'), 'utf-8');
const csv = readFileSync(resolve(process.cwd(), 'src/app/api/exports/attendance/route.ts'), 'utf-8');

function block(fnName: string): string {
  const start = service.indexOf(`export async function ${fnName}`);
  if (start === -1) throw new Error(`fungsi ${fnName} tidak ditemukan`);
  const next = service.indexOf('\nexport ', start + 1);
  return service.slice(start, next === -1 ? service.length : next);
}

describe('status kehadiran', () => {
  it('memberi label bagi keempat status', () => {
    const statuses: AttendanceStatus[] = ['present', 'excused', 'sick', 'absent'];
    for (const s of statuses) {
      expect(ATTENDANCE_STATUS_LABELS[s], s).toBeTruthy();
    }
  });
});

describe('setAttendanceStatus', () => {
  const body = block('setAttendanceStatus');

  it('menghitung penghitung dari perubahan keadaan, bukan menambah begitu saja', () => {
    // Menetapkan status yang sama dua kali tidak boleh menggeser penghitungnya;
    // penambahan langsung akan menggelembungkan attendeeCount setiap kali admin
    // menekan tombol yang sudah aktif.
    //
    // Setting the same status twice must not move the counters; a plain
    // increment would inflate attendeeCount each time an admin presses an
    // already-active button.
    expect(body).toMatch(/const delta = \(isPresent \? 1 : 0\) - \(wasPresent \? 1 : 0\)/);
    expect(body).toMatch(/if \(delta !== 0\)/);
  });

  it('memperlakukan dokumen tanpa status sebagai hadir', () => {
    // Catatan yang dibuat sebelum status ada seluruhnya berasal dari
    // pemindaian; membacanya sebagai tidak hadir akan mengubah riwayat.
    //
    // Records written before the status existed all came from a scan; reading
    // them as absent would rewrite history.
    expect(body).toMatch(/before\.status \?\? 'present'/);
  });

  it('menghapus catatan ketika statusnya tidak hadir', () => {
    // Ketidakhadiran tanpa keterangan memang berarti tidak ada catatan;
    // menyimpan dokumen bernilai absent memberi satu keadaan dua bentuk data.
    //
    // An unexplained absence is precisely the lack of a record; storing an
    // absent document would give one situation two shapes.
    expect(body).toMatch(/input\.status === 'absent'/);
    expect(body).toMatch(/tx\.delete\(attendanceRef\)/);
  });

  it('mempertahankan waktu pemindaian asli', () => {
    // Admin yang menambahkan keterangan tidak seharusnya menggeser jam
    // kehadiran yang sudah tercatat.
    //
    // An admin adding a note should not shift the already-recorded arrival
    // time.
    expect(body).toMatch(/recordedAt: before\?\.recordedAt \?\? now/);
  });

  it('menolak peserta dari kelas yang tidak mengikuti sesi', () => {
    // Sesi bersama dihadiri beberapa kelas, sehingga keanggotaan diperiksa
    // terhadap seluruh kelas yang tercantum, bukan kelas penyelenggara saja.
    //
    // A shared session is attended by several classes, so membership is
    // checked against every listed class, not the owning one alone.
    expect(body).toContain('sessionIncludesClass(session, student.classId)');
  });

  it('membaca seluruhnya sebelum menulis di dalam transaksi', () => {
    const stripped = body.replace(/\/\/[^\n]*/g, '');
    const read = stripped.indexOf('tx.get(');
    const write = stripped.search(/tx\.(set|update|delete)\(/);
    expect(read).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(read);
  });

  it('menuntut peran admin', () => {
    expect(body).toContain("actor.role !== 'admin'");
  });
});

describe('listSessionAttendance', () => {
  const body = block('listSessionAttendance');

  it('menampilkan seluruh peserta kelas, bukan hanya yang tercatat', () => {
    // Yang dicari admin justru siapa yang belum tercatat. Pada sesi bersama,
    // peserta seluruh kelas yang ikut ditampilkan.
    //
    // What an admin looks for is precisely who is still unaccounted for. On a
    // shared session, participants of every attending class are listed.
    expect(body).toMatch(/where\('classId', 'in', attendingClassIds\)/);
    expect(body).toMatch(/where\('role', '==', 'student'\)/);
  });

  it('menandai peserta tanpa catatan sebagai tidak hadir', () => {
    expect(body).toMatch(/att \? \(att\.status \?\? 'present'\) : 'absent'/);
  });
});

describe('rasio kehadiran peserta', () => {
  it('hanya menghitung catatan berstatus hadir', () => {
    // Izin dan sakit tersimpan pada koleksi yang sama; menghitung seluruh
    // dokumen akan menampilkan peserta yang berhalangan sebagai hadir.
    //
    // Excused and sick live in the same collection; counting every document
    // would show someone who was excused as present.
    expect(dashboard).toMatch(/filter\(\(a\) => \(a\.status \?\? 'present'\) === 'present'\)/);
  });
});

describe('endpoint status kehadiran', () => {
  it('memeriksa status terhadap daftar yang sah', () => {
    // Kolom ini menentukan apakah seseorang terhitung hadir pada rekap
    // penilaian; nilai asing tidak boleh tersimpan.
    //
    // This field decides whether someone counts as present on an assessment
    // report; no foreign value may be stored.
    expect(route).toContain('VALID_STATUSES.includes(body.status)');
  });

  it('menolak yang bukan admin pada kedua metode', () => {
    const guards = route.match(/actor\.role !== 'admin'/g) ?? [];
    expect(guards.length).toBe(2);
  });
});

describe('ekspor rekap presensi', () => {
  it('memuat kolom status dan keterangan', () => {
    // Tanpa kolom status, catatan izin dan sakit terbaca sebagai kehadiran
    // biasa pada rekap yang dipakai untuk penilaian.
    //
    // Without a status column, excused and sick records read as ordinary
    // attendance on a report used for assessment.
    expect(csv).toContain("'Status'");
    expect(csv).toContain("'Keterangan'");
    expect(csv).toContain('ATTENDANCE_STATUS_LABELS');
  });

  it('membedakan catatan admin dari pemindaian peserta', () => {
    expect(csv).toMatch(/r\.source === 'manual'/);
  });
});
