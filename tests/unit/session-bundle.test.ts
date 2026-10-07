// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const attendance = readFileSync(resolve(process.cwd(), 'src/features/attendance/service.ts'), 'utf-8');
const adminPage = readFileSync(
  resolve(process.cwd(), 'src/app/(admin)/admin/kelas/[classId]/page.tsx'),
  'utf-8'
);
const studentPage = readFileSync(
  resolve(process.cwd(), 'src/app/(student)/app/jadwal/page.tsx'),
  'utf-8'
);

function block(fnName: string): string {
  const start = attendance.indexOf(`export async function ${fnName}`);
  if (start === -1) throw new Error(`fungsi ${fnName} tidak ditemukan`);
  const next = attendance.indexOf('\nexport ', start + 1);
  return attendance.slice(start, next === -1 ? attendance.length : next);
}

/**
 * Rekaman, bahan praktik, dan working paper melekat pada satu pertemuan yang
 * sama. Menyebarkannya ke halaman berbeda memaksa peserta maupun admin
 * memeriksa beberapa tempat untuk sesi yang sama.
 *
 * Recordings, practice materials, and the working paper all belong to one
 * meeting. Spreading them across different pages forces both participants and
 * admins to check several places for the same session.
 */
describe('seluruh isi pertemuan berada di satu tempat', () => {
  it('bahan praktik tersimpan pada sesi, bukan pada tugas', () => {
    expect(attendance).toContain('addSessionMaterial');
    expect(attendance).toContain('removeSessionMaterial');
  });

  it('tidak menyisakan endpoint bahan pada tugas', () => {
    // Dua jalur untuk hal yang sama akan membuat dua aturan yang harus dijaga
    // tetap sama.
    //
    // Two paths for the same thing would create two sets of rules to keep in
    // step.
    const tasks = readFileSync(resolve(process.cwd(), 'src/features/tasks/service.ts'), 'utf-8');
    expect(tasks).not.toContain('addTaskMaterial');
    expect(tasks).not.toContain('removeTaskMaterial');
  });

  it('jadwal peserta mengirim working paper bersama sesinya', () => {
    // Tanpa ini halaman harus memanggil dua endpoint untuk menyusun satu kartu.
    // Without this the page would call two endpoints to build one card.
    const body = block('listStudentSessionsWithAttendance');
    expect(body).toMatch(/where\('kind', '==', 'working-paper'\)/);
    expect(body).toContain('workingPapers: papersBySession.get(s.id)');
  });

  it('menyembunyikan working paper yang belum terbit', () => {
    // Peserta akan melihat tugas yang belum siap dibuka.
    // Participants would see a task that is not ready to open.
    expect(block('listStudentSessionsWithAttendance')).toMatch(/t\.published === false/);
  });

  it('kartu pertemuan admin memuat ketiganya', () => {
    expect(adminPage).toContain('<SessionMaterials');
    expect(adminPage).toContain('<SessionWorkingPaper');
    expect(adminPage).toContain('REKAMAN');
    expect(adminPage).toContain('BAHAN PRAKTIK');
    expect(adminPage).toContain('HASIL PRAKTIK DI KELAS');
  });

  it('tidak ada lagi tab working paper terpisah', () => {
    expect(adminPage).not.toContain("['working-paper', 'Working Paper']");
    expect(adminPage).not.toMatch(/tab === 'working-paper'/);
  });

  it('daftar pertemuan peserta memuat ketiganya', () => {
    expect(studentPage).toMatch(/recordings\.map/);
    // Bahan disaring per golongan (slide, tambahan, praktik) sebelum dipetakan.
    // Materials are filtered per group (slides, extra, practice) before mapping.
    expect(studentPage).toMatch(/materials\s*\.filter\(\(m\) => materialCategory\(m\) === c\)\s*\.map/);
    expect(studentPage).toMatch(/workingPapers\.map/);
    expect(studentPage).toContain("TASK_KIND_LABELS['working-paper']");
  });

  it('tautan bahan dan rekaman dibuka dengan rel aman', () => {
    // target=_blank tanpa rel="noopener" memberi halaman tujuan akses ke
    // window.opener milik aplikasi.
    //
    // target=_blank without rel="noopener" hands the destination page access
    // to the application's window.opener.
    const blank = studentPage.match(/target="_blank"/g) ?? [];
    const aman = studentPage.match(/rel="noopener noreferrer"/g) ?? [];
    expect(blank.length).toBeGreaterThan(0);
    expect(aman.length).toBe(blank.length);
  });
});
