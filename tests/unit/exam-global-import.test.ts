// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cariSesiKuis } from '@/features/exams/service';
import { resolve } from 'node:path';
import {
  jenisDariJudul,
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
const settingsPage = read('src/app/(admin)/admin/pengaturan/page.tsx');
const tab = read('src/app/(admin)/admin/pengaturan/import-soal-tab.tsx');

const fn = (() => {
  const i = service.indexOf('export async function importQuestionsForClass');
  const j = service.indexOf('\nexport ', i + 1);
  return service.slice(i, j < 0 ? undefined : j);
})();

/**
 * Menegaskan bahwa a muncul sebelum b, dan keduanya benar-benar ada.
 *
 * indexOf mengembalikan -1 untuk yang hilang, dan -1 selalu lebih kecil dari
 * posisi mana pun: tes urutan yang tidak memeriksa keberadaannya tetap hijau
 * justru ketika penjagaannya dihapus.
 *
 * Asserts that a appears before b, and that both actually exist.
 *
 * indexOf returns -1 for something missing, and -1 is smaller than any position:
 * an ordering test that does not check existence stays green exactly when the
 * safeguard is deleted.
 */
function sebelum(teks: string, a: string, b: string) {
  const i = teks.indexOf(a);
  const j = teks.indexOf(b);
  expect(i, `tidak ditemukan: ${a}`).toBeGreaterThan(-1);
  expect(j, `tidak ditemukan: ${b}`).toBeGreaterThan(-1);
  expect(i, `${a} harus sebelum ${b}`).toBeLessThan(j);
}

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

  it('menandai judul yang belum ada sebagai ujian baru, bukan menolaknya', () => {
    // Membuat empat belas ujian satu per satu sebelum dapat mengimpor soalnya
    // adalah pekerjaan yang justru ingin dihindari dengan impor ini.
    //
    // Creating fourteen exams one by one before the questions can be imported is
    // the very work this import exists to avoid.
    const { perExam, newExams, errors } = parseGlobalQuestionRows(
      [baris('Pretest Kelas'), baris('Kuis Pertemuan 5: Distribusi'), baris('Kuis Pertemuan 5: Distribusi')],
      ['Pretest Kelas']
    );
    expect(errors).toEqual([]);
    expect(perExam.get('Kuis Pertemuan 5: Distribusi')).toHaveLength(2);
    // Ujian yang sudah ada tidak ikut terdaftar sebagai baru.
    // An existing exam is not listed as new.
    expect(newExams).toEqual([{ title: 'Kuis Pertemuan 5: Distribusi', kind: 'kuis' }]);
  });

  it('menyatukan ejaan berbeda dari judul baru yang sama', () => {
    // Tanpa itu, "Kuis Pertemuan 1" dan "kuis  pertemuan 1 " menjadi dua ujian
    // terpisah dengan soal yang terbelah di antara keduanya.
    //
    // Without it, "Kuis Pertemuan 1" and "kuis  pertemuan 1 " would become two
    // separate exams with the questions split between them.
    const { perExam, newExams } = parseGlobalQuestionRows(
      [baris('Kuis Pertemuan 1'), baris('kuis  pertemuan 1 ')],
      []
    );
    expect(newExams).toHaveLength(1);
    expect(perExam.get('Kuis Pertemuan 1')).toHaveLength(2);
  });

  it('menampilkan salah ketik sebagai ujian baru, bukan menyatukannya diam-diam', () => {
    // "Kuis Pertemuan I" dengan huruf i bukan "Kuis Pertemuan 1". Menyamakannya
    // adalah menebak; yang benar adalah menampilkannya sebagai ujian baru di
    // pratinjau supaya admin melihatnya sebelum menekan impor.
    //
    // "Kuis Pertemuan I" with a letter i is not "Kuis Pertemuan 1". Treating them as
    // one would be a guess; the right thing is to show it as a new exam in the
    // preview so the admin sees it before pressing import.
    const { newExams } = parseGlobalQuestionRows([baris('Kuis Pertemuan I')], ['Kuis Pertemuan 1']);
    expect(newExams.map((b) => b.title)).toEqual(['Kuis Pertemuan I']);
    expect(ui).toMatch(/BARU · \{EXAM_KIND_LABELS/);
    expect(ui).toContain('ujian baru akan dibuat');
  });

  it('menolak judul yang jenisnya tidak terbaca', () => {
    // Ujian yang salah jenis tampil di tempat yang salah bagi peserta, misalnya
    // pretest yang muncul di kartu pertemuan.
    //
    // An exam of the wrong kind shows up in the wrong place for participants, such
    // as a pretest appearing on a meeting card.
    const { perExam, newExams, errors } = parseGlobalQuestionRows([baris('Ujian Akhir Bab 3')], []);
    expect(perExam.size).toBe(0);
    expect(newExams).toEqual([]);
    expect(errors[0]).toContain('Awali judulnya dengan Kuis, Pretest, atau Postest');
  });

  it('tidak membuat ujian baru yang seluruh barisnya gagal', () => {
    // Ujian kosong yang tercipta dari baris yang ditolak hanya menambah satu hal
    // untuk dihapus.
    //
    // An empty exam born of refused rows only adds one more thing to delete.
    const { newExams, errors } = parseGlobalQuestionRows(
      [{ ...baris('Kuis Pertemuan 9'), Jawaban: 'Z' }],
      []
    );
    expect(errors).toHaveLength(1);
    expect(newExams).toEqual([]);
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
    sebelum(fn, 'await jalankan(hapus)', 'await jalankan(tulis)');
  });

  it('memeriksa seluruh judulnya sebelum satu soal pun ditulis', () => {
    // Satu judul yang tidak dikenal di baris terakhir tidak boleh menyisakan
    // ujian sebelumnya sudah terganti.
    //
    // One unknown title in the last row must not leave the earlier exams already
    // replaced.
    sebelum(fn, 'if (asing.length > 0)', 'await jalankan');
  });

  it('menghapus gambar soal lama dari penyimpanan', () => {
    // Batch Firestore hanya menulis dokumen; gambar yang dokumennya sudah
    // terhapus tidak dapat ditemukan lagi untuk dibersihkan, dan tetap
    // ditagihkan.
    //
    // A Firestore batch only writes documents; an image whose document is gone can
    // no longer be found to clean up, and is still billed.
    expect(fn).toMatch(/deleteExamImage\(actor, p\)/);
    sebelum(fn, 'deleteExamImage', 'await jalankan(hapus)');
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

  it('terpasang sebagai tab di Pengaturan', () => {
    expect(settingsPage).toMatch(/'impor-soal', 'Impor Soal Ujian'/);
    expect(settingsPage).toMatch(/tab === 'impor-soal' && <ImportSoalTab \/>/);
    expect(tab).toMatch(/<ImportQuestionsGlobal/);
  });

  it('hanya ada satu pintu ke impor yang mengganti soal', () => {
    // Impor ini menghapus bank soal. Dua pintu ke tindakan merusak berarti dua
    // tempat yang harus diperiksa saat ada yang salah, dan yang kedua kerap
    // terlupakan saat penjagaannya diperbaiki.
    //
    // This import wipes a question bank. Two doors to a destructive action mean two
    // places to check when something goes wrong, and the second is routinely
    // forgotten when the safeguards are improved.
    expect(classPage).not.toMatch(/ImportQuestionsGlobal/);
  });

  it('menuntut kelasnya dipilih sebelum berkasnya dapat diunggah', () => {
    // Tombol pilih berkas yang aktif tanpa kelas akan menerima berkas lalu
    // menolak seluruh barisnya, dan admin mengira berkasnya yang salah.
    //
    // A live file button with no class would accept a sheet and then refuse every
    // row, and the admin would assume the sheet was at fault.
    expect(tab).toMatch(/\{classId \? \(/);
    expect(tab).toContain('Pilih kelas lebih dulu');
  });

  it('tidak meminta kelasnya sebagai kolom di dalam berkasnya', () => {
    // "Kuis Pertemuan 1" ada di empat kelas dengan soal yang berbeda-beda, dan
    // satu baris yang salah kelas akan menimpa bank soal kelas lain tanpa
    // terlihat di mana pun.
    //
    // "Kuis Pertemuan 1" exists in four classes with different questions, and one
    // row aimed at the wrong class would overwrite another class's question bank
    // with nothing anywhere to show it.
    expect(GLOBAL_TEMPLATE_HEADERS).not.toContain('Kelas');
  });

  it('menggambar ulang impornya saat kelasnya berganti', () => {
    // Tanpa itu, pratinjau dan pesan dari kelas sebelumnya tertinggal di layar
    // sementara kelas yang dituju sudah berbeda.
    //
    // Without it, the previous class's preview and messages linger on screen while
    // the target class has already changed.
    expect(tab).toMatch(/key=\{classId\}/);
  });
});

/**
 * Jenis ujian baru dibaca dari awal judulnya.
 *
 * The kind of a new exam is read from the start of its title.
 */
describe('jenis ujian dari judulnya', () => {
  it('mengenali kuis, pretest, dan postest', () => {
    expect(jenisDariJudul('Kuis Pertemuan 3: Content Strategy')).toBe('kuis');
    expect(jenisDariJudul('Pretest Kelas')).toBe('pretest');
    expect(jenisDariJudul('Pre-test Awal')).toBe('pretest');
    expect(jenisDariJudul('Postest Kelas')).toBe('posttest');
    expect(jenisDariJudul('Posttest Kelas')).toBe('posttest');
    expect(jenisDariJudul('  KUIS 1')).toBe('kuis');
  });

  it('membaca awal judulnya saja, bukan kata di mana pun', () => {
    // "Kuis Persiapan Postest" adalah kuis; mencari kata "postest" di seluruh
    // judul akan membuatnya menjadi postest dan memindahkannya dari kartu
    // pertemuannya.
    //
    // "Kuis Persiapan Postest" is a quiz; looking for "postest" anywhere in the
    // title would make it a posttest and move it off its meeting card.
    expect(jenisDariJudul('Kuis Persiapan Postest')).toBe('kuis');
    expect(jenisDariJudul('Latihan Pretest')).toBe(null);
  });

  it('tidak menebak judul tanpa awalan yang dikenal', () => {
    expect(jenisDariJudul('Ujian Akhir')).toBe(null);
    expect(jenisDariJudul('Kuisioner Kepuasan')).toBe(null);
  });
});

/**
 * Kuis baru dipasangkan ke pertemuannya.
 *
 * Kuis wajib terikat pada satu pertemuan: tanpa sesi induknya, peserta tidak
 * punya tempat menemukannya.
 *
 * A new quiz is paired with its meeting.
 *
 * A quiz must hang off one meeting: without its parent session, participants have
 * nowhere to find it.
 */
describe('memasangkan kuis ke pertemuannya', () => {
  const SESI = [
    { id: 's1', title: 'Pertemuan 1: Fondasi Strategi dan Riset dengan AI' },
    { id: 's3', title: 'Pertemuan 3: Content Strategy dan Brand Voice Engine' },
    { id: 's10', title: 'Pertemuan 10: Fondasi Paid Ads Meta dan TikTok' },
  ];

  it('mencocokkan persis dengan judul sesinya lebih dulu', () => {
    // Judul bawaan sebuah kuis adalah "Kuis" disusul judul sesinya, sehingga
    // berkas yang memakai judul bawaan cocok persis.
    //
    // A quiz's default title is "Kuis" followed by its session's title, so a sheet
    // using default titles matches exactly.
    expect(cariSesiKuis('Kuis Pertemuan 3: Content Strategy dan Brand Voice Engine', SESI)?.id).toBe('s3');
  });

  it('jatuh ke nomor pertemuannya bila judulnya berbeda', () => {
    expect(cariSesiKuis('Kuis Pertemuan 1', SESI)?.id).toBe('s1');
  });

  it('tidak tertukar antara pertemuan 1 dan pertemuan 10', () => {
    // Pencocokan awalan teks akan menemukan "Pertemuan 10" saat mencari
    // "Pertemuan 1".
    //
    // Prefix matching on text would find "Pertemuan 10" when looking for
    // "Pertemuan 1".
    expect(cariSesiKuis('Kuis Pertemuan 1', SESI)?.id).toBe('s1');
    expect(cariSesiKuis('Kuis Pertemuan 10', SESI)?.id).toBe('s10');
  });

  it('tidak memilih saat dua sesi memakai nomor yang sama', () => {
    // Dua sesi bernomor sama tidak dapat dipilih tanpa menebak, dan kuis yang
    // menempel di pertemuan yang salah dikerjakan pada hari yang salah.
    //
    // Two sessions sharing a number cannot be picked between without guessing, and
    // a quiz on the wrong meeting is sat on the wrong day.
    const kembar = [...SESI, { id: 's3b', title: 'Pertemuan 3: Sesi Susulan' }];
    expect(cariSesiKuis('Kuis Pertemuan 3', kembar)).toBe(null);
  });

  it('mengembalikan null bila tidak ada pertemuan yang cocok', () => {
    expect(cariSesiKuis('Kuis Pertemuan 99', SESI)).toBe(null);
    expect(cariSesiKuis('Kuis Bonus', SESI)).toBe(null);
  });
});

describe('membuat ujian baru di server', () => {
  it('memeriksa seluruh ujian baru sebelum satu dokumen pun ditulis', () => {
    // Kuis di baris terakhir yang tidak menemukan pertemuannya tidak boleh
    // menyisakan tiga belas ujian lain sudah terbuat dan terisi.
    //
    // A quiz in the last row that cannot find its meeting must not leave thirteen
    // other exams already created and filled.
    // Posisinya dipastikan ada lebih dulu: indexOf mengembalikan -1 untuk yang
    // hilang, dan -1 selalu lebih kecil dari posisi mana pun -- tes urutan
    // tanpa ini tetap hijau justru ketika pemeriksaannya dihapus.
    //
    // Its position is confirmed to exist first: indexOf returns -1 for something
    // missing, and -1 is smaller than any position -- an ordering test without this
    // stays green exactly when the check is deleted.
    const periksa = fn.indexOf('if (masalah.length > 0)');
    expect(periksa).toBeGreaterThan(-1);
    expect(periksa).toBeLessThan(fn.indexOf('await jalankan('));
    expect(periksa).toBeLessThan(fn.indexOf('deleteExamImage'));
  });

  it('menolak kuis baru yang tidak menemukan pertemuannya', () => {
    expect(fn).toMatch(/pertemuannya tidak ditemukan di jadwal kelas ini/);
  });

  it('membiarkan ujian barunya sebagai draf', () => {
    // Menerbitkannya sendiri berarti seratus soal langsung terlihat peserta
    // sebelum admin sempat memeriksanya sekali pun.
    //
    // Publishing it automatically would put a hundred questions in front of
    // participants before an admin has checked even one.
    const blok = fn.slice(fn.indexOf('const exam: ExamDocument = {'), fn.indexOf('ujianBaru.push(exam)'));
    expect(blok).toMatch(/published: false/);
  });

  it('menulis ujian barunya sebelum soal-soalnya', () => {
    // Soal yang menunjuk ujian yang belum ada akan menjadi yatim bila batch
    // berikutnya gagal.
    //
    // A question pointing at an exam that does not exist yet would be orphaned if
    // a later batch failed.
    const ujian = fn.indexOf('for (const exam of ujianBaru)');
    expect(ujian).toBeGreaterThan(-1);
    expect(ujian).toBeLessThan(fn.indexOf("collection('examQuestions').doc(id)"));
  });

  it('membaca sesi gabungan juga', () => {
    // Sesi gabungan hanya memuat classIds; tanpa membacanya, kuis untuk onboarding
    // bersama tidak pernah menemukan sesinya.
    //
    // Shared sessions carry only classIds; without reading them, a quiz for a shared
    // onboarding never finds its session.
    expect(fn).toMatch(/where\('classIds', 'array-contains', classId\)/);
  });

  it('menyebut berapa ujian yang dibuat', () => {
    expect(fn).toMatch(/created: ujianBaru\.length/);
    expect(ui).toMatch(/data\.created > 0/);
  });

  it('tetap menyediakan tombolnya saat kelas belum punya ujian', () => {
    // Impor inilah yang membuat ujiannya; menahan tombolnya sampai ujian dibuat
    // satu per satu mengembalikan pekerjaan yang hendak dihindari.
    //
    // This import is what creates the exams; holding the buttons back until exams
    // are made one by one brings back the very work it exists to avoid.
    expect(ui).not.toMatch(/judul\.length === 0 \? \(/);
    expect(ui).not.toContain('Buat ujiannya lebih dulu');
    expect(tab).not.toContain('belum punya ujian');
  });
});

/**
 * Status ujian ditanyakan setelah impornya selesai.
 *
 * The exams' status is asked once the import finishes.
 */
describe('konfirmasi status setelah impor', () => {
  const terbit = (() => {
    const i = service.indexOf('export async function publishExams');
    const j = service.indexOf('\nexport ', i + 1);
    return service.slice(i, j < 0 ? undefined : j);
  })();
  const rutePublish = read('src/app/api/exams/publish/route.ts');

  it('menanyakannya setelah impor berhasil, bukan sebelumnya', () => {
    // Soal yang gagal masuk tidak boleh sempat diterbitkan, dan pilihan sebelum
    // impor dibuat tanpa tahu ujian mana yang benar-benar terisi.
    //
    // Questions that failed to land must never get published, and a choice made
    // before the import is made without knowing which exams actually got filled.
    const kirimBlok = ui.slice(ui.indexOf('async function kirim()'), ui.indexOf('const total ='));
    sebelum(kirimBlok, "if (!res.ok) throw new Error(data.error || 'Gagal mengimpor soal')", 'setMenungguStatus(data.draftExamIds');
  });

  it('hanya menanyakan ujian yang memang masih draf', () => {
    // Ujian yang sudah terbit sebelum impor tidak perlu ditanyakan lagi, dan
    // menyebutnya dalam hitungan membuat angkanya menyesatkan.
    //
    // An exam already published before the import needs no asking, and counting
    // it would make the number misleading.
    expect(fn).toMatch(/draftExamIds: sasaran\.filter\(\(t\) => !t\.exam\.published\)/);
    expect(ui).toMatch(/\{menungguStatus\.length > 0 && \(/);
  });

  it('menyebut bahwa ujian yang terbit langsung dapat dikerjakan hari itu', () => {
    // Tidak ada pembatasan menurut tanggal pertemuan. Admin yang tidak tahu ini
    // akan menerbitkan semuanya, lalu mendapati peserta mengerjakan kuis materi
    // yang belum diajarkan.
    //
    // Nothing gates exams by meeting date. An admin unaware of this would publish
    // everything and then find participants sitting quizzes on untaught material.
    expect(ui).toContain('langsung dapat dikerjakan peserta hari ini');
    expect(ui).toContain('pertemuan yang belum berlangsung');
  });

  it('tidak tertutup dengan mengeklik latarnya', () => {
    // Menutupnya tanpa memilih adalah keputusan "biarkan draf" yang diambil
    // tanpa sengaja.
    //
    // Closing it without choosing would be a "keep as drafts" decision taken by
    // accident.
    const dialog = ui.slice(ui.indexOf('function StatusDialog'));
    expect(dialog.slice(0, dialog.indexOf('aria-labelledby="status-impor-judul"') + 200)).not.toMatch(/onClick=/);
  });

  it('tetap terbuka bila penerbitannya gagal', () => {
    // Menutupnya membuat admin mengira ujiannya sudah terbit padahal masih draf.
    // Closing it would have the admin believe the exams are published while they
    // are still drafts.
    const blok = ui.slice(ui.indexOf('async function terbitkan()'), ui.indexOf('return (', ui.indexOf('async function terbitkan()')));
    const tangkap = blok.slice(blok.indexOf('catch'));
    expect(tangkap).not.toMatch(/onDone/);
    expect(tangkap).toMatch(/setError/);
  });

  it('memeriksa seluruh ujiannya sebelum menerbitkan satu pun', () => {
    // Terbit sebagian berarti peserta melihat kuis pertemuan 3 tanpa kuis
    // pertemuan 2, dan tidak ada yang memberi tahu bagian mana yang tertinggal.
    //
    // A partial publish would show the meeting 3 quiz without meeting 2's, with
    // nothing saying which ones were left behind.
    sebelum(terbit, 'if (masalah.length > 0)', 'batch.commit()');
    expect(terbit).toMatch(/const batch = db\.batch\(\)/);
  });

  it('menolak ujian dari kelas lain', () => {
    expect(terbit).toMatch(/exam\.classId !== classId/);
  });

  it('memakai aturan terbit yang sama dengan menerbitkan satu per satu', () => {
    // Ujian tanpa soal menolak setiap peserta yang membukanya.
    // An exam with no questions turns away every participant who opens it.
    expect(terbit).toMatch(/canPublishExam\(exam\)/);
  });

  it('dijaga perannya', () => {
    expect(terbit).toMatch(/requireAdmin\(actor\)/);
    expect(rutePublish).toMatch(/actor\.role !== 'admin'/);
  });
});
