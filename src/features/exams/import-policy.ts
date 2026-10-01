// Pembacaan berkas soal dari spreadsheet / Reading a question sheet from a spreadsheet
import type { QuestionKind } from './types';

export interface ParsedQuestion {
  kind: QuestionKind;
  text: string;
  options: { text: string }[];
  correctIndex: number;
  explanation: string;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  /** Kesalahan per baris, menyebut nomor barisnya / Per-row errors, naming the row number */
  errors: string[];
}

/** Kolom yang dibaca, apa adanya pada berkas contoh / The columns read, as they appear in the template */
export const TEMPLATE_HEADERS = [
  'Pertanyaan',
  'Pilihan A',
  'Pilihan B',
  'Pilihan C',
  'Pilihan D',
  'Pilihan E',
  'Jawaban',
  'Pembahasan',
] as const;

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
 * Membaca satu baris menjadi sebuah soal.
 *
 * Jenis soalnya tidak diminta sebagai kolom. Baris dengan dua pilihan berbunyi
 * benar dan salah sudah cukup menjelaskan dirinya, dan satu kolom lagi yang
 * harus diisi benar adalah satu kolom lagi yang dapat salah.
 *
 * Reads one row into a question.
 *
 * The question kind is not asked for as a column. A row with two options
 * reading true and false already explains itself, and one more column to fill
 * in correctly is one more column that can be filled in wrongly.
 */
export function parseQuestionRows(rows: Record<string, unknown>[]): ParseResult {
  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];

  rows.forEach((row, i) => {
    // Baris pertama berkas adalah judul kolom, sehingga baris data pertama
    // adalah baris kedua di layar Excel. Menyebut nomor yang berbeda dari yang
    // dilihat orangnya membuat kesalahannya sulit ditemukan.
    //
    // The sheet's first row is the header, so the first data row is row two on
    // the person's screen. Naming a different number than they see makes the
    // mistake hard to find.
    const nomor = i + 2;

    const text = ambil(row, 'Pertanyaan');
    const kosong = TEMPLATE_HEADERS.every((h) => !ambil(row, h));
    if (kosong) return;

    if (!text) {
      errors.push(`Baris ${nomor}: kolom Pertanyaan masih kosong`);
      return;
    }

    const options = ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Pilihan E']
      .map((h) => ambil(row, h))
      .filter(Boolean)
      .map((t) => ({ text: t }));

    if (options.length < 2) {
      errors.push(`Baris ${nomor}: butuh minimal dua pilihan jawaban`);
      return;
    }

    const jawaban = ambil(row, 'Jawaban').toUpperCase();
    if (!jawaban) {
      errors.push(`Baris ${nomor}: kolom Jawaban masih kosong`);
      return;
    }

    // Jawaban diterima sebagai huruf pilihannya maupun sebagai teksnya. Admin
    // yang menyalin jawaban dari kolom pilihan menulis teks, yang mengetik
    // sendiri menulis huruf; menolak salah satunya hanya menambah kegagalan
    // yang tidak perlu.
    //
    // The answer is accepted as its option letter or as its text. An admin
    // copying from the option column writes text, one typing it out writes a
    // letter; refusing either only adds needless failures.
    let correctIndex = -1;
    if (/^[A-E]$/.test(jawaban)) {
      correctIndex = jawaban.charCodeAt(0) - 65;
    } else {
      correctIndex = options.findIndex((o) => o.text.toLowerCase() === jawaban.toLowerCase());
    }

    if (correctIndex < 0 || correctIndex >= options.length) {
      errors.push(
        `Baris ${nomor}: Jawaban "${ambil(row, 'Jawaban')}" tidak cocok dengan pilihan mana pun`
      );
      return;
    }

    const isBenarSalah =
      options.length === 2 &&
      options.every((o) => ['benar', 'salah'].includes(o.text.toLowerCase()));

    questions.push({
      kind: isBenarSalah ? 'benar-salah' : 'pilihan-ganda',
      text,
      options,
      correctIndex,
      explanation: ambil(row, 'Pembahasan'),
    });
  });

  return { questions, errors };
}

/**
 * Baris contoh untuk berkas unduhan.
 *
 * Contohnya memuat satu soal pilihan ganda dan satu benar-salah, sehingga
 * bentuk keduanya terlihat tanpa perlu membaca keterangan terpisah.
 *
 * Example rows for the downloadable template.
 *
 * The example holds one multiple-choice and one true-false question, so both
 * shapes are visible without reading separate instructions.
 */
export function templateRows(): Record<string, string>[] {
  return [
    {
      Pertanyaan: 'Hook mana yang dipakai untuk menyimpan state komponen?',
      'Pilihan A': 'useEffect',
      'Pilihan B': 'useState',
      'Pilihan C': 'useRef',
      'Pilihan D': 'useMemo',
      'Pilihan E': '',
      Jawaban: 'B',
      Pembahasan: 'useState mengembalikan nilai sekarang dan fungsi pengubahnya.',
    },
    {
      Pertanyaan: 'useEffect berjalan sebelum komponen dirender.',
      'Pilihan A': 'Benar',
      'Pilihan B': 'Salah',
      'Pilihan C': '',
      'Pilihan D': '',
      'Pilihan E': '',
      Jawaban: 'Salah',
      Pembahasan: 'useEffect berjalan setelah render selesai.',
    },
  ];
}
