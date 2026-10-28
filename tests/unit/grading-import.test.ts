// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseScoreRows, scoreTemplateRows, SCORE_HEADERS } from '@/features/grading/import-policy';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const service = read('src/features/grading/service.ts');

const baris = (over: Record<string, string> = {}) => ({
  Email: 'budi@contoh.id',
  'Nilai Capstone': '85',
  Catatan: 'Demo lancar.',
  ...over,
});

/**
 * Berkas nilai disusun orang di Excel setelah rapat penilaian.
 *
 * Judul kolom membawa spasi, dan selalu ada baris kosong di bawahnya. Menolak
 * berkas karena hal-hal itu memindahkan pekerjaan merapikan ke orangnya.
 *
 * The score sheet is written by a person in Excel after the assessment meeting.
 *
 * Headers carry stray spaces, and there are always empty rows below. Rejecting
 * a file over those moves the tidying work onto the person.
 */
describe('pembacaan berkas nilai', () => {
  it('membaca satu baris menjadi satu nilai', () => {
    const { rows, errors } = parseScoreRows([baris()]);
    expect(errors).toEqual([]);
    expect(rows[0]).toEqual({
      email: 'budi@contoh.id',
      capstone: 85,
      note: 'Demo lancar.',
    });
  });

  it('mengabaikan kolom showcase dari berkas lama', () => {
    // Showcase tidak lagi dinilai; berkas lama yang masih membawa kolomnya
    // tetap terbaca. / Showcase is no longer scored; an old sheet still
    // carrying its column still reads.
    const { rows, errors } = parseScoreRows([baris({ 'Nilai Showcase': '78' })]);
    expect(errors).toEqual([]);
    expect(rows[0]).toEqual({ email: 'budi@contoh.id', capstone: 85, note: 'Demo lancar.' });
  });

  it('menolak baris yang nilai capstone-nya kosong', () => {
    // Baris tanpa nilai tidak menyimpan apa-apa, dan membiarkannya lolos membuat
    // laporan impor menghitungnya sebagai berhasil.
    //
    // A row with no score stores nothing, and letting it pass makes the import
    // report count it as a success.
    const { errors } = parseScoreRows([baris({ 'Nilai Capstone': '' })]);
    expect(errors[0]).toContain('masih kosong');
  });

  it('mengabaikan huruf besar-kecil dan spasi pada judul kolom', () => {
    const { rows, errors } = parseScoreRows([
      { ' email ': 'A@Contoh.ID', 'NILAI CAPSTONE': '90' },
    ]);
    expect(errors).toEqual([]);
    expect(rows[0].email).toBe('a@contoh.id');
  });

  it('melewatkan baris yang seluruhnya kosong', () => {
    // Excel hampir selalu menyertakan baris kosong di bawah data.
    // Excel almost always includes empty rows below the data.
    const { rows, errors } = parseScoreRows([baris(), {}, { Email: '', Catatan: '' }]);
    expect(rows).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  it('menolak surel ganda dalam satu berkas', () => {
    // Surel ganda akan menimpa dirinya sendiri, dan yang terbaca terakhir yang
    // tersimpan -- tanpa ada yang tahu nilai mana yang dimaksud.
    //
    // A duplicate email would overwrite itself, and whichever is read last
    // would stick -- with nobody knowing which score was meant.
    const { rows, errors } = parseScoreRows([baris(), baris({ 'Nilai Capstone': '40' })]);
    expect(rows).toHaveLength(1);
    expect(errors[0]).toContain('sudah ada');
  });

  it('menyebut nomor baris sebagaimana terlihat di Excel', () => {
    // Baris pertama berkas adalah judul kolom, sehingga baris data pertama
    // adalah baris kedua di layar.
    //
    // The sheet's first row is the header, so the first data row is row two on
    // screen.
    const { errors } = parseScoreRows([baris(), baris({ Email: 'bukan-surel' })]);
    expect(errors[0]).toContain('Baris 3');
  });

  it('menolak nilai di luar nol sampai seratus', () => {
    expect(parseScoreRows([baris({ 'Nilai Capstone': '150' })]).errors[0]).toContain('antara 0 dan 100');
    expect(parseScoreRows([baris({ 'Nilai Capstone': '-5' })]).errors[0]).toContain('antara 0 dan 100');
  });

  it('menyebut komponen yang bermasalah pada pesannya', () => {
    expect(parseScoreRows([baris({ 'Nilai Capstone': '200' })]).errors[0]).toContain('capstone');
  });

  it('tetap membaca baris yang sah meski ada baris salah', () => {
    // Menolak seluruh berkas karena satu salah ketik memaksa admin mengulang
    // dari awal.
    //
    // Rejecting a whole file over one typo forces the admin to start over.
    const { rows, errors } = parseScoreRows([
      baris(),
      baris({ Email: 'ani@contoh.id', 'Nilai Capstone': 'ngawur' }),
      baris({ Email: 'citra@contoh.id' }),
    ]);
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(1);
  });

  it('membiarkan catatan kosong', () => {
    const { rows, errors } = parseScoreRows([baris({ Catatan: '' })]);
    expect(errors).toEqual([]);
    expect(rows[0].note).toBe('');
  });
});

describe('berkas contoh', () => {
  it('terbaca kembali tanpa kesalahan', () => {
    // Contoh yang ditolak pembacanya sendiri adalah contoh yang menyesatkan.
    // A template its own parser refuses is a misleading template.
    const { rows, errors } = parseScoreRows(scoreTemplateRows());
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
  });

  it('memakai kolom yang sama dengan yang dibaca', () => {
    for (const h of SCORE_HEADERS) {
      expect(Object.keys(scoreTemplateRows()[0]), h).toContain(h);
    }
  });
});

describe('penyimpanan nilai yang diimpor', () => {
  const blok = service.slice(
    service.indexOf('export async function importAssessmentScores'),
    service.indexOf('export async function getFinalGrades')
  );

  it('hanya admin yang dapat mengimpor', () => {
    expect(blok).toContain('requireAdmin(actor)');
  });

  it('mencocokkan surel lewat indeks, bukan memindai seluruh pengguna', () => {
    // Seratus baris menjadi seratus pembacaan berkunci alih-alih seratus
    // pemindaian penuh.
    //
    // A hundred rows become a hundred keyed reads instead of a hundred full
    // scans.
    expect(blok).toMatch(/collection\('emailIndex'\)\.doc\(getEmailHash\(row\.email\)\)/);
  });

  it('melewatkan akun yang bukan peserta', () => {
    // Nilai capstone bagi mentor atau admin tidak pernah terbaca di mana pun.
    // A capstone score for a mentor or admin is never read anywhere.
    expect(blok).toMatch(/user\.role !== 'student'/);
    expect(blok).toContain('Bukan akun peserta');
  });

  it('melaporkan surel yang tidak ditemukan, bukan mengabaikannya', () => {
    // Impor yang melaporkan "100 berhasil" padahal lima surel salah ketik
    // meninggalkan lima peserta tanpa nilai tanpa ada yang tahu.
    //
    // An import reporting "100 succeeded" when five emails were mistyped leaves
    // five participants unscored with nobody the wiser.
    expect(blok).toContain('Surel tidak terdaftar');
    expect(blok).toMatch(/skipped\.push/);
  });

  it('memeriksa ulang nilainya di server', () => {
    // Muatannya dapat diubah setelah diurai peramban.
    // The payload can be altered after the browser parsed it.
    expect(blok).toMatch(/validateAssessmentScore\(row\.capstone/);
  });

  it('menimpa nilai sebelumnya saat diimpor ulang', () => {
    // Satu salah ketik diperbaiki dengan mengunggah berkasnya lagi.
    // One typo is fixed by uploading the file again.
    expect(blok).toMatch(/batch\.set\(db\.collection\('assessmentScores'\)/);
  });

  it('menulis seluruhnya dalam satu batch', () => {
    // Seratus pemanggilan berurutan dapat berhenti di tengah dan menyisakan
    // separuh kelas bernilai.
    //
    // A hundred sequential calls can stop halfway and leave half a class
    // scored.
    expect(blok).toContain('db.batch()');
    expect(blok).toMatch(/batch\.commit\(\)/);
  });

  it('mencatat siapa yang mengimpornya', () => {
    // Angka yang dipertanyakan perlu dapat ditelusuri ke orang yang
    // memasukkannya.
    //
    // A questioned figure needs tracing back to whoever entered it.
    expect(blok).toContain('importedBy: actor.name');
  });
});

describe('perhitungan nilai akhir kelas', () => {
  const blok = service.slice(service.indexOf('export async function getFinalGrades'));

  it('membaca tiap koleksi sekali, bukan per peserta', () => {
    // Dua puluh satu peserta dikali lima komponen menjadi seratus lima kueri
    // untuk satu halaman.
    //
    // Twenty-one participants times five components would be a hundred and five
    // queries for one page.
    expect(blok).toMatch(/await Promise\.all\(\[/);
    expect(blok).not.toMatch(/for \([\s\S]{0,120}await db\.collection/);
  });

  it('mengecualikan pretest dari nilai kuis', () => {
    // Pretest mengukur titik awal sebelum diajar; memasukkannya menghukum
    // peserta karena belum tahu materi yang memang belum diajarkan.
    //
    // A pretest measures the starting point before teaching; folding it in
    // punishes participants for not knowing material not yet taught.
    expect(blok).toMatch(/e\.kind !== 'pretest'/);
  });

  it('memakai nilai tertinggi tiap ujian', () => {
    // Sejalan dengan aturan remedial: percobaan ulang yang lulus sudah dipatok
    // di KKM saat disimpan.
    //
    // In line with the remedial rule: a passing retake was already pinned at
    // the mark when it was stored.
    expect(blok).toMatch(/Math\.max\(peta\.get\(a\.examId\) \?\? 0, a\.score\)/);
  });

  it('hanya menghitung percobaan yang sudah selesai', () => {
    expect(blok).toMatch(/a\.status !== 'selesai'/);
  });

  it('melewatkan peserta nonaktif', () => {
    expect(blok).toMatch(/where\('active', '==', true\)/);
  });

  it('mengurutkan dari nilai tertinggi', () => {
    expect(blok).toMatch(/sort\(\(a, b\) => b\.score - a\.score\)/);
  });
});

describe('halaman nilai akhir', () => {
  const page = read('src/app/(admin)/admin/nilai/page.tsx');
  const panel = read('src/app/(admin)/admin/nilai/import-scores.tsx');
  const shell = read('src/components/app-shell.tsx');

  it('tercantum pada menu admin', () => {
    expect(shell).toContain("href: '/admin/nilai'");
  });

  it('memilih kelas lebih dulu lewat kartu', () => {
    // Nilai dibaca satu kelas dalam satu duduk; daftar gabungan empat kelas
    // menuntut admin menyaring setiap kali membuka halaman.
    //
    // Scores are read one class at a time; a merged list of four classes makes
    // an admin filter every time they open the page.
    expect(page).toMatch(/if \(!selected\)/);
    expect(page).toContain('Kembali ke Daftar Kelas');
  });

  it('menyediakan unduhan contoh sebelum berkasnya dipilih', () => {
    // Tanpa contoh, admin menebak nama kolomnya dan berkasnya ditolak.
    // Without a template an admin guesses the column names and the file is
    // refused.
    expect(panel).toContain('downloadScoreTemplate');
    expect(panel).toContain('scoreTemplateRows()');
  });

  it('menyebut kolomnya di layar, bukan hanya di dalam berkasnya', () => {
    expect(panel).toMatch(/SCORE_HEADERS\.join/);
  });

  it('menampilkan pratinjau sebelum menyimpan', () => {
    // Seratus baris yang langsung masuk tanpa diperiksa berarti seratus nilai
    // yang harus diperbaiki bila kolomnya ternyata tertukar.
    //
    // A hundred rows landing unchecked means a hundred scores to fix when a
    // column turns out to be swapped.
    // Dicocokkan pada awal ekspresinya, bukan di mana pun: pemeriksaan yang
    // longgar tetap lolos ketika blok pratinjaunya dimatikan dengan "false &&"
    // di depannya.
    //
    // Matched at the start of the expression rather than anywhere: a loose
    // check still passes when the preview block is switched off with a leading
    // "false &&".
    expect(panel).toMatch(/\{preview && preview\.length > 0 && \(/);
    expect(panel).toContain('siap disimpan');
  });

  it('menyebut surel yang dilewatkan setelah impor', () => {
    // Impor yang melaporkan "100 berhasil" padahal lima surel salah ketik
    // meninggalkan lima peserta tanpa nilai tanpa ada yang tahu.
    //
    // An import reporting "100 succeeded" when five emails were mistyped leaves
    // five participants unscored with nobody the wiser.
    expect(panel).toMatch(/skipped\.map/);
    expect(panel).toContain('baris dilewatkan');
  });

  it('mengosongkan kolom berkas setelah dibaca', () => {
    // Tanpa ini, memilih berkas bernama sama setelah diperbaiki tidak memicu
    // apa pun.
    //
    // Without this, picking an identically named file after fixing it fires
    // nothing.
    expect(panel).toContain("e.target.value = ''");
  });

  it('menyebut komponen yang belum dinilai', () => {
    // Nilai akhir yang dibaca sebagai final padahal capstone-nya belum masuk
    // akan dipakai untuk keputusan yang salah.
    //
    // A final score read as final when the capstone is not yet in would be used
    // for the wrong decision.
    expect(page).toMatch(/g\.pending\.length > 0/);
    expect(page).toContain('akan naik setelah nilainya masuk');
  });

  it('merinci sumbangan tiap komponen saat barisnya dibuka', () => {
    // Nilai akhir tanpa rinciannya tidak dapat diperiksa, dan peserta yang
    // mempertanyakannya dijawab dengan angka yang sama.
    //
    // A final score without its breakdown cannot be checked, and a participant
    // who questions it is answered with the same number.
    expect(page).toMatch(/g\.breakdown\.map/);
    expect(page).toContain('COMPONENT_LABELS[b.component]');
  });

  it('menyaring lebih dulu, memotong halaman sesudahnya', () => {
    // Memotong lebih dulu akan mencari di dalam sepuluh baris pertama saja.
    // Slicing first would search only within the first ten rows.
    expect(page).toMatch(/\.slice\(page \* PAGE_SIZE, \(page \+ 1\) \* PAGE_SIZE\)/);
    expect(page).toMatch(/visible = grades\.filter/);
  });

  it('menyebut bobot tiap komponen pada halamannya', () => {
    // Nilai akhir yang bobotnya tidak disebut tidak dapat dihitung ulang
    // siapa pun yang mempertanyakannya.
    //
    // A final score whose weights go unstated cannot be recomputed by anyone
    // who questions it.
    expect(page).toContain('GRADE_WEIGHTS');
  });
});
