// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const service = read('src/features/exams/service.ts');
const route = read('src/app/api/exports/exams/route.ts');
const classPage = read('src/app/(admin)/admin/kelas/[classId]/page.tsx');

const blok = (nama: string) => {
  const i = service.indexOf(`export async function ${nama}`);
  if (i < 0) throw new Error(`Fungsi ${nama} tidak ditemukan`);
  const j = service.indexOf('\nexport ', i + 1);
  return service.slice(i, j < 0 ? undefined : j);
};

const fn = blok('getClassExamScores');

/**
 * Rekap nilai seluruh ujian satu kelas dalam satu berkas.
 *
 * Yang dicari admin adalah satu peserta di seluruh ujiannya, dan rekap per
 * ujian menuntut empat belas berkas untuk menjawabnya.
 *
 * Every exam's scores for one class in one file.
 *
 * What an admin looks for is one participant across every exam, and a per-exam
 * recap would need fourteen files to answer that.
 */
describe('rekap nilai ujian', () => {
  it('membaca sekali untuk seluruh kelas, bukan per ujian', () => {
    // Empat belas ujian lewat getExamRoster berarti dua puluh delapan kueri
    // untuk satu berkas, dan peserta yang sama dibaca empat belas kali.
    //
    // Fourteen exams through getExamRoster would be twenty-eight queries for one
    // file, with the same participants read fourteen times.
    expect(fn).not.toMatch(/getExamRoster/);
    expect(fn).toMatch(/await Promise\.all\(\[/);
    expect(fn).toMatch(/db\s*\.collection\('users'\)/);
  });

  it('menjalankan pembacaan percobaannya bersamaan', () => {
    // Berurutan, tiga puluh ujian berarti tiga puluh perjalanan ke basis data
    // yang saling menunggu.
    //
    // In sequence, thirty exams would be thirty database round trips each waiting
    // on the last.
    expect(fn).toMatch(/await Promise\.all\(\s*exams\.map\(/);
  });

  it('tidak memakai "in" untuk daftar ujiannya', () => {
    // Firestore membatasi "in" pada tiga puluh nilai, dan satu kelas dapat
    // memiliki lebih banyak ujian daripada itu.
    //
    // Firestore caps "in" at thirty values, and a class can hold more exams.
    expect(fn).not.toMatch(/'in',/);
  });
});

describe('urutan kolomnya', () => {
  it('menaruh pretest di depan dan posttest di belakang', () => {
    // Keduanya menjepit perjalanan belajar peserta, dan membacanya berdampingan
    // adalah alasan berkas ini dibuka.
    //
    // The two bracket a participant's progress, and reading them side by side is
    // why this file is opened.
    expect(fn).toMatch(/pretest: 0, kuis: 1, posttest: 2/);
  });

  it('mengurutkan kuis menurut tanggal pertemuannya, bukan judulnya', () => {
    // Urutan abjad judul akan menaruh "Kuis Pertemuan 10" sebelum "Kuis
    // Pertemuan 2".
    //
    // Sorting titles alphabetically would put "Kuis Pertemuan 10" before "Kuis
    // Pertemuan 2".
    expect(fn).toMatch(/tanggalSesi\.get\(a\.sessionId\)/);
    expect(fn).toMatch(/ta\.localeCompare\(tb\)/);
  });

  it('menyebut jenis tiap ujian di judul kolomnya', () => {
    // "Kuis Pertemuan 1" dan "Pretest Kelas" tidak selalu terbaca jenisnya dari
    // judul yang diketik admin.
    //
    // "Kuis Pertemuan 1" and "Pretest Kelas" do not always reveal their kind from
    // an admin's typing.
    expect(route).toMatch(/EXAM_KIND_LABELS\[e\.kind\]/);
    expect(route).toMatch(/KKM \$\{e\.passingScore\}/);
  });
});

describe('sel yang tidak dikerjakan', () => {
  it('dibiarkan null pada layanannya, bukan nol', () => {
    // Nol berarti dikerjakan dan salah semua, dan menyamakan keduanya
    // menurunkan rata-rata kelas dengan angka yang tidak pernah diperoleh
    // siapa pun.
    //
    // Zero means attempted and all wrong, and merging the two drags the class
    // average down with a figure nobody earned.
    expect(fn).toMatch(/\?\?\s*null/);
    expect(fn).not.toMatch(/\?\?\s*0\b/);
  });

  it('dibiarkan kosong pada berkasnya', () => {
    expect(route).toMatch(/if \(x === null\) return sel\(''\)/);
  });

  it('merata-rata hanya yang dikerjakan', () => {
    // Membaginya dengan seluruh ujian membuat peserta yang baru mengerjakan
    // separuhnya terbaca seperti yang gagal pada separuh lainnya.
    //
    // Dividing by every exam would have someone who has sat half of them read as
    // having failed the rest.
    expect(route).toMatch(/r\.scores\.filter\(\(x\): x is number => x !== null\)/);
    expect(route).toMatch(/ada\.length === 0 \? '' :/);
  });
});

describe('nilai hasil mengulang', () => {
  it('menandai nilai dari percobaan kedua atau ketiga', () => {
    // Angkanya dipatok pada KKM oleh aturan remedial, bukan nilai mentah yang
    // diperoleh, dan membacanya sebagai nilai mentah menyesatkan.
    //
    // The figure was capped at the passing score by the remedial rule, not the raw
    // score earned, and reading it as raw misleads.
    expect(route).toMatch(/n && n > 1 \? `\$\{x\} \(percobaan \$\{n\}\)`/);
    expect(fn).toMatch(/attemptNumber/);
  });

  it('memakai nilai tertinggi tiap peserta', () => {
    expect(fn).toMatch(/if \(!ada \|\| a\.score > ada\.score\)/);
  });

  it('hanya menghitung percobaan yang selesai', () => {
    // Percobaan yang masih berjalan belum punya nilai akhir, dan menyertakannya
    // menampilkan angka yang masih akan berubah.
    //
    // An attempt still running has no final score, and including it would show a
    // number that is still going to change.
    expect(fn).toMatch(/a\.status !== 'selesai' \|\| a\.score === null/);
  });
});

describe('lingkup berkasnya', () => {
  it('satu kelas satu berkas, bukan satu jurusan', () => {
    // Kuis pertemuan ketiga di Yogyakarta dan di Surabaya adalah ujian berbeda
    // dengan soal berbeda, dan menyatukannya ke satu kolom menyajikan dua angka
    // yang tidak sebanding seolah setara.
    //
    // The third meeting's quiz in Yogyakarta and in Surabaya are different exams
    // with different questions, and merging them into one column would present two
    // incomparable numbers as if they were the same.
    expect(fn).toMatch(/where\('classId', '==', classId\)/);
    expect(route).toMatch(/searchParams\.get\('classId'\)/);
    expect(route).toMatch(/if \(!classId\)/);
  });

  it('hanya memuat peserta yang masih aktif', () => {
    // Peserta yang sudah keluar tidak lagi mengikuti ujiannya, dan barisnya yang
    // kosong terbaca sebagai yang belum mengerjakan.
    //
    // A departed participant no longer sits these exams, and their empty row would
    // read as someone yet to attempt them.
    expect(fn).toMatch(/where\('active', '==', true\)/);
  });

  it('dijaga perannya', () => {
    expect(route).toMatch(/actor\.role !== 'admin'/);
    expect(fn).toMatch(/requireAdmin\(actor\)/);
  });
});

describe('berkas yang dihasilkan', () => {
  it('menetralkan sel yang terbaca sebagai rumus', () => {
    // Nama yang diawali tanda hubung akan dijalankan sebagai perintah saat
    // berkasnya dibuka, dan sebagian spreadsheet menawarkan menjalankan program
    // luar dari rumus itu.
    //
    // A name beginning with a hyphen would execute when the file is opened, and
    // some spreadsheets offer to run external programs from such a formula.
    expect(route).toMatch(/\['=', '\+', '-', '@'\]\.includes\(teks\.charAt\(0\)\)/);
    // Seluruh sel dilewatkan penetralnya, termasuk judul kolomnya yang memuat
    // judul ujian yang diketik admin.
    //
    // Every cell goes through it, including the column headings, which carry exam
    // titles typed by an admin.
    expect(route).toMatch(/kepala\.map\(sel\)/);
  });

  it('menyertakan BOM agar Excel membacanya sebagai UTF-8', () => {
    // Tanpanya Excel di Windows membaca berkas ini sebagai ANSI, dan nama
    // ber-aksen muncul rusak.
    //
    // Without it Excel on Windows reads this as ANSI, and accented names come out
    // mangled.
    expect(route).toMatch(/`\\ufeff\$\{csv\}`/);
  });

  it('menolak kelas yang belum punya ujian', () => {
    // Berkas berisi hanya nama peserta tanpa satu kolom nilai pun tidak
    // menjawab apa pun, dan admin akan mengira ekspornya yang rusak.
    //
    // A file holding only names with no score column answers nothing, and the
    // admin would assume the export is broken.
    expect(route).toMatch(/data\.exams\.length === 0/);
  });

  it('menamai berkasnya dengan jurusan dan tanggalnya', () => {
    expect(route).toMatch(/data\.programName \|\| data\.className/);
    expect(route).toMatch(/wibDate\(\)/);
  });
});

describe('tombol unduhnya', () => {
  it('berada di tab ujian halaman kelas', () => {
    expect(classPage).toMatch(/\/api\/exports\/exams\?classId=\$\{encodeURIComponent\(classId\)\}/);
    expect(classPage).toContain('Unduh Rekap Nilai Ujian');
  });

  it('menyebut bahwa yang kosong berarti tidak dikerjakan', () => {
    // Sel kosong tanpa keterangan terbaca sebagai data yang hilang, bukan
    // sebagai ujian yang memang belum dikerjakan.
    //
    // An empty cell with no explanation reads as missing data rather than an exam
    // genuinely not yet attempted.
    expect(classPage).toContain('dibiarkan kosong, bukan diisi nol');
  });
});
