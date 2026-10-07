// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const runner = read('src/app/(student)/app/ujian/[examId]/page.tsx');
// Penyusun soal kini berhalaman sendiri; yang tersisa di kartu kelas hanya
// daftar ujiannya.
//
// The question editor now has its own page; what remains on the class card is
// only the exam list.
const builder =
  read('src/app/(admin)/admin/ujian/[examId]/page.tsx') +
  read('src/app/(admin)/admin/ujian/[examId]/question-editor.tsx');
const roster = read('src/app/(admin)/admin/ujian/[examId]/exam-roster.tsx');
const classPage = read('src/app/(admin)/admin/kelas/[classId]/page.tsx');
const jadwal = read('src/app/(student)/app/jadwal/page.tsx');
const attendance = read('src/features/attendance/service.ts');

describe('mesin pengerjaan peserta', () => {
  it('membuat percobaan setelah ditekan, bukan saat halaman dimuat', () => {
    // Membuatnya saat memuat berarti tombol kembali, tab yang dipulihkan
    // peramban, dan prefetch ikut menghabiskan kesempatan peserta tanpa ia
    // menjawab apa pun.
    //
    // Creating it on load means the back button, a browser-restored tab, and
    // prefetching all burn attempts without the participant answering.
    expect(runner).toMatch(/onClick=\{start\}/);
    expect(runner).not.toMatch(/useEffect\([\s\S]{0,120}start\(\)/);
  });

  it('menyimpan jawaban setiap kali dipilih', () => {
    // Satu kali muat ulang atau jaringan terputus tidak boleh menghapus
    // jawaban yang sudah diisi.
    //
    // One reload or dropped connection must not erase answers already given.
    expect(runner).toMatch(/function pick\(/);
    expect(runner).toMatch(/persist\(questionId, optionId/);
    expect(runner).toContain('/answer`');
  });

  it('memulihkan jawaban yang sudah tersimpan', () => {
    expect(runner).toContain('setAnswers(data.savedAnswers || {})');
  });

  it('mengumpulkan sendiri saat waktunya habis', () => {
    expect(runner).toMatch(/if \(sisa === 0\) submitRef\.current\(true\)/);
  });

  it('membiarkan tombol kirim hidup setelah gagal', () => {
    // Kegagalan jaringan bukan alasan untuk kehilangan seluruh jawaban.
    // A network failure is no reason to lose every answer.
    const blok = runner.slice(runner.indexOf('const submit = useCallback'), runner.indexOf('submitRef.current = submit'));
    expect(blok).toContain('setError((e as Error).message)');
    expect(blok).not.toMatch(/setState\(null\)|setAnswers\(\{\}\)/);
  });

  it('menyebut nomor soal yang belum dijawab, bukan hanya jumlahnya', () => {
    // "3 soal belum dijawab" tanpa nomornya membuat peserta menggulir satu per
    // satu untuk mencarinya.
    //
    // "3 unanswered" without the numbers makes a participant scroll through
    // one by one.
    expect(runner).toMatch(/belumDijawab\.map\(\(i\) =>/);
    expect(runner).toMatch(/setIndex\(i\); setConfirming\(false\)/);
  });

  it('memperingatkan bahwa soal yang dilewatkan dihitung salah', () => {
    expect(runner).toContain('dihitung salah');
  });

  it('menyebutkan patokan nilai sebelum percobaan ulang dimulai', () => {
    // Peserta berhak tahu batas nilainya sebelum mengerjakan, bukan sesudah.
    // A participant deserves to know the ceiling before working, not after.
    expect(runner).toMatch(/state\.attemptNumber > 1 && \(/);
    expect(runner).toContain('Bila lulus, nilai yang tercatat adalah');
  });

  it('menjelaskan nilai yang dipatok pada halaman hasil', () => {
    // Nilai 70 di samping 18 dari 20 soal benar terbaca sebagai kesalahan
    // hitung bila alasannya tidak disebut.
    //
    // A 70 beside 18 of 20 correct reads as a miscalculation when the reason
    // goes unsaid.
    expect(runner).toMatch(/result\.score !== result\.rawScore/);
    expect(runner).toContain('Karena ini percobaan ulang');
  });

  it('menandai waktu kritis bagi pembaca layar', () => {
    expect(runner).toContain("aria-live={mendesak ? 'assertive' : 'off'}");
    expect(runner).toContain('role="timer"');
  });
});

describe('penyusun soal admin', () => {
  it('memilih jawaban benar dari pilihannya, bukan mengetiknya', () => {
    // Kunci yang diketik dapat menunjuk pilihan yang tidak ada, dan soal
    // seperti itu menilai setiap jawaban sebagai salah.
    //
    // A typed key can point at an option that does not exist, and such a
    // question marks every answer wrong.
    // Kuncinya disimpan sebagai id pilihan, bukan nomor yang diketik.
    // The key is stored as an option's id, not a typed number.
    expect(builder).toMatch(/setCorrectId\(o\.id\)/);
    expect(builder).toContain('Tandai pilihan');
  });

  it('menggeser kunci saat pilihannya dihapus', () => {
    // Dibiarkan, indeksnya dapat menunjuk pilihan yang sudah tidak ada.
    // Left alone, its index could point at an option that no longer exists.
    // Kunci yang pilihannya terhapus jatuh ke pilihan pertama yang tersisa,
    // bukan dibiarkan menunjuk id yang sudah tidak ada.
    //
    // A key whose option was deleted falls to the first remaining option rather
    // than being left pointing at an id that no longer exists.
    expect(builder).toMatch(/sisa\.some\(\(x\) => x\.id === correctId\) \? correctId : sisa\[0\]\.id/);
  });

  it('mengunci teks pada soal benar-salah', () => {
    expect(builder).toMatch(/disabled=\{kind === 'benar-salah'\}/);
  });

  it('menampilkan nomor percobaan pada rekap', () => {
    // Nilai 70 dari percobaan kedua adalah hasil patokan remedial, bukan nilai
    // mentahnya.
    //
    // A 70 on a second attempt is the remedial ceiling, not a raw score.
    expect(roster).toMatch(/t\.attemptNumber > 1/);
  });

  it('mengambil rekap saat kartunya dibuka, bukan di muka', () => {
    expect(roster).toMatch(/useEffect\(\(\) => \{[\s\S]{0,200}\/roster`\)/);
  });

  it('menyebut aturan remedial pada tombol terbit', () => {
    expect(builder).toContain('Percobaan kedua dan ketiga yang lulus bernilai tepat');
  });

  it('menyembunyikan rekap pada ujian yang belum terbit', () => {
    // Ujian draf belum terlihat peserta, sehingga "0 dari 21" hanya
    // menyesatkan.
    //
    // A draft is not visible to participants, so "0 of 21" would only mislead.
    expect(builder).toMatch(/exam\.published && \(/);
  });
});

describe('tempat ujian pada antarmuka', () => {
  it('kuis melekat pada kartu pertemuan admin', () => {
    expect(classPage).toContain('KUIS SESI');
    expect(classPage).toMatch(/<ExamBuilder classId=\{classId\} sessionId=\{s\.id\}/);
  });

  it('ujian tingkat kelas berdiri di tab tersendiri', () => {
    // Pretest dan postest berdiri di depan seluruh kelas, bukan milik satu
    // pertemuan, sehingga keduanya tidak pada kartu pertemuan.
    //
    // A pretest and posttest stand in front of the whole class rather than one
    // meeting, so neither sits on a meeting card.
    expect(classPage).toMatch(/sessionId=\{null\} kind="pretest"/);
    expect(classPage).toMatch(/sessionId=\{null\} kind="posttest"/);
  });

  it('kuis tampil pada kartu pertemuan peserta', () => {
    expect(jadwal).toMatch(/exams\.map\(\(e\)/);
    expect(jadwal).toContain('/app/ujian/');
  });

  it('kuis ikut dikirim bersama jadwalnya', () => {
    // Tanpa ini halaman harus memanggil endpoint kedua untuk menyusun satu
    // kartu.
    //
    // Without this the page would call a second endpoint to build one card.
    const body = attendance.slice(
      attendance.indexOf('export async function listStudentSessionsWithAttendance'),
      attendance.indexOf('export', attendance.indexOf('export async function listStudentSessionsWithAttendance') + 10)
    );
    expect(body).toMatch(/collection\('exams'\)/);
    expect(body).toContain('exams: examsBySession.get(s.id)');
  });

  it('hanya mengirim ujian yang sudah terbit', () => {
    // Ujian yang belum terbit belum siap dikerjakan peserta.
    // An unpublished exam is not ready for participants.
    const body = attendance.slice(attendance.indexOf('export async function listStudentSessionsWithAttendance'));
    expect(body.slice(0, 3000)).toMatch(/where\('published', '==', true\)/);
  });
});

/**
 * "Wajib dikerjakan" berarti ditandai, bukan mengunci.
 *
 * Kuis yang salah setelah terbit -- batas waktu keliru, kunci jawaban salah --
 * tidak boleh menghentikan pengumpulan tugas atau menutup pertemuan
 * berikutnya. Yang rusak sebaiknya satu kartu, bukan seluruh jalannya kelas.
 *
 * "Required" means flagged, not locked.
 *
 * A quiz published with wrong settings -- a bad deadline, a wrong key -- must
 * not halt task submissions or close the next meeting. What breaks should be
 * one card, not the running of the class.
 */
describe('ujian wajib ditandai di beranda', () => {
  const service = read('src/features/dashboard/service.ts');
  const home = read('src/app/(student)/app/page.tsx');

  it('mengirim ujian yang belum dikerjakan', () => {
    expect(service).toContain('pendingExams');
    expect(service).toMatch(/where\('published', '==', true\)/);
  });

  it('melewatkan ujian yang sudah lulus', () => {
    // Peserta yang sudah lulus memang tidak dapat mengulang, sehingga
    // menandainya hanya menyisakan tanda yang tidak dapat dihilangkan.
    //
    // Someone who passed cannot retake it, so flagging them leaves a mark they
    // can never clear.
    expect(service).toMatch(/!lulusUjian\.has\(e\.id\)/);
  });

  it('melewatkan ujian yang belum bersoal', () => {
    expect(service).toMatch(/e\.questionCount > 0/);
  });

  it('mengurutkan batas terdekat lebih dulu', () => {
    expect(service).toMatch(/a\.dueAt\.localeCompare\(b\.dueAt\)/);
  });

  it('tidak mengunci apa pun', () => {
    // Pemeriksaan ujian tidak boleh muncul pada jalur pengumpulan tugas atau
    // pembukaan sesi.
    //
    // An exam check must not appear on the task submission or session opening
    // paths.
    const submission = read('src/features/tasks/submission-service.ts');
    const attendanceSvc = read('src/features/attendance/service.ts');
    expect(submission).not.toMatch(/examAttempts|pendingExams/);
    expect(attendanceSvc).not.toMatch(/pendingExams/);
  });

  it('ditagih lewat notifikasi peserta, bukan kartu beranda', () => {
    // Kartu ujian wajib di beranda diganti lonceng dan toast notifikasi, yang
    // juga muncul di halaman lain selain beranda.
    //
    // The required-exam cards on home were replaced by the notification bell
    // and toast, which also show on pages other than home.
    expect(home).not.toMatch(/pendingExams\.map/);
    expect(read('src/components/reminders.tsx')).toContain('/app/ujian/${e.id}');
  });
});

/**
 * Pretest, postest, dan kuis memakai mesin yang sama.
 *
 * Yang membedakan hanya keterikatannya pada sesi: kuis melekat pada satu
 * pertemuan, dua lainnya berdiri di depan seluruh kelas. Menuliskan jenisnya
 * satu per satu di tiap tempat berarti jenis keempat kelak terlewat di salah
 * satunya.
 *
 * Pretest, posttest, and quiz share one engine.
 *
 * Only the tie to a session differs: a quiz hangs off one meeting, the other
 * two stand in front of the whole class. Spelling the kinds out in each place
 * means a fourth kind later gets missed in one of them.
 */
describe('tiga jenis ujian', () => {
  const types = read('src/features/exams/types.ts');
  const service = read('src/features/exams/service.ts');
  const classPage = read('src/app/(admin)/admin/kelas/[classId]/page.tsx');
  const builder = read('src/app/(admin)/admin/kelas/[classId]/exam-builder.tsx');

  it('mengenal pretest, postest, dan kuis', () => {
    expect(types).toContain("export type ExamKind = 'pretest' | 'posttest' | 'kuis'");
    expect(types).toContain("posttest: 'Postest'");
  });

  it('mengikat sesi hanya pada kuis', () => {
    // Berpatokan pada kuis, bukan menyebut pretest, membuat jenis tanpa sesi
    // berikutnya ikut benar tanpa diubah.
    //
    // Keying on the quiz rather than naming the pretest makes the next
    // session-less kind correct without a change.
    expect(service).toMatch(/input\.kind === 'kuis' && !input\.sessionId/);
    expect(service).toMatch(/input\.kind === 'kuis' \? input\.sessionId! : null/);
  });

  it('menyediakan pretest dan postest pada satu tab', () => {
    // Keduanya mengapit materi yang sama dan kerap memuat soal yang sama
    // persis.
    //
    // Both bracket the same material and often hold identical questions.
    expect(classPage).toMatch(/\['ujian', 'Pretest & Postest'\]/);
    expect(classPage).toContain('kind="pretest"');
    expect(classPage).toContain('kind="posttest"');
  });

  it('memakai label terpusat, bukan nama yang diketik ulang', () => {
    // Nama yang diketik ulang menyimpang begitu salah satunya berubah.
    // Retyped names drift apart as soon as one of them changes.
    expect(builder).toContain('EXAM_KIND_LABELS[kind]');
    expect(builder).not.toMatch(/kind === 'pretest' \? '/);
  });

  it('menandai setiap jenis pada beranda tanpa menyebutkannya', () => {
    // Penyaring yang menyebut jenisnya akan melewatkan postest.
    // A filter naming the kinds would miss the posttest.
    const dashboard = read('src/features/dashboard/service.ts');
    const blok = dashboard.slice(dashboard.indexOf('const pendingExams'), dashboard.indexOf('// Hitungan Rasio'));
    expect(blok).not.toMatch(/kind === 'pretest'|kind === 'kuis'/);
  });
});
