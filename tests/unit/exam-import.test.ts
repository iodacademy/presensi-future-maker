// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseQuestionRows, templateRows, TEMPLATE_HEADERS } from '@/features/exams/import-policy';

const baris = (over: Record<string, string> = {}) => ({
  Pertanyaan: 'Ibu kota Indonesia?',
  'Pilihan A': 'Bandung',
  'Pilihan B': 'Jakarta',
  'Pilihan C': 'Surabaya',
  'Pilihan D': 'Medan',
  Jawaban: 'B',
  Pembahasan: 'Jakarta adalah ibu kota.',
  ...over,
});

/**
 * Berkas soal disusun orang di Excel, bukan dihasilkan mesin.
 *
 * Judul kolom membawa spasi, jawaban kadang ditulis sebagai huruf dan kadang
 * disalin sebagai teks, dan selalu ada baris kosong di bawahnya. Menolak
 * berkas karena hal-hal itu memindahkan pekerjaan merapikan ke orangnya.
 *
 * A question sheet is written by a person in Excel, not produced by a machine.
 *
 * Headers carry stray spaces, answers are sometimes a letter and sometimes
 * pasted text, and there are always empty rows at the bottom. Rejecting a file
 * over those moves the tidying work onto the person.
 */
describe('pembacaan berkas soal', () => {
  it('membaca satu baris menjadi satu soal', () => {
    const { questions, errors } = parseQuestionRows([baris()]);
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(1);
    expect(questions[0].text).toBe('Ibu kota Indonesia?');
    expect(questions[0].options).toHaveLength(4);
    expect(questions[0].correctIndex).toBe(1);
  });

  it('menerima jawaban sebagai huruf maupun sebagai teksnya', () => {
    // Admin yang menyalin dari kolom pilihan menulis teks, yang mengetik
    // sendiri menulis huruf.
    //
    // An admin copying from the option column writes text, one typing it out
    // writes a letter.
    expect(parseQuestionRows([baris({ Jawaban: 'B' })]).questions[0].correctIndex).toBe(1);
    expect(parseQuestionRows([baris({ Jawaban: 'Jakarta' })]).questions[0].correctIndex).toBe(1);
    expect(parseQuestionRows([baris({ Jawaban: 'jakarta' })]).questions[0].correctIndex).toBe(1);
  });

  it('mengabaikan huruf besar-kecil dan spasi pada judul kolom', () => {
    // Berkas yang disusun ulang di Excel kerap membawa spasi di ujung judulnya.
    // A sheet reworked in Excel often carries trailing spaces in its headers.
    const { questions, errors } = parseQuestionRows([
      { ' pertanyaan ': 'Soal?', 'PILIHAN A': 'A', 'pilihan b': 'B', ' Jawaban': 'A' },
    ]);
    expect(errors).toEqual([]);
    expect(questions[0].text).toBe('Soal?');
  });

  it('melewatkan baris yang seluruhnya kosong', () => {
    // Excel hampir selalu menyertakan baris kosong di bawah data.
    // Excel almost always includes empty rows below the data.
    const { questions, errors } = parseQuestionRows([baris(), {}, { Pertanyaan: '', 'Pilihan A': '' }]);
    expect(questions).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  it('mengenali soal benar-salah dari pilihannya', () => {
    // Satu kolom lagi yang harus diisi benar adalah satu kolom lagi yang dapat
    // salah.
    //
    // One more column to fill in correctly is one more column that can be
    // filled in wrongly.
    const { questions } = parseQuestionRows([
      { Pertanyaan: 'Bumi itu bulat.', 'Pilihan A': 'Benar', 'Pilihan B': 'Salah', Jawaban: 'A' },
    ]);
    expect(questions[0].kind).toBe('benar-salah');
  });

  it('menyebut soal empat pilihan sebagai pilihan ganda', () => {
    expect(parseQuestionRows([baris()]).questions[0].kind).toBe('pilihan-ganda');
  });

  it('menyebut nomor baris sebagaimana terlihat di Excel', () => {
    // Baris pertama berkas adalah judul kolom, sehingga baris data pertama
    // adalah baris kedua di layar.
    //
    // The sheet's first row is the header, so the first data row is row two on
    // screen.
    const { errors } = parseQuestionRows([baris(), baris({ Jawaban: '' })]);
    expect(errors[0]).toContain('Baris 3');
  });

  it('menolak jawaban yang tidak cocok dengan pilihan mana pun', () => {
    // Kunci yang meleset membuat soal itu menilai setiap jawaban sebagai
    // salah, dan tidak ada yang dapat lulus karenanya.
    //
    // A key that misses makes the question mark every answer wrong, and nobody
    // can pass because of it.
    const { errors, questions } = parseQuestionRows([baris({ Jawaban: 'Z' })]);
    expect(questions).toHaveLength(0);
    expect(errors[0]).toContain('tidak cocok');
  });

  it('menolak baris berisi satu pilihan', () => {
    const { errors } = parseQuestionRows([
      { Pertanyaan: 'Soal?', 'Pilihan A': 'Cuma satu', Jawaban: 'A' },
    ]);
    expect(errors[0]).toContain('minimal dua pilihan');
  });

  it('menolak pertanyaan kosong yang kolom lainnya terisi', () => {
    const { errors } = parseQuestionRows([baris({ Pertanyaan: '' })]);
    expect(errors[0]).toContain('Pertanyaan');
  });

  it('tetap membaca baris yang sah meski ada baris salah', () => {
    // Menolak seluruh berkas karena satu salah ketik memaksa admin mengulang
    // dari awal.
    //
    // Rejecting a whole file over one typo forces the admin to start over.
    const { questions, errors } = parseQuestionRows([baris(), baris({ Jawaban: 'Z' }), baris()]);
    expect(questions).toHaveLength(2);
    expect(errors).toHaveLength(1);
  });

  it('membiarkan pembahasan kosong', () => {
    // Pembahasan tidak wajib; soal tanpa pembahasan tetap dapat dinilai.
    // An explanation is optional; a question without one still grades.
    const { questions, errors } = parseQuestionRows([baris({ Pembahasan: '' })]);
    expect(errors).toEqual([]);
    expect(questions[0].explanation).toBe('');
  });

  it('melewatkan pilihan yang dikosongkan di tengah', () => {
    const { questions } = parseQuestionRows([
      baris({ 'Pilihan C': '', 'Pilihan D': '', Jawaban: 'B' }),
    ]);
    expect(questions[0].options).toHaveLength(2);
    expect(questions[0].correctIndex).toBe(1);
  });
});

describe('berkas contoh', () => {
  it('terbaca kembali tanpa kesalahan', () => {
    // Contoh yang ditolak pembacanya sendiri adalah contoh yang menyesatkan.
    // A template its own parser refuses is a misleading template.
    const { questions, errors } = parseQuestionRows(templateRows());
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(2);
  });

  it('memperlihatkan kedua bentuk soal', () => {
    const { questions } = parseQuestionRows(templateRows());
    expect(questions.map((q) => q.kind).sort()).toEqual(['benar-salah', 'pilihan-ganda']);
  });

  it('memakai kolom yang sama dengan yang dibaca', () => {
    for (const h of TEMPLATE_HEADERS) {
      expect(Object.keys(templateRows()[0]), h).toContain(h);
    }
  });
});

describe('alur impor pada layar admin', () => {
  const read = (path: string) =>
    readFileSync(resolve(process.cwd(), path), 'utf-8');
  const panel = read('src/app/(admin)/admin/kelas/[classId]/import-questions.tsx');
  const builder = read('src/app/(admin)/admin/kelas/[classId]/exam-builder.tsx');
  const service = read('src/features/exams/service.ts');

  it('ujian baru langsung masuk ke penyuntingnya', () => {
    // Ujian baru tidak punya soal, dan kembali ke daftar berarti admin harus
    // menekannya lagi untuk melanjutkan apa yang baru saja ia mulai.
    //
    // A new exam has no questions, and returning to the list would have the
    // admin tap it again to continue what they just started.
    expect(builder).toMatch(/router\.push\(`\/admin\/ujian\/\$\{data\.id\}`\)/);
  });

  it('menyebut langkah berikutnya pada ujian yang belum bersoal', () => {
    // Halaman kosong tanpa keterangan tidak memberi tahu admin dari mana
    // memulai.
    //
    // An empty page with no note does not tell an admin where to begin.
    const editor =
  read('src/app/(admin)/admin/ujian/[examId]/page.tsx') +
  read('src/app/(admin)/admin/ujian/[examId]/question-editor.tsx');
    expect(editor).toMatch(/questions\.length === 0 \?/);
    expect(editor).toContain('Belum ada soal');
  });

  it('menampilkan pratinjau sebelum menyimpan', () => {
    // Dua puluh soal yang langsung masuk tanpa diperiksa berarti dua puluh
    // soal yang harus dihapus satu per satu bila kolomnya ternyata tergeser.
    //
    // Twenty questions landing unchecked means twenty to delete one by one
    // when a column turns out to be shifted.
    expect(panel).toMatch(/preview && preview\.length > 0/);
    expect(panel).toContain('siap diimpor');
  });

  it('menyediakan berkas contoh untuk diunduh', () => {
    // Tanpa contoh, admin menebak nama kolomnya dan berkasnya ditolak.
    // Without a template an admin guesses the column names and the file is
    // refused.
    const tombol = read('src/app/(admin)/admin/kelas/[classId]/question-template.tsx');
    expect(tombol).toContain('XLSX.writeFile');
    expect(tombol).toContain('templateRows()');
    expect(panel).toContain('<TemplateDownloadButton');
  });

  it('menawarkan contohnya sebelum ujiannya dibuat', () => {
    // Admin menyiapkan soalnya di Excel lebih dulu; tombol yang hanya ada di
    // dalam kartu ujian menuntut ujian dibuat dulu untuk sekadar melihat
    // kolomnya.
    //
    // An admin prepares questions in Excel first; a button only inside an exam
    // card demands creating an exam just to see the columns.
    const diTingkatAtas = builder.slice(builder.indexOf('Tambah {EXAM_KIND_LABELS[kind]}'));
    expect(diTingkatAtas).toContain('<TemplateDownloadButton');
  });

  it('menyebut kolomnya di layar, bukan hanya di dalam berkasnya', () => {
    // Admin yang menyiapkan soal di komputer lain perlu tahu bentuknya tanpa
    // membuka unduhan.
    //
    // An admin preparing questions on another machine needs to know the shape
    // without opening the download.
    const tombol = read('src/app/(admin)/admin/kelas/[classId]/question-template.tsx');
    expect(tombol).toContain('TEMPLATE_HEADERS.join');
    expect(builder).toContain('showColumns');
  });

  it('memakai satu fungsi unduh untuk kedua tempatnya', () => {
    // Dua penyusun berkas yang terpisah akan menyimpang begitu kolomnya
    // berubah di salah satunya.
    //
    // Two separate builders would drift apart as soon as the columns change in
    // one of them.
    expect(panel).not.toContain('XLSX.writeFile');
    expect(builder).not.toContain('XLSX.writeFile');
  });

  it('mengurai berkas di peramban, mengirim barisnya saja', () => {
    // Mengurai di server berarti menerima dan menyimpan berkas unggahan,
    // sedangkan yang dibutuhkan hanya barisnya.
    //
    // Parsing on the server would mean accepting and storing an upload, when
    // all that is needed are its rows.
    expect(panel).toContain('parseQuestionRows(rows)');
    expect(panel).toMatch(/body: JSON\.stringify\(\{ questions: preview \}\)/);
  });

  it('mengosongkan kolom berkas setelah dibaca', () => {
    // Tanpa ini, memilih berkas bernama sama setelah diperbaiki tidak memicu
    // apa pun.
    //
    // Without this, picking an identically named file after fixing it fires
    // nothing.
    expect(panel).toContain("e.target.value = ''");
  });

  it('menulis seluruh soal dalam satu batch', () => {
    // Dua puluh pemanggilan berurutan dapat berhenti di tengah dan menyisakan
    // ujian yang memuat sebagian soal.
    //
    // Twenty sequential calls can stop halfway and leave an exam holding only
    // some of its questions.
    const blok = service.slice(
      service.indexOf('export async function importQuestions'),
      service.indexOf('export async function deleteQuestion')
    );
    expect(blok).toContain('db.batch()');
    expect(blok).toMatch(/batch\.commit\(\)/);
  });

  it('memvalidasi ulang tiap baris di server', () => {
    // Berkas dibaca di peramban, dan muatan yang dikirim dapat diubah sebelum
    // tiba.
    //
    // The sheet is read in the browser, and the payload sent can be altered
    // before it arrives.
    const blok = service.slice(
      service.indexOf('export async function importQuestions'),
      service.indexOf('export async function deleteQuestion')
    );
    expect(blok).toContain('validateQuestion({');
    expect(blok).toContain('requireAdmin(actor)');
  });

  it('menyimpan kunci jawabannya terpisah dari soalnya', () => {
    const blok = service.slice(
      service.indexOf('export async function importQuestions'),
      service.indexOf('export async function deleteQuestion')
    );
    expect(blok).toContain("collection('examQuestions')");
    expect(blok).toContain("collection('examAnswerKeys')");
  });
});
