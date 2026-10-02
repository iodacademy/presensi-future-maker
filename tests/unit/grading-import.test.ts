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
  'Nilai Showcase': '78',
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
      showcase: 78,
      note: 'Demo lancar.',
    });
  });

  it('menerima satu kolom nilai yang kosong', () => {
    // Showcase dinilai dua pekan setelah capstone, sehingga berkas yang sama
    // diunggah dua kali -- mula-mula tanpa showcase, lalu diisi.
    //
    // Showcase is assessed two weeks after the capstone, so the same sheet is
    // uploaded twice -- first without showcase, then filled.
    const { rows, errors } = parseScoreRows([baris({ 'Nilai Showcase': '' })]);
    expect(errors).toEqual([]);
    expect(rows[0].capstone).toBe(85);
    expect(rows[0].showcase).toBe(null);
  });

  it('menolak baris yang kedua nilainya kosong', () => {
    // Baris tanpa nilai apa pun tidak menyimpan apa-apa, dan membiarkannya
    // lolos membuat laporan impor menghitungnya sebagai berhasil.
    //
    // A row with no score stores nothing, and letting it pass makes the import
    // report count it as a success.
    const { errors } = parseScoreRows([baris({ 'Nilai Capstone': '', 'Nilai Showcase': '' })]);
    expect(errors[0]).toContain('tidak ada nilai');
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
    expect(parseScoreRows([baris({ 'Nilai Showcase': '-5' })]).errors[0]).toContain('antara 0 dan 100');
  });

  it('menyebut komponen yang bermasalah pada pesannya', () => {
    // Dua kolom nilai diimpor sekaligus; pesan tanpa nama kolom menuntut admin
    // memeriksa keduanya.
    //
    // Two score columns are imported at once; a message without the column name
    // makes the admin check both.
    expect(parseScoreRows([baris({ 'Nilai Showcase': '200' })]).errors[0]).toContain('showcase');
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

  it('memperlihatkan baris yang showcase-nya belum diisi', () => {
    const { rows } = parseScoreRows(scoreTemplateRows());
    expect(rows.some((r) => r.showcase === null)).toBe(true);
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

  it('melewatkan kolom nilai yang kosong, tidak menulisnya nol', () => {
    // Menulis nol pada impor pertama memberi peserta nilai showcase nol
    // selama dua pekan.
    //
    // Writing zero on the first import would give participants a showcase score
    // of zero for two weeks.
    expect(blok).toMatch(/if \(score === null\) continue;/);
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
