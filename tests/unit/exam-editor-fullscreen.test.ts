// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const page = read('src/app/(admin)/admin/ujian/[examId]/page.tsx');
const editor = read('src/app/(admin)/admin/ujian/[examId]/question-editor.tsx');
const css = read('src/app/(admin)/admin/ujian/[examId]/editor.module.css');
const builder = read('src/app/(admin)/admin/kelas/[classId]/exam-builder.tsx');
const service = read('src/features/exams/service.ts');
const route = read('src/app/api/exams/questions/[questionId]/route.ts');

const fungsi = (nama: string) => {
  const i = service.indexOf(`export async function ${nama}`);
  if (i < 0) throw new Error(`Fungsi ${nama} tidak ditemukan`);
  const j = service.indexOf('\nexport ', i + 1);
  return service.slice(i, j < 0 ? undefined : j);
};

/**
 * Penyuntingnya berlayar penuh, tanpa kerangka aplikasi.
 *
 * Menyusun dua puluh soal berlangsung lama, dan menu ke halaman lain hanya
 * memakan lebar yang dibutuhkan soal beserta pilihan dan gambarnya.
 *
 * The editor is full screen, without the application shell.
 *
 * Composing twenty questions is long-running work, and navigation to other pages
 * only eats the width the questions, their options, and their images need.
 */
describe('penyunting berlayar penuh', () => {
  it('tidak memakai kerangka aplikasi', () => {
    expect(page).not.toMatch(/AppShell/);
  });

  it('menyediakan jalan kembali tanpa kerangka itu', () => {
    // Tanpa sidebar, tidak ada jalan ke halaman lain kecuali tombol kembali dan
    // tombol kembali peramban -- halaman tanpa keduanya adalah jebakan.
    //
    // With no sidebar there is no way out but a back button and the browser's --
    // a page with neither is a trap.
    expect(page).toMatch(/router\.push\(`\/admin\/kelas\/\$\{exam\.classId\}`\)/);
    expect(page).toContain('aria-label="Kembali ke kelas"');
  });

  it('mengunci tingginya setinggi layar dan menggulir di dalamnya', () => {
    // Daftar soal di kiri harus tetap terlihat saat soal di kanan digulir;
    // halaman yang menggulir utuh membuat daftar itu hilang dari pandangan
    // tepat ketika dipakai berpindah soal.
    //
    // The list on the left must stay visible while the question on the right
    // scrolls; a whole-page scroll takes it out of view exactly when it is used to
    // move between questions.
    expect(css).toMatch(/\.shell \{[^}]*height: 100vh/s);
    expect(css).toMatch(/\.shell \{[^}]*overflow: hidden/s);
    expect(css).toMatch(/\.sidebarScroll \{[^}]*overflow-y: auto/s);
    // min-height:0 wajib: tanpanya anak flex menolak menyusut dan gulirannya
    // tidak pernah aktif.
    //
    // min-height:0 is required: without it a flex child refuses to shrink and the
    // scroll never engages.
    expect(css).toMatch(/\.body \{[^}]*min-height: 0/s);
    expect(css).toMatch(/\.sidebarScroll \{[^}]*min-height: 0/s);
  });

  it('menumpuk kolomnya di layar sempit', () => {
    // Daftar selebar 280px di sebelah penyunting menyisakan ruang yang tidak
    // cukup untuk satu kalimat soal pun.
    //
    // A 280px list beside the editor leaves too little room for even one question
    // sentence.
    expect(css).toMatch(/@media \(max-width: 860px\)/);
    const sempit = css.slice(css.indexOf('@media (max-width: 860px)'));
    expect(sempit).toMatch(/flex-direction: column/);
    expect(sempit).toMatch(/height: auto/);
  });

  it('menghentikan putaran penandanya bagi yang memintanya', () => {
    // Penanda ini berputar selama halaman terbuka, dan pemutaran tanpa henti
    // memicu rasa pusing pada sebagian orang.
    //
    // This indicator spins for as long as the page is open, and endless motion
    // triggers nausea in some people.
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });
});

/**
 * Soal disimpan saat kolomnya ditinggalkan.
 *
 * Sebelumnya soal hanya dapat dibuat dan dihapus, sehingga satu huruf yang
 * salah pada soal kedelapan belas menuntut admin menghapusnya lalu mengetik
 * ulang seluruh isinya -- dan soal itu pindah ke urutan terakhir.
 *
 * A question saves when its field is left.
 *
 * Previously a question could only be created and deleted, so one wrong letter in
 * the eighteenth meant deleting it and retyping everything -- and that question
 * moved to the end.
 */
describe('menyunting soal', () => {
  it('menyediakan jalur penyuntingan, bukan hanya tambah dan hapus', () => {
    expect(service).toContain('export async function updateQuestion');
    expect(route).toMatch(/export async function PATCH/);
  });

  it('memperbarui kuncinya dalam batch yang sama dengan soalnya', () => {
    // Kunci yang menunjuk pilihan yang sudah diganti akan menilai seluruh
    // jawaban sebagai salah.
    //
    // A key pointing at a replaced option would mark every answer wrong.
    const blok = fungsi('updateQuestion');
    expect(blok).toMatch(/const batch = db\.batch\(\)/);
    expect(blok).toMatch(/batch\.update\(qRef/);
    expect(blok).toMatch(/batch\.set\(\s*db\.collection\('examAnswerKeys'\)/);
  });

  it('mempertahankan id pilihan selama jumlahnya tidak berubah', () => {
    // Id yang berganti membuat jawaban peserta yang sudah tersimpan menunjuk
    // pilihan yang tidak ada lagi, dan hasil yang sudah dinilai berubah tanpa
    // ada yang menyentuhnya.
    //
    // Changing ids would leave an already-saved participant answer pointing at an
    // option that no longer exists, and a graded result would change with nobody
    // touching it.
    expect(fungsi('updateQuestion')).toMatch(
      /lama\.options\.length === input\.options\.length \? lama\.options\[i\]\.id : crypto\.randomUUID\(\)/
    );
  });

  it('menghapus gambar yang tidak lagi dipakai', () => {
    // Tanpa ini, tiap penggantian gambar meninggalkan berkas yang tidak dapat
    // dicapai siapa pun namun tetap ditagihkan.
    //
    // Without this, every replaced image leaves a file nobody can reach yet which
    // is still billed.
    const blok = fungsi('updateQuestion');
    expect(blok).toMatch(/!dipakai\.has\(p\)/);
    expect(blok).toMatch(/deleteExamImage\(actor, p\)/);
  });

  it('memeriksa isinya sebelum menyimpan, sebagaimana saat membuat', () => {
    // Soal tanpa pertanyaan maupun gambar tidak dapat dikerjakan peserta, dan
    // jalur sunting yang melewati pemeriksaannya menjadi pintu belakang.
    //
    // A question with neither text nor image cannot be answered, and an edit path
    // that skips validation becomes a back door.
    expect(fungsi('updateQuestion')).toMatch(/validateQuestion\(/);
  });

  it('menyimpan saat kolomnya ditinggalkan, bukan lewat tombol simpan', () => {
    // Admin menyusun dua puluh soal berturut-turut, dan satu tombol per soal
    // berarti dua puluh ketukan tambahan untuk pekerjaan yang sama.
    //
    // An admin composes twenty questions in a row, and one button each would mean
    // twenty extra taps for the same work.
    expect(editor).toMatch(/onBlur=\{\(\) => kirim\(\)\}/);
    expect(editor).not.toMatch(/Simpan Soal/);
  });

  it('memakai kolom tak terkendali agar kursornya tidak melompat', () => {
    // Kolom terkendali yang nilainya dipasok ulang dari server setiap
    // penyimpanan akan memindahkan kursor ke ujung kalimat di tengah pengetikan.
    //
    // A controlled field refed from the server on every save would jump the cursor
    // to the end of the sentence mid-typing.
    expect(editor).toMatch(/ref=\{textRef\}[\s\S]{0,80}defaultValue=\{question\.text\}/);
    expect(page).toMatch(/key=\{current\.id\}/);
  });

  it('mengirim seluruh medan tiap menyimpan, bukan satu medan saja', () => {
    // Penyuntingannya mengganti seluruh soal, sehingga mengirim satu medan akan
    // menimpa medan lain dengan nilainya yang lama.
    //
    // The edit replaces the whole question, so sending one field would overwrite
    // the others with their stale values.
    const blok = editor.slice(editor.indexOf('function kirim'), editor.indexOf('function gantiJenis'));
    for (const medan of ['kind:', 'text:', 'imageUrl:', 'options:', 'correctOptionId:', 'explanation:']) {
      expect(blok, medan).toContain(medan);
    }
  });
});

/**
 * Penanda penyimpanan menghitung yang sedang berjalan.
 *
 * Berpindah kolom dengan cepat membuat beberapa penyimpanan tumpang tindih, dan
 * menandainya "Tersimpan" saat yang terakhir selesai akan menyatakan aman
 * padahal yang lain masih di jalan.
 *
 * The save indicator counts writes in flight.
 *
 * Moving between fields quickly overlaps writes, and marking "Tersimpan" when the
 * last one lands would declare safety while others are still on their way.
 */
describe('penanda penyimpanan', () => {
  it('menghitung yang berjalan, bukan yang terakhir selesai', () => {
    expect(page).toMatch(/berjalan\.current \+= 1/);
    expect(page).toMatch(/berjalan\.current -= 1/);
    expect(page).toMatch(/if \(berjalan\.current === 0\)/);
  });

  it('mengingat kegagalan sampai seluruh penyimpanannya selesai', () => {
    // Satu penyimpanan yang gagal di antara lima yang berhasil tidak boleh
    // tertutup oleh "Tersimpan" dari yang terakhir.
    //
    // One failed write among five successes must not be covered by the last one's
    // "Tersimpan".
    expect(page).toMatch(/gagal\.current = true/);
    expect(page).toMatch(/setSaveState\(gagal\.current \? 'error' : 'saved'\)/);
  });

  it('menampilkan keadaannya kepada admin', () => {
    // Autosave yang tidak terlihat membuat admin menutup tab sebelum tulisannya
    // selesai, dan yang hilang tidak pernah ia sadari.
    //
    // Invisible autosave has an admin close the tab before the write lands, and
    // what is lost is never noticed.
    expect(page).toContain('Menyimpan');
    expect(page).toContain('Tersimpan');
    expect(page).toContain('Gagal menyimpan');
    expect(page).toMatch(/role="status"/);
  });
});

/**
 * Alurnya: klik tambah, isi judulnya, langsung masuk penyuntingnya.
 *
 * The flow: click add, type the title, land straight in the editor.
 */
describe('alur membuat ujian', () => {
  it('menanyakan judulnya lewat dialog', () => {
    expect(builder).toMatch(/function NewExamDialog/);
    expect(builder).toMatch(/role="dialog"/);
    expect(builder).toMatch(/aria-modal="true"/);
  });

  it('hanya menanyakan judulnya', () => {
    // Durasi dan KKM diatur di penyuntingnya bersama pengaturan lain, dan
    // menanyakan tiga hal sebelum ujiannya ada menunda admin dari pekerjaan
    // sebenarnya.
    //
    // Duration and the passing score are set in the editor with the other
    // settings, and asking three things before the exam exists delays the admin
    // from the real work.
    const dialog = builder.slice(builder.indexOf('function NewExamDialog'));
    expect(dialog).not.toMatch(/durationMinutes|passingScore/);
  });

  it('masuk ke penyuntingnya setelah dibuat', () => {
    expect(builder).toMatch(/router\.push\(`\/admin\/ujian\/\$\{data\.id\}`\)/);
  });

  it('menerima judulnya sebagai argumen, bukan lewat state', () => {
    // Menyetel state lalu memanggil create akan membacanya sebelum React
    // memperbaruinya, dan judulnya terkirim kosong.
    //
    // Setting state then calling create would read it before React updates,
    // sending an empty title.
    expect(builder).toMatch(/async function create\(judul: string\)/);
    expect(builder).toMatch(/title: judul\.trim\(\)/);
  });

  it('dapat ditutup dengan Escape', () => {
    // Dialog yang hanya dapat ditutup lewat tombolnya memaksa mencari sasaran
    // kecil untuk membatalkan sesuatu yang belum terjadi.
    //
    // A dialog that closes only through its button forces hunting for a small
    // target to cancel something that has not happened yet.
    expect(builder).toMatch(/e\.key === 'Escape'/);
  });

  it('tidak menutup dialognya saat penyimpanannya sedang berjalan', () => {
    // Menutupnya di tengah pembuatan menyisakan ujian yang terbuat tanpa admin
    // tahu, dan ia akan membuatnya lagi.
    //
    // Closing mid-creation leaves an exam created without the admin knowing, and
    // they will create it again.
    expect(builder).toMatch(/if \(e\.key === 'Escape' && !busy\)/);
    expect(builder).toMatch(/onClick=\{\(\) => !busy && onCancel\(\)\}/);
  });
});

/**
 * Urutan soal dikirim utuh, bukan sepotong.
 *
 * Menukar dua soal mengubah nomor keduanya, dan dua permintaan terpisah dapat
 * berhenti di tengah sehingga dua soal memakai nomor yang sama.
 *
 * The question order is sent whole, not piecewise.
 *
 * Swapping two questions changes both their numbers, and two separate requests can
 * stop halfway leaving two questions sharing a number.
 */
describe('mengurutkan soal', () => {
  it('mengirim seluruh urutannya dalam satu permintaan', () => {
    expect(service).toContain('export async function reorderQuestions');
    expect(fungsi('reorderQuestions')).toMatch(/const batch = db\.batch\(\)/);
  });

  it('menolak id yang bukan milik ujian itu', () => {
    // Tanpa pemeriksaan ini, id dari ujian lain akan menulis nomor pada soal
    // yang bukan miliknya.
    //
    // Without this check, an id from another exam would write a number onto a
    // question that is not its own.
    expect(fungsi('reorderQuestions')).toMatch(/order\.some\(\(id\) => !milik\.has\(id\)\)/);
  });

  it('menolak daftar yang tidak lengkap', () => {
    // Daftar yang kurang satu id akan menyisakan satu soal memakai nomor lama
    // yang kini bentrok dengan soal lain.
    //
    // A list missing one id would leave a question on its old number, now clashing
    // with another.
    expect(fungsi('reorderQuestions')).toMatch(/order\.length !== milik\.size/);
  });

  it('memulihkan urutannya di layar bila penyimpanannya gagal', () => {
    // Urutan di layar yang berbeda dari yang tersimpan membuat admin menyusun
    // ulang berdasarkan gambaran yang salah.
    //
    // An on-screen order differing from the stored one has the admin rearrange
    // against a false picture.
    const blok = page.slice(page.indexOf('async function moveQuestion'), page.indexOf('if (loading)'));
    expect(blok).toMatch(/reloadQuestions\(\)/);
  });
});

/**
 * Soal yang belum lengkap ditandai di daftarnya.
 *
 * Yang hanya terlihat setelah dibuka akan terlewat pada ujian berisi dua puluh
 * soal, dan peserta menemukan soal yang tidak dapat dikerjakan.
 *
 * Incomplete questions are flagged in the list.
 *
 * One visible only after opening would be missed in an exam of twenty, and a
 * participant finds a question they cannot answer.
 */
describe('soal yang belum lengkap', () => {
  it('menghitung soal tanpa pertanyaan maupun gambar sebagai belum lengkap', () => {
    expect(editor).toMatch(/if \(!q\.text\.trim\(\) && !q\.imageUrl\) return true/);
  });

  it('menghitung pilihan tanpa teks maupun gambar sebagai belum lengkap', () => {
    // Pilihan kosong tidak dapat dipilih peserta.
    // An empty option cannot be picked by a participant.
    expect(editor).toMatch(/q\.options\.some\(\(o\) => !o\.text\.trim\(\) && !o\.imageUrl\)/);
  });

  it('menghitung kunci yang hilang sebagai belum lengkap', () => {
    // Kunci yang menunjuk pilihan yang tidak ada menilai setiap jawaban salah.
    // A key pointing at a missing option marks every answer wrong.
    expect(editor).toMatch(/!q\.options\.some\(\(o\) => o\.id === q\.correctOptionId\)/);
  });

  it('menyebut jumlahnya di kepala daftarnya', () => {
    expect(page).toMatch(/belumLengkap\.length > 0 &&/);
    expect(page).toContain('belum lengkap');
  });

  it('memperingatkan ujian terbit yang belum punya soal', () => {
    // Peserta membukanya lalu menemukan halaman kosong, dan itu tidak terlihat
    // dari daftar kelasnya.
    //
    // A participant opens it and finds an empty page, and that is invisible from
    // the class list.
    expect(page).toMatch(/exam\.published && questions\.length === 0/);
  });

  it('tidak mengizinkan menerbitkan ujian tanpa soal', () => {
    expect(page).toMatch(/disabled=\{!exam\.published && questions\.length === 0\}/);
  });
});

/**
 * Urutan panelnya mengikuti seberapa sering dipakai.
 *
 * Yang dipakai tiap kali ujian dibuka berada di atas; yang dipakai sekali atau
 * tidak pernah berada di bawahnya. Panel yang jarang dipakai di jalur utama
 * menuntut admin menggulir melewatinya setiap kali.
 *
 * The panel order follows how often each is used.
 *
 * What is used every time an exam is opened sits at the top; what is used once or
 * never sits below. A rarely used panel in the main path makes an admin scroll past
 * it every time.
 */
describe('susunan panel penyunting', () => {
  const urutan = (nama: string) => page.indexOf(nama);

  it('menaruh pengaturan ujian di atas penyunting soalnya', () => {
    // Judul, durasi, dan KKM adalah hal pertama yang diperiksa admin saat
    // membuka ujian, dan menguburnya di bawah penyunting soal berarti menggulir
    // melewati seluruh soal untuk mengubah satu angka.
    //
    // The title, duration, and passing score are the first things an admin checks
    // on opening an exam, and burying them below the question editor means
    // scrolling past the whole question to change one number.
    expect(urutan('<ExamSettings')).toBeLessThan(urutan('<QuestionEditor'));
  });

  it('menaruh impor Excel di bawah penyunting soalnya', () => {
    // Impor dipakai sekali di awal; penyuntingan dipakai tiap kali.
    // Import is used once at the start; editing is used every time.
    expect(urutan('<ImportQuestions')).toBeGreaterThan(urutan('<QuestionEditor'));
  });

  it('tidak menampilkan tombol contoh Excel dua kali', () => {
    // ImportQuestions sudah menggambar kotaknya sendiri lengkap dengan judul dan
    // tombol contohnya; membungkusnya lagi menampilkan keduanya dua kali.
    //
    // ImportQuestions already draws its own box with its heading and template
    // button; wrapping it again shows both of them twice.
    expect(page).not.toMatch(/TemplateDownloadButton/);
  });

  it('menaruh hapus ujian di kepala, bukan di dasar halaman', () => {
    // Di dasar, ia menjadi hal terakhir yang terbaca setiap kali admin menggulir
    // mencari sesuatu yang lain -- dan tindakan yang memusnahkan hasil kerja
    // peserta tidak layak menjadi tujuan akhir gulirannya.
    //
    // At the foot it becomes the last thing read every time an admin scrolls
    // looking for something else -- and an action that destroys participant work
    // does not deserve to be where scrolling ends.
    expect(urutan('aria-label="Hapus ujian"')).toBeLessThan(urutan('<ExamSettings'));
    expect(page).not.toMatch(/Hapus ujian ini/);
  });

  it('tetap menanyakan konfirmasi sebelum menghapus', () => {
    // Ikon kecil lebih mudah tersenggol daripada tombol bertuliskan, sehingga
    // konfirmasinya justru lebih dibutuhkan di sini.
    //
    // A small icon is easier to hit by accident than a labelled button, so the
    // confirmation matters more here, not less.
    const blok = page.slice(urutan('aria-label="Hapus ujian"'), urutan('</header>'));
    expect(blok).toMatch(/confirm\(/);
    expect(blok).toMatch(/tidak dapat dikembalikan/);
  });
});
