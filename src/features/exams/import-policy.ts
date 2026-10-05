// Pembacaan berkas soal dari spreadsheet / Reading a question sheet from a spreadsheet
import type { ExamKind, QuestionKind } from './types';

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
  /** Soal per judul ujian / Questions per exam title */
  perExam: Map<string, ParsedQuestion[]>;
  /**
   * Ujian yang belum ada di kelasnya dan akan dibuat saat impor.
   *
   * Disebut terpisah supaya pratinjaunya dapat menampilkannya sebelum tombol
   * impor ditekan: salah ketik "Kuis Pertemuan I" baru terlihat sebagai salah
   * ketik bila muncul di daftar ujian baru, bukan diam-diam menjadi ujian kembar.
   *
   * Exams not yet in the class, to be created by the import.
   *
   * Named separately so the preview can show them before the import button is
   * pressed: a typo like "Kuis Pertemuan I" only shows up as a typo when it appears
   * in the list of new exams, rather than silently becoming a twin exam.
   */
  newExams: { title: string; kind: ExamKind }[];
  errors: string[];
}

/**
 * Menentukan jenis ujian dari awal judulnya.
 *
 * Dibaca dari awal judul saja, bukan dari kata di mana pun: "Kuis Persiapan
 * Postest" adalah kuis, dan mencari kata "postest" di seluruh judul akan
 * membuatnya menjadi postest.
 *
 * Works out an exam's kind from the start of its title.
 *
 * Read from the start of the title only, not from a word anywhere in it: "Kuis
 * Persiapan Postest" is a quiz, and looking for "postest" anywhere would turn it
 * into a posttest.
 */
export function jenisDariJudul(judul: string): ExamKind | null {
  const awal = judul.trim().toLowerCase();
  if (/^(kuis|quiz)\b/.test(awal)) return 'kuis';
  if (/^pre-?\s?test\b/.test(awal)) return 'pretest';
  if (/^(post-?\s?test|postest)\b/.test(awal)) return 'posttest';
  return null;
}

/** Dicocokkan tanpa huruf besar-kecil dan spasi berlebih / Matched ignoring case and stray whitespace */
export function normalJudul(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Membaca berkas yang memuat soal beberapa ujian sekaligus.
 *
 * Judul yang sudah ada di kelasnya dipakai apa adanya. Judul yang belum ada
 * akan dibuat sebagai ujian baru, dengan jenis yang dibaca dari awal judulnya.
 * Membuat empat belas ujian satu per satu sebelum dapat mengimpor soalnya
 * adalah pekerjaan yang justru ingin dihindari dengan impor ini.
 *
 * Judul yang jenisnya tidak terbaca ditolak, bukan ditebak: ujian yang salah
 * jenis tampil di tempat yang salah bagi peserta, misalnya pretest yang muncul
 * di kartu pertemuan.
 *
 * Reads a sheet holding several exams' questions.
 *
 * Titles already in the class are used as they are. Titles not yet there become
 * new exams, their kind read from the start of the title. Creating fourteen exams
 * one by one before the questions can be imported is the very work this import
 * exists to avoid.
 *
 * A title whose kind cannot be read is refused rather than guessed: an exam of the
 * wrong kind shows up in the wrong place for participants, such as a pretest
 * appearing on a meeting card.
 */
export function parseGlobalQuestionRows(
  rows: Record<string, unknown>[],
  /** Judul ujian yang sudah ada di kelasnya / The exam titles already in the class */
  judulTersedia: string[]
): GlobalParseResult {
  const perExam = new Map<string, ParsedQuestion[]>();
  const errors: string[] = [];

  // Kuncinya judul yang dinormalkan, nilainya ejaan yang dipakai: ejaan resmi
  // untuk ujian yang sudah ada, ejaan pertama yang ditemui untuk ujian baru.
  // Tanpa itu, "Kuis Pertemuan 1" dan "kuis pertemuan 1 " menjadi dua ujian.
  //
  // Keyed by the normalised title, valued by the spelling used: the official
  // spelling for existing exams, the first spelling met for new ones. Without that,
  // "Kuis Pertemuan 1" and "kuis pertemuan 1 " would become two exams.
  const petaJudul = new Map(judulTersedia.map((j) => [normalJudul(j), j]));
  const baru = new Map<string, { title: string; kind: ExamKind }>();

  rows.forEach((row, i) => {
    const nomor = i + 2;

    const kosong = GLOBAL_TEMPLATE_HEADERS.every((h) => !ambilKolom(row, h));
    if (kosong) return;

    const namaUjian = ambilKolom(row, GLOBAL_HEADER).replace(/\s+/g, ' ');
    if (!namaUjian) {
      errors.push(`Baris ${nomor}: kolom ${GLOBAL_HEADER} masih kosong`);
      return;
    }

    const kunci = normalJudul(namaUjian);
    let judul = petaJudul.get(kunci);

    if (!judul) {
      const kind = jenisDariJudul(namaUjian);
      if (!kind) {
        errors.push(
          `Baris ${nomor}: jenis ujian "${namaUjian}" tidak terbaca. Awali judulnya dengan Kuis, Pretest, atau Postest`
        );
        return;
      }
      if (!baru.has(kunci)) baru.set(kunci, { title: namaUjian, kind });
      judul = baru.get(kunci)!.title;
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

    if (!perExam.has(judul)) perExam.set(judul, []);
    perExam.get(judul)!.push(...hasil.questions);
  });

  // Ujian baru yang semua barisnya gagal tidak ikut dibuat: ujian kosong yang
  // tercipta dari baris yang ditolak hanya menambah satu hal untuk dihapus.
  //
  // A new exam whose rows all failed is not created: an empty exam born of refused
  // rows only adds one more thing to delete.
  const newExams = [...baru.values()].filter((b) => perExam.has(b.title));

  return { perExam, newExams, errors };
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
