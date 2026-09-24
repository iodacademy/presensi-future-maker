// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sessionClassIds, sessionIncludesClass } from '../../src/features/attendance/policy';

const service = readFileSync(resolve(process.cwd(), 'src/features/attendance/service.ts'), 'utf-8');

function block(fnName: string): string {
  const start = service.indexOf(`export async function ${fnName}`);
  if (start === -1) throw new Error(`fungsi ${fnName} tidak ditemukan`);
  const next = service.indexOf('\nexport ', start + 1);
  return service.slice(start, next === -1 ? service.length : next);
}

/**
 * Onboarding dihadiri beberapa kelas sekaligus dalam satu ruang Zoom, sehingga
 * satu kode QR harus berlaku bagi semuanya.
 *
 * Onboarding is attended by several classes at once in one Zoom room, so a
 * single QR code must work for all of them.
 */
describe('daftar kelas sebuah sesi', () => {
  it('menyertakan kelas penyelenggara meski tidak tercantum', () => {
    // Kelas penyelenggara selalu ikut; menuntutnya tercantum dua kali membuka
    // peluang daftar yang tidak memuat kelasnya sendiri.
    //
    // The owning class always attends; requiring it to be listed twice invites
    // a list that omits its own class.
    expect(sessionClassIds({ classId: 'a', classIds: ['b', 'c'] })).toEqual(['a', 'b', 'c']);
    expect(sessionClassIds({ classId: 'a', classIds: [] })).toEqual(['a']);
  });

  it('memperlakukan sesi lama tanpa classIds sebagai satu kelas', () => {
    // Sesi yang sudah tersimpan tidak memuat field ini; ketiadaannya berarti
    // hanya kelas penyelenggara yang ikut.
    //
    // Existing sessions lack this field; its absence means only the owning
    // class attends.
    expect(sessionClassIds({ classId: 'a' })).toEqual(['a']);
    expect(sessionIncludesClass({ classId: 'a' }, 'a')).toBe(true);
    expect(sessionIncludesClass({ classId: 'a' }, 'b')).toBe(false);
  });

  it('tidak menduplikasi kelas penyelenggara yang ikut tercantum', () => {
    expect(sessionClassIds({ classId: 'a', classIds: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it('menolak peserta tanpa kelas', () => {
    // Peserta yang kelasnya terhapus memiliki classId null; membiarkannya lolos
    // akan mencatat kehadiran tanpa kelas yang dapat dirujuk rekap.
    //
    // A participant whose class was deleted carries a null classId; letting
    // that through would record attendance with no class for a report to cite.
    expect(sessionIncludesClass({ classId: 'a', classIds: ['b'] }, null)).toBe(false);
    expect(sessionIncludesClass({ classId: 'a' }, undefined)).toBe(false);
  });
});

describe('pemindaian pada sesi bersama', () => {
  it('memeriksa keanggotaan terhadap seluruh kelas sesi', () => {
    // Membandingkan dengan classId saja menolak peserta dari kelas lain yang
    // hadir di ruang Zoom yang sama.
    //
    // Comparing against classId alone refuses participants from the other
    // classes present in the same Zoom room.
    const body = block('recordStudentAttendance');
    expect(body).toContain('sessionIncludesClass(session, actor.classId)');
    expect(body).not.toMatch(/session\.classId !== actor\.classId/);
  });

  it('menyimpan kelas peserta pada catatan kehadiran, bukan kelas penyelenggara', () => {
    // Rekap dan ekspor disaring menurut kelas peserta; menyimpan kelas
    // penyelenggara akan menyembunyikan kehadiran mereka dari rekap kelasnya
    // sendiri.
    //
    // Reports and exports filter by the participant's class; storing the owning
    // class would hide their attendance from their own class report.
    expect(block('recordStudentAttendance')).toMatch(/classId: actor\.classId!/);
    expect(block('setAttendanceStatus')).toMatch(/classId: student\.classId!/);
  });
});

describe('jadwal peserta', () => {
  it('mengambil sesi milik kelas dan sesi bersama yang mencantumkannya', () => {
    // Firestore tidak dapat memeriksa kesamaan field dan keanggotaan array
    // sekaligus, sehingga tanpa kueri kedua sesi bersama hilang dari jadwal
    // kelas yang bukan penyelenggaranya.
    //
    // Firestore cannot check a field equality and array membership together,
    // so without the second query a shared session vanishes from the schedule
    // of every class that does not own it.
    const body = block('listSessionsForClass');
    expect(body).toMatch(/array-contains/);
    expect(body).toMatch(/new Map<string, SessionDocument>\(\)/);
  });
});

describe('daftar hadir sesi bersama', () => {
  it('menampilkan peserta dari seluruh kelas yang ikut', () => {
    const body = block('listSessionAttendance');
    expect(body).toMatch(/sessionClassIds\(session\)/);
    expect(body).toMatch(/where\('classId', 'in', attendingClassIds\)/);
  });
});

describe('pembuatan sesi bersama', () => {
  it('memeriksa keberadaan kelas tambahan', () => {
    // ID kelas yang tidak ada membuat pesertanya tidak pernah muncul pada
    // daftar hadir, tanpa galat apa pun yang memberi tahu admin.
    //
    // A class ID that does not exist leaves its participants absent from the
    // attendance list, with no error telling the admin.
    const body = block('createSession');
    expect(body).toContain('Kelas tambahan tidak ditemukan');
  });

  it('selalu menyertakan kelas penyelenggara pada daftar', () => {
    expect(block('createSession')).toMatch(/classIds: \[validated\.classId, \.\.\.extraClassIds\]/);
  });
});
