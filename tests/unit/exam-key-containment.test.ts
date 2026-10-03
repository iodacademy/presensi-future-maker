// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const service = read('src/features/exams/service.ts');
const types = read('src/features/exams/types.ts');

/**
 * Mengambil isi sebuah antarmuka saja, tanpa komentar di atasnya.
 *
 * Komentarnya memang menyebut "jawaban benar" untuk menjelaskan kenapa field
 * itu tidak ada di sana; mencocokkan komentar akan menghukum penjelasan yang
 * justru menjaga aturannya.
 *
 * Takes only an interface's body, without the comment above it.
 *
 * That comment does mention the correct answer, to explain why the field is
 * absent; matching on comments would punish the very explanation that keeps
 * the rule.
 */
function isiAntarmuka(nama: string): string {
  const mulai = types.indexOf(`export interface ${nama} {`);
  if (mulai === -1) throw new Error(`antarmuka ${nama} tidak ditemukan`);
  const tutup = types.indexOf('\n}', mulai);
  const badan = types.slice(mulai, tutup);
  // Buang komentar di dalam badannya juga.
  // Strip comments inside the body as well.
  return badan.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function fungsi(nama: string): string {
  const mulai = service.indexOf(`export async function ${nama}`);
  if (mulai === -1) throw new Error(`fungsi ${nama} tidak ditemukan`);
  const berikut = service.indexOf('\nexport ', mulai + 1);
  return service.slice(mulai, berikut === -1 ? service.length : berikut);
}

/**
 * Firestore tidak mengenal izin per-kolom.
 *
 * Satu dokumen yang memuat soal sekaligus jawaban benarnya akan terkirim utuh
 * begitu soalnya dikirim ke peserta: tidak ada cara menahan satu field saja.
 * Karena itu kuncinya harus berada pada dokumen terpisah sejak awal -- ini
 * tidak dapat diperbaiki belakangan tanpa memindahkan seluruh data.
 *
 * Firestore has no per-field permissions.
 *
 * One document holding both a question and its correct answer travels whole the
 * moment the question is sent to a participant: there is no way to withhold a
 * single field. The key must therefore live in a separate document from the
 * start -- this cannot be fixed later without migrating all the data.
 */
describe('kunci jawaban terpisah dari soalnya', () => {
  it('soal tidak memuat jawaban benar pada tipenya', () => {
    expect(isiAntarmuka('QuestionDocument')).not.toMatch(/correctOptionId|isCorrect|answer/i);
  });

  it('kunci disimpan pada koleksi tersendiri', () => {
    expect(service).toContain("collection('examAnswerKeys')");
    expect(service).toContain("collection('examQuestions')");
  });

  it('pembahasan ikut pada kuncinya, bukan pada soalnya', () => {
    // Pembahasan kerap menyebut jawaban benarnya dan ikut bocor bila
    // diletakkan bersama soal.
    //
    // An explanation usually names the correct answer and would leak alongside
    // the question.
    expect(isiAntarmuka('QuestionDocument')).not.toContain('explanation');
    expect(isiAntarmuka('AnswerKeyDocument')).toContain('explanation');
  });
});

describe('jalur peserta tidak pernah menyentuh kunci', () => {
  it('memulai percobaan tanpa membaca koleksi kunci', () => {
    // Inti pertahanannya: satu pembacaan di sini mengirim kunci ke peramban.
    // The crux of the defence: one read here sends the key to the browser.
    expect(fungsi('startAttempt')).not.toContain('examAnswerKeys');
  });

  it('daftar ujian peserta tidak membaca kunci', () => {
    expect(fungsi('listExamsForStudent')).not.toContain('examAnswerKeys');
  });

  it('menyimpan draf tanpa membaca kunci', () => {
    // Menilai saat menyimpan akan membocorkan benar-salahnya tiap jawaban
    // selama ujian masih berjalan.
    //
    // Grading on save would reveal each answer's correctness while the exam is
    // still running.
    expect(fungsi('saveDraftAnswer')).not.toContain('examAnswerKeys');
  });

  it('hanya pengumpulan dan jalur admin yang membaca kunci', () => {
    const pembaca = ['submitAttempt', 'listQuestionsForAdmin', 'createQuestion', 'deleteQuestion', 'deleteExam']
      .filter((n) => fungsi(n).includes('examAnswerKeys'));
    expect(pembaca.sort()).toEqual(
      ['createQuestion', 'deleteExam', 'deleteQuestion', 'listQuestionsForAdmin', 'submitAttempt'].sort()
    );
  });

  it('daftar soal untuk admin dijaga perannya', () => {
    expect(fungsi('listQuestionsForAdmin')).toContain('requireAdmin(actor)');
  });
});

describe('penilaian berjalan di server', () => {
  it('menghitung nilainya sendiri, tidak menerima dari peramban', () => {
    // Nilai yang dihitung peramban dapat diubah sebelum dikirim.
    // A score computed in the browser can be edited before it is sent.
    const blok = fungsi('submitAttempt');
    expect(blok).toContain('calculateScore(correctCount, questions.length)');
    expect(blok).toContain('applyRemedialRule(rawScore, attempt.attemptNumber, exam.passingScore)');
    expect(blok).not.toMatch(/body\.score|answers\.score|input\.score/);
  });

  it('memakai seluruh soal sebagai pembagi, bukan jawaban yang dikirim', () => {
    // Muatan yang pendek akan memperkecil pembaginya dan menaikkan nilainya.
    // A short payload would shrink the divisor and inflate the score.
    expect(fungsi('submitAttempt')).toMatch(/for \(const q of questions\)/);
  });

  it('bersifat idempoten pada percobaan yang sudah selesai', () => {
    // Pengiriman ulang karena jaringan terputus tidak boleh mengubah hasil.
    // A resend after a dropped connection must not change the result.
    const blok = fungsi('submitAttempt');
    expect(blok).toMatch(/attempt\.status === 'selesai'/);
    expect(blok).toContain('alreadySubmitted: true');
  });

  it('memakai draf tersimpan bila pengirimannya terlambat', () => {
    // Jawaban yang diketik setelah waktunya habis tidak boleh ikut dinilai.
    // Answers typed after time ran out must not count.
    const blok = fungsi('submitAttempt');
    expect(blok).toContain('isSubmissionLate(attempt.startedAt, exam.durationMinutes)');
    expect(blok).toMatch(/if \(terlambat\)/);
  });

  it('memeriksa kepemilikan percobaan', () => {
    for (const nama of ['submitAttempt', 'saveDraftAnswer']) {
      expect(fungsi(nama), nama).toContain('bukan milik Anda');
    }
  });
});

describe('waktu mulai ditentukan server', () => {
  it('tidak menerima waktu mulai dari peramban', () => {
    // Jam perangkat peserta dapat meleset berjam-jam, dan waktu mulai yang
    // dikirim peramban menggeser batas waktunya -- termasuk ke arah yang
    // menguntungkan pengirimnya.
    //
    // A device clock can be hours off, and a start time sent by the browser
    // shifts the deadline with it -- including in the sender's favour.
    const blok = fungsi('startAttempt');
    expect(blok).toContain('startedAt: now');
    expect(blok).not.toMatch(/startedAt: (input|body|params)\./);
  });

  it('menyimpan urutan soal agar bertahan saat dimuat ulang', () => {
    // Mengacak ulang tiap render membuat peserta kehilangan tempatnya setiap
    // kali jaringannya terputus sesaat.
    //
    // Reshuffling on every render loses a participant's place each time their
    // connection blinks.
    expect(fungsi('startAttempt')).toContain('questionOrder: seededShuffle(');
  });

  it('mengembalikan jawaban yang sudah tersimpan', () => {
    expect(fungsi('startAttempt')).toContain('savedAnswers');
  });

  it('menolak ujian kosong sebelum percobaan dibuat', () => {
    // Ujian tanpa soal akan membagi dengan nol dan meluluskan setiap peserta
    // dengan nilai nol.
    //
    // An exam with no questions would divide by zero and pass everyone with a
    // score of zero.
    expect(fungsi('startAttempt')).toContain('exam.questionCount < 1');
  });

  it('menolak ujian kelas lain', () => {
    expect(fungsi('startAttempt')).toContain('bukan untuk kelas Anda');
  });
});

describe('draf tidak dapat menimpa hasil penilaian', () => {
  it('menolak menyimpan pada percobaan yang sudah selesai', () => {
    // Tanpa penolakan ini, simpanan otomatis yang terlambat tiba dapat
    // mengosongkan isCorrect sebuah jawaban yang sudah dinilai, dan halaman
    // hasil menampilkan seluruh jawaban sebagai salah di samping nilai yang
    // benar.
    //
    // Without this refusal, a late autosave could blank the isCorrect of an
    // answer already graded, and the results page would show every answer as
    // wrong beside a correct score.
    expect(fungsi('saveDraftAnswer')).toContain('sudah dikumpulkan');
  });

  it('memeriksanya di dalam transaksi, bukan sebelum menulis', () => {
    // Pemeriksaan sebelum transaksi menyisakan celah antara membaca status dan
    // menulis jawabannya.
    //
    // A check before the transaction leaves a gap between reading the status
    // and writing the answer.
    const blok = fungsi('saveDraftAnswer');
    expect(blok).toContain('db.runTransaction');
    expect(blok.indexOf('tx.get(attemptRef)')).toBeLessThan(blok.indexOf('tx.set(answerRef'));
  });
});

describe('endpoint ujian', () => {
  it('soal untuk admin dijaga perannya', () => {
    // Tiap handler dijaga sendiri, bukan dihitung jumlahnya: angka keras akan
    // gagal hanya karena handler baru ditambahkan, dan yang perlu dijamin
    // adalah tidak ada satu pun handler yang lolos tanpa penjaga.
    //
    // Each handler is guarded on its own rather than counted: a hard number fails
    // merely because a handler was added, and what must be guaranteed is that no
    // handler slips through unguarded.
    for (const berkas of [
      'src/app/api/exams/[examId]/questions/route.ts',
      'src/app/api/exams/questions/[questionId]/route.ts',
    ]) {
      const route = read(berkas);
      const handler = route.match(/export async function (GET|POST|PATCH|PUT|DELETE)/g) ?? [];
      const penjaga = route.match(/actor\.role !== 'admin'/g) ?? [];
      expect(handler.length, berkas).toBeGreaterThan(0);
      expect(penjaga.length, `${berkas}: ${handler.length} handler, ${penjaga.length} penjaga`).toBe(handler.length);
    }
  });

  it('memulai percobaan lewat POST, bukan GET', () => {
    // GET ikut terpicu oleh prefetch peramban dan riwayat navigasi, sehingga
    // kesempatan peserta habis tanpa ia menjawab apa pun.
    //
    // A GET also fires on browser prefetch and history navigation, burning a
    // participant's attempts without them answering anything.
    const route = read('src/app/api/exams/[examId]/attempt/route.ts');
    expect(route).toContain('export async function POST');
    expect(route).not.toContain('export async function GET');
  });
});
