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

  it('beberapa survei dapat tampil pada satu kartu pertemuan', () => {
    expect(jadwal).toMatch(/surveys\.map\(\(sv\)/);
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

/**
 * Penyuntingan pindah ke halaman tersendiri.
 *
 * Dua puluh empat pertanyaan tidak muat pada baris tabel yang melebar, dan
 * menyunting teks panjang di dalam ruang selebar kolom membuat kalimatnya
 * tidak terbaca utuh saat diperiksa.
 *
 * Editing moved to a page of its own.
 *
 * Twenty-four questions do not fit in an expanding table row, and editing long
 * text in a column's width leaves the sentence unreadable while it is being
 * checked.
 */
describe('penyunting survei berhalaman sendiri', () => {
  const editor = read('src/app/(admin)/admin/pengaturan/survei/[formId]/page.tsx');
  const table = read('src/app/(admin)/admin/pengaturan/page.tsx');

  it('tabel hanya mendaftar, tidak menyunting', () => {
    expect(table).toContain('/admin/pengaturan/survei/');
    expect(table).not.toContain('AddQuestion');
    expect(table).not.toMatch(/questions\/\$\{/);
  });

  it('survei baru langsung masuk ke penyuntingnya', () => {
    // Survei baru tidak punya pertanyaan, dan kembali ke tabel berarti admin
    // harus menekan Ubah untuk melanjutkan apa yang baru saja ia mulai.
    //
    // A new survey has no questions, and returning to the table would have the
    // admin press Edit to continue what they just started.
    expect(table).toMatch(/router\.push\(`\/admin\/pengaturan\/survei\/\$\{data\.id\}`\)/);
  });

  it('judul dan pengantar dapat diubah', () => {
    // Keduanya dibaca peserta sebelum mengisi, dan sebelumnya hanya dapat
    // ditetapkan sekali saat dibuat.
    //
    // Both are read by participants before filling in, and could previously
    // only be set once at creation.
    expect(editor).toContain('aria-label="Judul survei"');
    expect(editor).toContain('aria-label="Pengantar survei"');
    expect(editor).toMatch(/patchForm\(\{ title, description \}/);
  });

  it('memakai satu formulir untuk tambah dan ubah pertanyaan', () => {
    // Dua formulir berarti dua tempat memperbaiki setiap kali fieldnya
    // berubah.
    //
    // Two forms would mean two places to fix whenever a field changes.
    expect(editor.match(/<QuestionForm/g)?.length).toBe(2);
    expect(editor.match(/function QuestionForm/g)?.length).toBe(1);
  });

  it('mengisi formulirnya dengan isi pertanyaan yang disunting', () => {
    // Formulir kosong saat menyunting menuntut admin mengetik ulang seluruh
    // kalimatnya hanya untuk memperbaiki satu kata.
    //
    // An empty form when editing makes an admin retype the whole sentence just
    // to fix one word.
    expect(editor).toMatch(/function startEdit\(q: SurveyQuestion\)/);
    expect(editor).toMatch(/text: q\.text/);
  });

  it('memindahkan pertanyaan dengan tombol, bukan seret', () => {
    // Seret menuntut kursor dan tidak terjangkau dari papan ketik maupun layar
    // sentuh yang sempit.
    //
    // Dragging demands a pointer and is out of reach from a keyboard or a
    // narrow touch screen.
    expect(editor).toContain('Naikkan pertanyaan');
    expect(editor).toContain('Turunkan pertanyaan');
    expect(editor).not.toContain('draggable');
  });

  it('menonaktifkan naik pada yang pertama dan turun pada yang terakhir', () => {
    expect(editor).toMatch(/disabled=\{i === 0\}/);
    expect(editor).toMatch(/disabled=\{i === arr\.length - 1\}/);
  });
});

describe('layanan ubah dan pindah pertanyaan', () => {
  it('mempertahankan id saat pertanyaannya diubah', () => {
    // Jawaban yang sudah masuk tetap menunjuk pertanyaan yang sama, dan
    // teksnya sendiri sudah disalin ke tiap jawaban saat dikirim.
    //
    // Responses already in still point at the same question, and the text
    // itself was copied onto each response when it was submitted.
    const blok = fungsi('updateSurveyQuestion');
    expect(blok).toMatch(/q\.id === questionId \? \{ \.\.\.q, \.\.\.validated/);
  });

  it('menolak pertanyaan yang tidak ada', () => {
    expect(fungsi('updateSurveyQuestion')).toContain('Pertanyaan tidak ditemukan');
  });

  it('menulis ulang seluruh urutan setelah bertukar', () => {
    // Nomor urut yang bolong setelah penghapusan membuat pertukaran berikutnya
    // melompati posisi.
    //
    // Gaps left by a deletion would make the next swap skip a position.
    expect(fungsi('moveSurveyQuestion')).toMatch(/urut\.map\(\(q, n\) => \(\{ \.\.\.q, order: n \+ 1 \}\)\)/);
  });

  it('mengabaikan pemindahan di luar batas, bukan menolaknya', () => {
    // Tombol naik pada pertanyaan pertama sudah dinonaktifkan di layar, dan
    // menolaknya di sini hanya memunculkan pesan galat untuk ketukan yang
    // tidak berakibat.
    //
    // The up button on the first question is already disabled on screen, and
    // refusing here would only raise an error for a tap that changes nothing.
    expect(fungsi('moveSurveyQuestion')).toMatch(/if \(j < 0 \|\| j >= urut\.length\) return;/);
  });

  it('memisahkan pemindahan dari penyuntingan pada endpointnya', () => {
    // Satu badan yang memuat keduanya membuat tombol naik-turun ikut mengirim
    // teks pertanyaan yang sedang diketik dan belum selesai.
    //
    // One body carrying both would have the up and down buttons also send a
    // question text still being typed.
    const route = read('src/app/api/survey/forms/[formId]/questions/[questionId]/route.ts');
    expect(route).toMatch(/body\.direction === 'up' \|\| body\.direction === 'down'/);
  });
});
