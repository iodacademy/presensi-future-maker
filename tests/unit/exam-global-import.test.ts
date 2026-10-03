// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GLOBAL_HEADER,
  GLOBAL_TEMPLATE_HEADERS,
  globalTemplateRows,
  parseGlobalQuestionRows,
} from '@/features/exams/import-policy';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const service = read('src/features/exams/service.ts');
const ui = read('src/app/(admin)/admin/kelas/[classId]/import-questions-global.tsx');
const route = read('src/app/api/exams/import/route.ts');
const classPage = read('src/app/(admin)/admin/kelas/[classId]/page.tsx');

const fn = (() => {
  const i = service.indexOf('export async function importQuestionsForClass');
  const j = service.indexOf('\nexport ', i + 1);
  return service.slice(i, j < 0 ? undefined : j);
})();

const JUDUL = ['Pretest Kelas', 'Kuis Pertemuan 1', 'Kuis Pertemuan 2', 'Postest Kelas'];

const baris = (ujian: string, soal = 'Ibu kota Indonesia?') => ({
  [GLOBAL_HEADER]: ujian,
  Pertanyaan: soal,
  'Pilihan A': 'Jakarta',
  'Pilihan B': 'Bandung',
  Jawaban: 'A',
  Pembahasan: '',
});

/**
 * Satu berkas memuat soal seluruh ujian satu kelas.
 *
 * Tanpa kolom penanda, dua puluh kuis berarti dua puluh berkas dan dua puluh
 * kali membuka halaman yang berbeda.
 *
 * One sheet holds every exam's questions for a class.
 *
 * With no marker column, twenty quizzes mean twenty files and twenty visits to
 * different pages.
 */
describe('membaca berkas banyak ujian', () => {
  it('mengelompokkan soalnya menurut kolom ujiannya', () => {
    const { perExam, errors } = parseGlobalQuestionRows(
      [baris('Pretest Kelas'), baris('Kuis Pertemuan 1'), baris('Kuis Pertemuan 1')],
      JUDUL
    );
    expect(errors).toEqual([]);
    expect(perExam.get('Pretest Kelas')).toHaveLength(1);
    expect(perExam.get('Kuis Pertemuan 1')).toHaveLength(2);
  });

  it('mencocokkan nama ujian tanpa memperhatikan huruf besar-kecil dan spasi', () => {
    // Berkas yang disusun ulang di Excel kerap membawa spasi di ujung selnya,
    // dan menolak berkas karena itu memindahkan pekerjaan merapikan ke orangnya.
    //
    // A sheet reworked in Excel often carries trailing spaces in its cells, and
    // rejecting it over that moves the tidying work onto the person.
    const { perExam, errors } = parseGlobalQuestionRows(
      [baris('  kuis pertemuan 1  '), baris('KUIS  PERTEMUAN  2')],
      JUDUL
    );
    expect(errors).toEqual([]);
    // Dikelompokkan di bawah judul resminya, bukan ejaan yang diketik.
    // Grouped under the official title, not the spelling typed.
    expect(perExam.has('Kuis Pertemuan 1')).toBe(true);
    expect(perExam.has('Kuis Pertemuan 2')).toBe(true);
  });

  it('menolak nama ujian yang tidak ada dan menyebut yang tersedia', () => {
    // Satu salah ketik -- "Kuis Pertemuan I" dengan huruf i -- akan membuat
    // ujian kembar yang tidak pernah terbit, tidak terlihat peserta, dan tidak
    // disadari siapa pun sampai nilainya tidak muncul.
    //
    // One typo -- "Kuis Pertemuan I" with a letter i -- would spawn a twin exam
    // that is never published, never seen by participants, and noticed by nobody
    // until its scores fail to appear.
    const { perExam, errors } = parseGlobalQuestionRows([baris('Kuis Pertemuan I')], JUDUL);
    expect(perExam.size).toBe(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('tidak ada di kelas ini');
    // Judulnya disebutkan: ditolak tanpa menyebut pilihannya, admin menebak
    // ejaan yang benar sambil membuka tab lain.
    //
    // The titles are named: refused without them, an admin guesses at the right
    // spelling with another tab open.
    expect(errors[0]).toContain('Kuis Pertemuan 1');
  });

  it('menolak baris yang kolom ujiannya kosong', () => {
    const tanpa = { ...baris('x') };
    delete (tanpa as Record<string, unknown>)[GLOBAL_HEADER];
    const { errors } = parseGlobalQuestionRows([tanpa], JUDUL);
    expect(errors[0]).toContain(GLOBAL_HEADER);
  });

  it('melewati baris yang seluruhnya kosong', () => {
    // Berkas Excel kerap membawa baris kosong di bawah datanya, dan
    // menolaknya akan menuntut orangnya menghapus baris yang tidak terlihat.
    //
    // Excel sheets often carry blank rows beneath their data, and refusing them
    // would have the person delete rows they cannot see.
    const { perExam, errors } = parseGlobalQuestionRows([baris('Pretest Kelas'), {}], JUDUL);
    expect(errors).toEqual([]);
    expect(perExam.get('Pretest Kelas')).toHaveLength(1);
  });

  it('menyebut nomor baris sebagaimana terlihat di Excel', () => {
    // Baris pertama berkas adalah judul kolom, sehingga baris data pertama
    // adalah baris kedua di layar. Menyebut nomor yang berbeda membuat
    // kesalahannya sulit ditemukan.
    //
    // The sheet's first row is the header, so the first data row is row two on
    // screen. Naming a different number makes the mistake hard to find.
    const { errors } = parseGlobalQuestionRows(
      [baris('Pretest Kelas'), baris('Ujian Hantu')],
      JUDUL
    );
    expect(errors[0]).toContain('Baris 3:');
  });

  it('memakai aturan jawaban yang sama dengan impor satu ujian', () => {
    // Aturan yang berbeda antara dua jalur impor membuat berkas yang sama
    // diterima di satu tempat dan ditolak di tempat lain.
    //
    // Different rules between the two import paths would have the same sheet
    // accepted in one place and refused in the other.
    const { perExam } = parseGlobalQuestionRows(
      [{ ...baris('Pretest Kelas'), 'Pilihan A': 'Benar', 'Pilihan B': 'Salah', Jawaban: 'Benar' }],
      JUDUL
    );
    expect(perExam.get('Pretest Kelas')?.[0].kind).toBe('benar-salah');
    expect(perExam.get('Pretest Kelas')?.[0].correctIndex).toBe(0);
  });

  it('meneruskan kesalahan isi barisnya, bukan hanya nama ujiannya', () => {
    const { errors } = parseGlobalQuestionRows(
      [{ ...baris('Pretest Kelas'), Jawaban: 'Z' }],
      JUDUL
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('tidak cocok dengan pilihan mana pun');
  });
});

describe('berkas contohnya', () => {
  it('menaruh kolom ujian di depan kolom pertanyaannya', () => {
    // Kolom penanda di ujung kanan terlewat saat berkasnya dibuka, dan barisnya
    // terisi tanpa penandanya.
    //
    // A marker column at the far right is missed when the sheet is opened, and
    // rows get filled in without it.
    expect(GLOBAL_TEMPLATE_HEADERS[0]).toBe(GLOBAL_HEADER);
  });

  it('memuat judul ujian yang benar-benar ada di kelasnya', () => {
    // Contoh berisi nama karangan menuntut admin mengganti tiap selnya sebelum
    // dapat dipakai.
    //
    // A template holding invented names would have an admin replace every cell
    // before it can be used.
    const rows = globalTemplateRows(JUDUL);
    const dipakai = new Set(rows.map((r) => r[GLOBAL_HEADER]));
    for (const j of JUDUL) expect(dipakai.has(j), j).toBe(true);
  });

  it('tetap memberi contoh saat kelasnya belum punya ujian', () => {
    const rows = globalTemplateRows([]);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('contohnya terbaca kembali tanpa kesalahan', () => {
    // Contoh yang ditolak pembacanya sendiri adalah bug yang ditemukan admin
    // lebih dulu.
    //
    // A template its own parser refuses is a bug the admin finds first.
    const rows = globalTemplateRows(JUDUL);
    const { errors, perExam } = parseGlobalQuestionRows(rows as Record<string, unknown>[], JUDUL);
    expect(errors).toEqual([]);
    expect(perExam.size).toBe(JUDUL.length);
  });
});

/**
 * Impornya mengganti seluruh soal ujian yang disebut berkasnya.
 *
 * Berkas yang sama diimpor dua kali akan menggandakan seluruh soalnya, dan
 * admin yang memperbaiki satu ejaan lalu mengimpor ulang mendapat dua salinan
 * tiap soal.
 *
 * The import replaces every question of the exams its sheet names.
 *
 * Importing the same sheet twice would double every question, and an admin fixing
 * one spelling then re-importing would get two copies of each.
 */
describe('mengganti soal lama', () => {
  it('menghapus soal lama ujian yang disentuhnya', () => {
    expect(fn).toMatch(/hapus\.push\(\(b\) => b\.delete\(d\.ref\)\)/);
    expect(fn).toMatch(/collection\('examAnswerKeys'\)\.doc\(d\.id\)/);
  });

  it('menyelesaikan penghapusannya sebelum menulis yang baru', () => {
    // Terbalik, kegagalan di tengah dapat menyisakan soal lama dan baru
    // bersamaan dalam satu ujian, dan peserta mengerjakan soal rangkap.
    //
    // The other way round, a failure midway could leave old and new questions
    // together in one exam, and participants would sit duplicated questions.
    expect(fn.indexOf('await jalankan(hapus)')).toBeLessThan(fn.indexOf('await jalankan(tulis)'));
  });

  it('memeriksa seluruh judulnya sebelum satu soal pun ditulis', () => {
    // Satu judul yang tidak dikenal di baris terakhir tidak boleh menyisakan
    // ujian sebelumnya sudah terganti.
    //
    // One unknown title in the last row must not leave the earlier exams already
    // replaced.
    expect(fn.indexOf('if (asing.length > 0)')).toBeLessThan(fn.indexOf('const batch'));
    expect(fn.indexOf('if (asing.length > 0)')).toBeLessThan(fn.indexOf('await jalankan'));
  });

  it('menghapus gambar soal lama dari penyimpanan', () => {
    // Batch Firestore hanya menulis dokumen; gambar yang dokumennya sudah
    // terhapus tidak dapat ditemukan lagi untuk dibersihkan, dan tetap
    // ditagihkan.
    //
    // A Firestore batch only writes documents; an image whose document is gone can
    // no longer be found to clean up, and is still billed.
    expect(fn).toMatch(/deleteExamImage\(actor, p\)/);
    expect(fn.indexOf('deleteExamImage')).toBeLessThan(fn.indexOf('await jalankan(hapus)'));
  });

  it('menyetel ulang jumlah soalnya, bukan menambahkannya', () => {
    // Ditambahkan, jumlahnya akan terus naik meski soalnya digantikan, dan
    // daftar kelas menyebut angka yang tidak cocok dengan isinya.
    //
    // Added to, the count would keep rising although the questions were replaced,
    // and the class list would name a figure that does not match its contents.
    expect(fn).toMatch(/questionCount: questions\.length/);
    expect(fn).not.toMatch(/questionCount: exam\.questionCount \+/);
  });

  it('tidak menyentuh ujian yang tidak disebut berkasnya', () => {
    // Berkas berisi dua kuis tidak boleh mengosongkan dua belas kuis lainnya.
    // A sheet holding two quizzes must not empty the other twelve.
    expect(fn).toMatch(/perExam\.map\(\(x\) => \(\{ exam: petaUjian\.get/);
    expect(fn).toMatch(/sasaran\.map\(\(t\) => db\.collection\('examQuestions'\)\.where\('examId', '==', t\.exam\.id\)/);
  });
});

describe('batas ukuran batch', () => {
  it('memecah penulisannya menjadi beberapa batch', () => {
    // Satu batch Firestore menampung lima ratus operasi, sedangkan empat belas
    // ujian berisi dua puluh soal menuntut seribu lebih -- satu batch akan
    // menolak justru pada kelas yang paling lengkap soalnya.
    //
    // One Firestore batch holds five hundred operations, while fourteen exams of
    // twenty questions need over a thousand -- a single batch would refuse on
    // exactly the class with the fullest question bank.
    expect(fn).toMatch(/const BATAS_BATCH = \d+/);
    expect(fn).toMatch(/i \+= BATAS_BATCH/);
    const batas = Number(fn.match(/const BATAS_BATCH = (\d+)/)?.[1]);
    expect(batas).toBeLessThanOrEqual(500);
    expect(batas).toBeGreaterThan(0);
  });
});

describe('penjagaan dan tampilannya', () => {
  it('dijaga perannya di layanan dan endpointnya', () => {
    expect(fn).toMatch(/requireAdmin\(actor\)/);
    expect(route).toMatch(/actor\.role !== 'admin'/);
  });

  it('memeriksa ulang isi soalnya di server', () => {
    // Berkas dibaca di peramban, dan muatan yang dikirim ke endpoint ini dapat
    // diubah sebelum tiba.
    //
    // The sheet is read in the browser, and the payload sent to this endpoint can
    // be altered before it arrives.
    expect(fn).toMatch(/validateQuestion\(/);
  });

  it('menyebut berapa soal yang akan terhapus sebelum tombolnya ditekan', () => {
    // Penggantian ini memusnahkan soal yang mungkin disusun berjam-jam, dan
    // angkanya adalah satu-satunya tanda bahwa berkasnya menyasar ujian yang
    // salah.
    //
    // This replacement wipes out questions that may have taken hours, and that
    // number is the only sign the sheet is aimed at the wrong exams.
    expect(ui).toMatch(/akanTerganti/);
    expect(ui).toContain('soal yang sudah ada akan terhapus');
  });

  it('menampilkan pratinjau per ujian sebelum mengirim', () => {
    // Dua ratus soal yang langsung masuk tanpa diperiksa berarti dua ratus soal
    // yang harus dibereskan bila kolomnya ternyata tergeser.
    //
    // Two hundred questions landing unchecked means two hundred to clean up when a
    // column turns out to be shifted.
    expect(ui).toMatch(/\{total\} soal untuk \{preview\.size\} ujian/);
  });

  it('menyebut judul ujian yang berlaku di layar', () => {
    // Dibiarkan ditebak, admin mengetik "Kuis 1" sementara ujiannya bernama
    // "Kuis Pertemuan 1", lalu seluruh barisnya ditolak.
    //
    // Left to guesswork, an admin types "Kuis 1" while the exam is called "Kuis
    // Pertemuan 1", and every row is refused.
    expect(ui).toContain('Judul ujian yang berlaku');
  });

  it('menyebut seluruh kesalahannya, bukan yang pertama saja', () => {
    // Berkas dengan sepuluh kesalahan yang dilaporkan satu per satu menuntut
    // sepuluh kali unggah ulang.
    //
    // A sheet with ten mistakes reported one at a time would need ten re-uploads.
    expect(ui).toMatch(/rowErrors\.slice\(0, 12\)/);
    expect(ui).toMatch(/rowErrors\.length - 12/);
  });

  it('terpasang di tab ujian halaman kelas', () => {
    expect(classPage).toMatch(/<ImportQuestionsGlobal/);
    expect(classPage).toMatch(/exams=\{exams\}/);
  });
});
