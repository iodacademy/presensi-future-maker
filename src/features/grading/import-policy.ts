// Pembacaan berkas nilai capstone dan showcase / Reading the capstone and showcase score sheet
import { validateAssessmentScore } from './policy';

export interface ParsedScoreRow {
  email: string;
  capstone: number | null;
  showcase: number | null;
  note: string;
}

export interface ScoreParseResult {
  rows: ParsedScoreRow[];
  /** Kesalahan per baris, menyebut nomor barisnya / Per-row errors, naming the row number */
  errors: string[];
}

/** Kolom yang dibaca, apa adanya pada berkas contoh / The columns read, as they appear in the template */
export const SCORE_HEADERS = ['Email', 'Nilai Capstone', 'Nilai Showcase', 'Catatan'] as const;

function ambil(row: Record<string, unknown>, nama: string): string {
  // Nama kolom dicocokkan tanpa memperhatikan huruf besar-kecil dan spasi
  // berlebih: berkas yang disusun ulang di Excel kerap membawa spasi di ujung
  // judul kolomnya, dan menolak berkas karena itu memindahkan pekerjaan
  // merapikan ke orangnya.
  //
  // Column names match ignoring case and stray whitespace: a sheet reworked in
  // Excel often carries trailing spaces in its headers, and rejecting the file
  // over that moves the tidying work onto the person.
  const kunci = Object.keys(row).find((k) => k.trim().toLowerCase() === nama.toLowerCase());
  if (!kunci) return '';
  const nilai = row[kunci];
  return nilai === null || nilai === undefined ? '' : String(nilai).trim();
}

/**
 * Membaca berkas nilai menjadi baris-baris yang siap disimpan.
 *
 * Satu kolom nilai boleh kosong: showcase dinilai dua pekan setelah capstone,
 * sehingga berkas yang sama diunggah dua kali -- mula-mula dengan kolom
 * showcase kosong, lalu diisi. Menolak baris yang salah satu kolomnya kosong
 * memaksa admin menyusun dua berkas berbeda.
 *
 * Reads a score sheet into rows ready to store.
 *
 * One score column may be empty: showcase is assessed two weeks after the
 * capstone, so the same sheet is uploaded twice -- first with the showcase
 * column empty, then filled. Refusing rows with one column blank would force
 * the admin to maintain two different files.
 */
export function parseScoreRows(rows: Record<string, unknown>[]): ScoreParseResult {
  const hasil: ParsedScoreRow[] = [];
  const errors: string[] = [];
  const terlihat = new Set<string>();

  rows.forEach((row, i) => {
    // Baris pertama berkas adalah judul kolom, sehingga baris data pertama
    // adalah baris kedua di layar Excel. Menyebut nomor yang berbeda dari yang
    // dilihat orangnya membuat kesalahannya sulit ditemukan.
    //
    // The sheet's first row is the header, so the first data row is row two on
    // the person's screen. Naming a different number than they see makes the
    // mistake hard to find.
    const nomor = i + 2;

    const kosong = SCORE_HEADERS.every((h) => !ambil(row, h));
    if (kosong) return;

    const email = ambil(row, 'Email').toLowerCase();
    if (!email) {
      errors.push(`Baris ${nomor}: kolom Email masih kosong`);
      return;
    }
    if (!email.includes('@')) {
      errors.push(`Baris ${nomor}: "${email}" bukan alamat surel`);
      return;
    }

    // Surel ganda dalam satu berkas akan menimpa dirinya sendiri, dan yang
    // terbaca terakhir yang tersimpan -- tanpa ada yang tahu nilai mana yang
    // dimaksud.
    //
    // A duplicate email in one file would overwrite itself, and whichever is
    // read last would stick -- with nobody knowing which score was meant.
    if (terlihat.has(email)) {
      errors.push(`Baris ${nomor}: ${email} sudah ada di baris sebelumnya`);
      return;
    }
    terlihat.add(email);

    const mentahCapstone = ambil(row, 'Nilai Capstone');
    const mentahShowcase = ambil(row, 'Nilai Showcase');

    if (!mentahCapstone && !mentahShowcase) {
      errors.push(`Baris ${nomor}: tidak ada nilai capstone maupun showcase`);
      return;
    }

    let capstone: number | null = null;
    let showcase: number | null = null;

    try {
      if (mentahCapstone) capstone = validateAssessmentScore(mentahCapstone, 'capstone');
      if (mentahShowcase) showcase = validateAssessmentScore(mentahShowcase, 'showcase');
    } catch (e) {
      errors.push(`Baris ${nomor}: ${(e as Error).message}`);
      return;
    }

    hasil.push({ email, capstone, showcase, note: ambil(row, 'Catatan') });
  });

  return { rows: hasil, errors };
}

/**
 * Baris contoh untuk berkas unduhan.
 *
 * Contohnya memperlihatkan satu baris dengan kedua nilai dan satu baris yang
 * showcase-nya masih kosong, sehingga bentuk keduanya terlihat tanpa perlu
 * membaca keterangan terpisah.
 *
 * Example rows for the downloadable template.
 *
 * The example shows one row with both scores and one whose showcase is still
 * blank, so both shapes are visible without reading separate instructions.
 */
export function scoreTemplateRows(): Record<string, string>[] {
  return [
    {
      Email: 'peserta1@contoh.id',
      'Nilai Capstone': '85',
      'Nilai Showcase': '78',
      Catatan: 'Dokumentasi rapi, demo lancar.',
    },
    {
      Email: 'peserta2@contoh.id',
      'Nilai Capstone': '92',
      'Nilai Showcase': '',
      Catatan: 'Showcase belum dinilai.',
    },
  ];
}
