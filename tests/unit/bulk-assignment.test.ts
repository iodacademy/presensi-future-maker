// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const service = readFileSync(resolve(process.cwd(), 'src/features/assignments/service.ts'), 'utf-8');
const route = readFileSync(resolve(process.cwd(), 'src/app/api/assignments/route.ts'), 'utf-8');
const mentorPage = readFileSync(
  resolve(process.cwd(), 'src/app/(admin)/admin/mentoring/[classId]/[mentorId]/page.tsx'),
  'utf-8'
);
const classPage = readFileSync(
  resolve(process.cwd(), 'src/app/(admin)/admin/mentoring/[classId]/page.tsx'),
  'utf-8'
);

function block(source: string, fnName: string): string {
  const start = source.indexOf(`export async function ${fnName}`);
  if (start === -1) throw new Error(`fungsi ${fnName} tidak ditemukan`);
  const next = source.indexOf('\nexport ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

describe('assignMentorToStudents', () => {
  const body = block(service, 'assignMentorToStudents');

  it('mengumpulkan kegagalan alih-alih menghentikan seluruh proses', () => {
    // Satu peserta yang kelasnya berubah di tengah jalan tidak seharusnya
    // membatalkan penugasan peserta lainnya.
    //
    // One participant whose class changed midway should not undo the
    // assignment of the others.
    expect(body).toContain('failures');
    expect(body).toMatch(/try \{[\s\S]*?\} catch/);
  });

  it('memakai ulang validasi penugasan tunggal', () => {
    // Aturannya identik; jalur kedua akan membuat dua tempat yang harus dijaga
    // tetap sama.
    //
    // The rules are identical; a second path would create two places to keep
    // in step.
    expect(body).toContain('assignMentorToStudent(actor');
  });

  it('menolak daftar kosong', () => {
    expect(body).toContain('Pilih minimal satu peserta');
  });

  it('menuntut peran admin', () => {
    expect(body).toContain("actor.role !== 'admin'");
  });
});

describe('listClassStudentsWithAssignment', () => {
  const body = block(service, 'listClassStudentsWithAssignment');

  it('membaca penugasan sekali, bukan sekali per peserta', () => {
    // Satu angkatan berisi puluhan peserta; pembacaan per baris mengulang
    // perjalanan yang sama berkali-kali pada halaman yang paling sering dibuka
    // saat menyusun mentoring.
    //
    // A cohort holds dozens of participants; per-row reads repeat the same
    // round trip many times over on the page most used while arranging
    // mentoring.
    expect(body).toMatch(/collection\('assignments'\)[\s\S]{0,200}\.get\(\)/);
    expect(body).toContain('new Map<string, AssignmentDocument>()');
    expect(body).not.toMatch(/students\.map\(async/);
  });
});

describe('endpoint penugasan', () => {
  it('melayani penugasan banyak dan tunggal pada satu jalur', () => {
    expect(route).toContain('Array.isArray(body.studentIds)');
    expect(route).toContain('assignMentorToStudents');
  });

  it('menolak yang bukan admin pada kedua metode', () => {
    const guards = route.match(/actor\.role !== 'admin'/g) ?? [];
    expect(guards.length).toBe(2);
  });
});

describe('halaman kelas mentoring', () => {
  it('hanya menampilkan mentor kelas itu', () => {
    // Menampilkan seluruh mentor akan menawarkan pilihan yang pasti ditolak
    // layanan, sebab mentor harus terdaftar pada kelasnya.
    //
    // Showing every mentor would offer a choice the service is certain to
    // refuse, since a mentor must be listed on the class.
    expect(classPage).toMatch(/mentorIds \?\? \[\]\)\.includes\(m\.uid\)/);
  });

  it('memberi tahu peserta yang belum punya mentor', () => {
    // Peserta tanpa mentor tidak dapat memesan slot; tanpa peringatan itu
    // ketiadaannya baru diketahui saat peserta mengeluh.
    //
    // A participant with no mentor cannot book a slot; without this warning
    // that gap surfaces only when they complain.
    expect(classPage).toContain('belum punya mentor');
  });
});

describe('halaman penugasan mentor', () => {
  it('mencentang peserta yang sudah dibimbing sejak awal', () => {
    // Halaman menggambarkan keadaan sekarang, bukan formulir kosong.
    // The page describes the current state rather than an empty form.
    expect(mentorPage).toMatch(/r\.assignment\?\.mentorId === mentorId/);
  });

  it('hanya mengirim peserta yang benar-benar baru', () => {
    // Mengirim ulang peserta yang sudah dibimbing hanya menambah perjalanan
    // tanpa mengubah apa pun.
    //
    // Resending participants already guided only adds round trips without
    // changing anything.
    expect(mentorPage).toMatch(/toAdd = \[\.\.\.selected\]\.filter\(\(uid\) => !alreadyMine\.has\(uid\)\)/);
  });

  it('menyembunyikan peserta mentor lain, tetapi tetap dapat ditampilkan untuk dipindahkan', () => {
    // Daftar pilihan hanya berisi yang perlu ditugaskan. Penugasan baru
    // menggantikan yang lama, jadi tanpa pilihan tampilkan, memindahkan
    // peserta antar-mentor menjadi mustahil.
    //
    // The list holds only those needing assignment. A new assignment replaces
    // the old one, so without a show option moving a participant between
    // mentors would be impossible.
    expect(mentorPage).toMatch(/useState\(false\)/);
    expect(mentorPage).toMatch(/showOthers \|\| !r\.assignment \|\| r\.assignment\.mentorId === mentorId/);
    expect(mentorPage).toContain('dibimbing mentor lain (untuk memindahkan)');
    expect(mentorPage).toContain('kini:');
  });

  it('menyediakan pencarian nama dan email', () => {
    expect(mentorPage).toMatch(/student\.name\.toLowerCase\(\)\.includes\(needle\)/);
    expect(mentorPage).toMatch(/student\.email \?\? ''\)\.toLowerCase\(\)\.includes\(needle\)/);
  });
});
