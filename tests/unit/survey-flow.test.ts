// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { scopeCovers, describeScope } from '@/features/survey/policy';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const service = read('src/features/survey/service.ts');
const attendance = read('src/features/attendance/service.ts');
const jadwal = read('src/app/(student)/app/jadwal/page.tsx');
const settings = read('src/app/(admin)/admin/pengaturan/page.tsx');
const scopeModal = read('src/app/(admin)/admin/pengaturan/survey-scope-modal.tsx');
const shell = read('src/components/app-shell.tsx');

function fungsi(nama: string): string {
  const mulai = service.indexOf(`export async function ${nama}`);
  if (mulai === -1) throw new Error(`fungsi ${nama} tidak ditemukan`);
  const berikut = service.indexOf('\nexport ', mulai + 1);
  return service.slice(mulai, berikut === -1 ? service.length : berikut);
}

/**
 * Daftar kosong berarti seluruhnya, bukan tidak sama sekali.
 *
 * Menyimpan seluruh id kelas saat admin memilih "semua kelas" akan membekukan
 * daftarnya pada saat penyimpanan, sehingga kelas yang dibuat kemudian tidak
 * pernah mendapat surveinya -- kesalahan yang baru ketahuan berbulan-bulan
 * kemudian saat angkatan berikutnya dibuka.
 *
 * An empty list means all, not none.
 *
 * Storing every class id when an admin picks "all classes" would freeze the
 * list at save time, so a class created later would never receive the survey --
 * a mistake that only surfaces months on, when the next cohort opens.
 */
describe('cakupan survei', () => {
  it('daftar kosong mencakup seluruh kelas dan pertemuan', () => {
    expect(scopeCovers({ classIds: [], sessionIds: [] }, 'kelas-baru', 'sesi-baru')).toBe(true);
  });

  it('membatasi pada kelas yang disebut', () => {
    const scope = { classIds: ['kelas-a'], sessionIds: [] };
    expect(scopeCovers(scope, 'kelas-a', 'sesi-1')).toBe(true);
    expect(scopeCovers(scope, 'kelas-b', 'sesi-1')).toBe(false);
  });

  it('membatasi pada pertemuan yang disebut', () => {
    const scope = { classIds: [], sessionIds: ['sesi-1'] };
    expect(scopeCovers(scope, 'kelas-a', 'sesi-1')).toBe(true);
    expect(scopeCovers(scope, 'kelas-a', 'sesi-2')).toBe(false);
  });

  it('menuntut keduanya cocok bila keduanya disebut', () => {
    const scope = { classIds: ['kelas-a'], sessionIds: ['sesi-1'] };
    expect(scopeCovers(scope, 'kelas-a', 'sesi-1')).toBe(true);
    expect(scopeCovers(scope, 'kelas-a', 'sesi-2')).toBe(false);
    expect(scopeCovers(scope, 'kelas-b', 'sesi-1')).toBe(false);
  });

  it('menjelaskan cakupannya dengan nama, bukan id', () => {
    // Daftar id tidak terbaca siapa pun; admin perlu tahu formulirnya mengenai
    // siapa tanpa membuka pengaturannya satu per satu.
    //
    // A list of ids reads to nobody; an admin needs to know who a form covers
    // without opening each one's settings.
    const nama = new Map([['kelas-a', 'Web Programming Semarang']]);
    expect(describeScope({ classIds: [], sessionIds: [] }, nama, new Map())).toBe('Semua kelas - semua pertemuan');
    expect(describeScope({ classIds: ['kelas-a'], sessionIds: [] }, nama, new Map()))
      .toBe('Web Programming Semarang - semua pertemuan');
  });

  it('meringkas pertemuan yang banyak menjadi jumlahnya', () => {
    // Sepuluh judul pertemuan pada satu baris tabel tidak terbaca.
    // Ten meeting titles on one table row read as nothing.
    const scope = { classIds: [], sessionIds: ['a', 'b', 'c', 'd'] };
    expect(describeScope(scope, new Map(), new Map())).toContain('4 pertemuan');
  });
});

describe('beberapa survei berdampingan', () => {
  it('tidak lagi memaku satu id formulir', () => {
    expect(service).not.toContain("const FORM_ID = 'default'");
    expect(service).toContain('export async function listSurveyForms');
    expect(service).toContain('export async function createSurveyForm');
  });

  it('mencatat formulirnya pada tiap jawaban', () => {
    // Tanpa ini, rekap sebuah formulir akan ikut menghitung jawaban atas
    // formulir lain yang kebetulan mengenai pertemuan yang sama.
    //
    // Without it, one form's report would count answers to another form that
    // happened to cover the same meeting.
    expect(fungsi('submitSurveyResponse')).toContain('formId,');
    expect(fungsi('getSurveyReport')).toMatch(/where\('formId', '==', formId\)/);
  });

  it('mengunci jawabannya pada formulir dan pertemuan sekaligus', () => {
    // Satu peserta dapat mengisi dua survei berbeda untuk pertemuan yang sama.
    // One participant may fill in two different surveys for the same meeting.
    expect(fungsi('submitSurveyResponse')).toMatch(/\$\{formId\}_\$\{sessionId\}_\$\{actor\.uid\}/);
  });

  it('memeriksa cakupan saat menerima jawaban, bukan hanya menyembunyikan barisnya', () => {
    // Baris yang disembunyikan tidak menahan siapa pun yang memanggil
    // endpointnya langsung dengan id pertemuan lain.
    //
    // A hidden row holds back nobody who calls the endpoint directly with
    // another meeting's id.
    expect(fungsi('submitSurveyResponse')).toContain('scopeCovers(form.scope, actor.classId, sessionId)');
  });

  it('menghapus jawabannya bersama formulirnya', () => {
    // Jawaban yang formulirnya hilang tidak dapat ditampilkan pada rekap mana
    // pun lagi.
    //
    // An answer whose form is gone can no longer appear on any report.
    const blok = fungsi('deleteSurveyForm');
    expect(blok).toMatch(/where\('formId', '==', formId\)/);
    expect(blok).toContain('db.batch()');
  });

  it('lahir mencakup seluruhnya, bukan tidak sama sekali', () => {
    // Cakupan yang terlalu luas terlihat, cakupan kosong tidak.
    // Too wide a scope is visible, an empty one is not.
    expect(fungsi('createSurveyForm')).toContain('scope: { classIds: [], sessionIds: [] }');
  });

  it('tidak menaikkan versi saat hanya cakupannya berubah', () => {
    // Cakupan tidak mengubah apa yang dibaca penjawabnya.
    // The scope does not change what the respondent read.
    expect(fungsi('updateSurveyForm')).toMatch(/const berubah = patch\.questions !== undefined/);
  });
});

describe('syarat kehadiran', () => {
  it('menolak pengisian tanpa presensi tercatat', () => {
    // Peserta yang tidak hadir tidak punya pengalaman pertemuan itu untuk
    // dinilai, dan jawabannya mencemari rekap.
    //
    // Someone who did not attend has no experience of that meeting to rate,
    // and their answers pollute the report.
    const blok = fungsi('submitSurveyResponse');
    expect(blok).toMatch(/attendance'\)\.doc\(`\$\{sessionId\}_\$\{actor\.uid\}`\)/);
    expect(blok).toContain('setelah kehadiran Anda');
  });

  it('menyembunyikan barisnya bagi yang belum presensi', () => {
    // Menagihnya meninggalkan tagihan yang tidak pernah dapat ia selesaikan.
    // Asking them leaves a demand they can never satisfy.
    const blok = attendance.slice(
      attendance.indexOf('export async function listStudentSessionsWithAttendance'),
      attendance.indexOf('export', attendance.indexOf('export async function listStudentSessionsWithAttendance') + 10)
    );
    expect(blok).toMatch(/surveys: attendMap\.has\(s\.id\)/);
    expect(blok).toContain('scopeCovers(f.scope, actor.classId!, s.id)');
  });
});

describe('perubahan formulir tidak merusak rekap lama', () => {
  it('mencatat versinya pada tiap jawaban', () => {
    expect(fungsi('submitSurveyResponse')).toContain('formVersion: form.version');
  });

  it('menurunkan penerbitan bila pertanyaan terakhirnya dihapus', () => {
    // Formulir kosong yang terbit menagih peserta mengisi layar kosong.
    // A published empty form asks participants to fill in an empty screen.
    expect(fungsi('removeSurveyQuestion')).toMatch(/questions\.length === 0 \? \{ published: false \}/);
  });
});

describe('tempat survei pada antarmuka', () => {
  it('berbentuk tabel dengan kolom cakupan', () => {
    // Beberapa survei berdampingan, masing-masing mengenai kelas dan pertemuan
    // yang berbeda; tabel adalah satu-satunya bentuk yang memperlihatkan
    // cakupan semuanya sekaligus.
    //
    // Several surveys stand side by side, each covering different classes and
    // meetings; a table is the only shape that shows every scope at once.
    expect(settings).toContain('CAKUPAN');
    expect(settings).toContain('describeScope');
    expect(settings).toContain('Tambah Survei');
  });

  it('menyediakan pengaturan cakupan per survei', () => {
    expect(scopeModal).toContain('Semua Kelas');
    expect(scopeModal).toContain('Semua Pertemuan');
    expect(scopeModal).toMatch(/scope: \{ classIds, sessionIds \}/);
  });

  it('menjelaskan arti daftar kosong pada layarnya', () => {
    // Admin yang mengira kosong berarti "tidak satu pun" akan memilih seluruh
    // kelas satu per satu, dan membekukan daftarnya tanpa sadar.
    //
    // An admin who reads empty as "none" would pick every class by hand, and
    // freeze the list without realising.
    expect(scopeModal).toContain('Termasuk kelas yang dibuat kemudian');
  });

  it('membuka survei yang baru dibuat', () => {
    expect(settings).toContain('setOpenId(data.id)');
  });

  it('beberapa survei dapat tampil pada satu kartu pertemuan', () => {
    expect(jadwal).toMatch(/surveys\.map\(\(sv\) =>/);
    expect(jadwal).toContain('/app/survei/${sv.formId}/${session.id}');
  });

  it('halaman pengisian menerima formulir dan pertemuannya', () => {
    expect(
      existsSync(resolve(process.cwd(), 'src/app/(student)/app/survei/[formId]/[sessionId]/page.tsx'))
    ).toBe(true);
  });

  it('pengaturan tercantum pada menu admin', () => {
    expect(shell).toContain("href: '/admin/pengaturan'");
  });
});
