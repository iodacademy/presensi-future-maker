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

function ambilKolom(row: Record<string, unknown>, nama: string): string {
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

    const text = ambilKolom(row, 'Pertanyaan');
    const kosong = TEMPLATE_HEADERS.every((h) => !ambilKolom(row, h));
    if (kosong) return;

    if (!text) {
      errors.push(`Baris ${nomor}: kolom Pertanyaan masih kosong`);
      return;
    }

    const options = ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Pilihan E']
      .map((h) => ambilKolom(row, h))
      .filter(Boolean)
      .map((t) => ({ text: t }));

    if (options.length < 2) {
      errors.push(`Baris ${nomor}: butuh minimal dua pilihan jawaban`);
      return;
    }

    const jawaban = ambilKolom(row, 'Jawaban').toUpperCase();
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
        `Baris ${nomor}: Jawaban "${ambilKolom(row, 'Jawaban')}" tidak cocok dengan pilihan mana pun`
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
      explanation: ambilKolom(row, 'Pembahasan'),
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


/**
 * Kolom tambahan pada berkas yang memuat soal banyak ujian sekaligus.
 *
 * Judulnya "Ujian", bukan "Pertemuan": satu berkas memuat pretest dan postest
 * yang bukan milik pertemuan mana pun, dan kolom bernama pertemuan akan
 * dikosongkan pada barisnya lalu dibaca sebagai baris yang belum selesai.
 *
 * The extra column on a sheet holding several exams' questions.
 *
 * It is named "Ujian" rather than "Pertemuan": one sheet holds the pretest and
 * posttest, which belong to no meeting, and a column named for meetings would be
 * left blank on their rows and then read as unfinished.
 */
export const GLOBAL_HEADER = 'Ujian';

export const GLOBAL_TEMPLATE_HEADERS = [GLOBAL_HEADER, ...TEMPLATE_HEADERS] as const;

export interface GlobalParseResult {
  /** Soal per nama ujian, sebagaimana tertulis di berkasnya / Questions per exam name, as written in the sheet */
  perExam: Map<string, ParsedQuestion[]>;
  errors: string[];
}

/**
 * Membaca berkas yang memuat soal beberapa ujian sekaligus.
 *
 * Nama ujiannya dicocokkan dengan ujian yang sudah ada, bukan dipakai membuat
 * ujian baru: satu salah ketik -- "Kuis Pertemuan I" dengan huruf i -- akan
 * membuat ujian kembar yang tidak pernah terbit, tidak terlihat peserta, dan
 * tidak disadari siapa pun sampai nilainya tidak muncul.
 *
 * Reads a sheet holding several exams' questions.
 *
 * Exam names are matched against existing exams rather than used to create new
 * ones: one typo -- "Kuis Pertemuan I" with a letter i -- would spawn a twin exam
 * that is never published, never seen by participants, and noticed by nobody until
 * its scores fail to appear.
 */
export function parseGlobalQuestionRows(
  rows: Record<string, unknown>[],
  /** Judul ujian yang tersedia di kelasnya / The exam titles available in the class */
  judulTersedia: string[]
): GlobalParseResult {
  const perExam = new Map<string, ParsedQuestion[]>();
  const errors: string[] = [];

  // Dicocokkan tanpa memperhatikan huruf besar-kecil dan spasi berlebih, sama
  // seperti judul kolomnya: berkas yang disusun ulang di Excel kerap membawa
  // spasi di ujung selnya.
  //
  // Matched ignoring case and stray whitespace, as the column headers are: a sheet
  // reworked in Excel often carries trailing spaces in its cells.
  const normal = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
  const petaJudul = new Map(judulTersedia.map((j) => [normal(j), j]));

  rows.forEach((row, i) => {
    const nomor = i + 2;

    const kosong = GLOBAL_TEMPLATE_HEADERS.every((h) => !ambilKolom(row, h));
    if (kosong) return;

    const namaUjian = ambilKolom(row, GLOBAL_HEADER);
    if (!namaUjian) {
      errors.push(`Baris ${nomor}: kolom ${GLOBAL_HEADER} masih kosong`);
      return;
    }

    const cocok = petaJudul.get(normal(namaUjian));
    if (!cocok) {
      // Judul yang tersedia disebutkan. Ditolak tanpa menyebut pilihannya,
      // admin menebak-nebak ejaan yang benar sambil membuka tab lain.
      //
      // The available titles are named. Refused without them, an admin guesses at
      // the right spelling with another tab open.
      errors.push(
        `Baris ${nomor}: ujian "${namaUjian}" tidak ada di kelas ini. Yang tersedia: ${judulTersedia.join(', ') || 'belum ada ujian'}`
      );
      return;
    }

    // Barisnya dibaca pembaca yang sudah ada, sehingga aturan jawabannya,
    // benar-salahnya, dan pesan kesalahannya persis sama dengan impor satu
    // ujian.
    //
    // The row goes through the existing parser, so its answer rules, true-false
    // detection, and error messages are identical to a single-exam import.
    const hasil = parseQuestionRows([row]);
    if (hasil.errors.length > 0) {
      // Nomor barisnya diperbaiki: pembaca itu membaca satu baris dan selalu
      // menyebutnya baris 2.
      //
      // The row number is corrected: that parser sees one row and always calls it
      // row 2.
      errors.push(...hasil.errors.map((e) => e.replace(/^Baris \d+:/, `Baris ${nomor}:`)));
      return;
    }

    if (!perExam.has(cocok)) perExam.set(cocok, []);
    perExam.get(cocok)!.push(...hasil.questions);
  });

  return { perExam, errors };
}

/**
 * Baris contoh untuk berkas global.
 *
 * Contohnya memuat pretest, satu kuis pertemuan, dan postest, sehingga terlihat
 * bahwa ketiganya memang ditulis pada satu berkas yang sama.
 *
 * Example rows for the global template.
 *
 * The example holds a pretest, one meeting quiz, and a posttest, so it is visible
 * that all three do belong in one and the same sheet.
 */
export function globalTemplateRows(judulContoh: string[]): Record<string, string>[] {
  const contoh = templateRows();
  const judul = judulContoh.length > 0 ? judulContoh : ['Pretest Kelas', 'Kuis Pertemuan 1', 'Postest Kelas'];

  return judul.flatMap((j) =>
    contoh.map((baris) => ({ [GLOBAL_HEADER]: j, ...baris }))
  );
}
