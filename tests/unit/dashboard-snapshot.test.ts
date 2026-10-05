// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALERT_THRESHOLDS, SNAPSHOT_MAX_AGE_MS } from '@/features/dashboard/snapshot-service';
import { wibDate } from '@/lib/time';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const service = read('src/features/dashboard/snapshot-service.ts');
const types = read('src/features/dashboard/snapshot-types.ts');
const route = read('src/app/api/dashboard/snapshot/route.ts');

const compute = service.slice(
  service.indexOf('export async function computeSnapshot'),
  service.indexOf('export async function getSnapshot')
);

/**
 * Menghitung ringkasan menuntut membaca seluruh kehadiran, pengumpulan,
 * percobaan ujian, dan jawaban survei -- sekitar tiga belas ribu dokumen untuk
 * seratus peserta.
 *
 * Dashboard adalah halaman yang paling sering dibuka, dan dua puluh kali buka
 * sehari sudah melampaui kuota baca harian Firestore.
 *
 * Computing the snapshot means reading every attendance record, submission,
 * exam attempt, and survey response -- around thirteen thousand documents for a
 * hundred participants.
 *
 * The dashboard is the most-opened page, and twenty opens a day already exceeds
 * Firestore's daily read quota.
 */
describe('ringkasan disimpan, bukan dihitung tiap buka', () => {
  it('membaca dokumen ringkasannya lebih dulu', () => {
    const baca = service.slice(service.indexOf('export async function getSnapshot'));
    expect(baca).toMatch(/collection\('dashboardSnapshots'\)\.doc\(id\)\.get\(\)/);
  });

  it('menghitung ulang hanya bila sudah usang', () => {
    const baca = service.slice(service.indexOf('export async function getSnapshot'));
    expect(baca).toMatch(/umur < SNAPSHOT_MAX_AGE_MS/);
    expect(baca).toMatch(/return data;/);
  });

  it('menyimpan hasil hitungannya agar tidak diulang', () => {
    const baca = service.slice(service.indexOf('export async function getSnapshot'));
    expect(baca).toMatch(/collection\('dashboardSnapshots'\)\.doc\(id\)\.set\(baru\)/);
  });

  it('memakai umur satu jam', () => {
    // Angka yang menua sepanjang hari membuat admin yang baru menilai tugas
    // tidak melihat perubahannya dan mengira penilaiannya gagal.
    //
    // Figures that age all day leave an admin who just graded a task seeing no
    // change and assuming the grading failed.
    expect(SNAPSHOT_MAX_AGE_MS).toBe(60 * 60 * 1000);
  });

  it('menyediakan paksa hitung ulang', () => {
    expect(route).toMatch(/refresh'\) === '1'/);
    expect(service).toMatch(/options\.force/);
  });

  it('membaca tiap koleksi sekali, bukan per peserta', () => {
    // Satu kueri per peserta per angka akan menjadi ratusan kueri untuk satu
    // halaman, dan biayanya ditanggung tiap kali halamannya dibuka.
    //
    // One query per participant per figure would be hundreds of queries for one
    // page, and the cost would be paid on every open.
    expect(compute).toMatch(/await Promise\.all\(\[/);
    expect(compute).not.toMatch(/for \([\s\S]{0,140}await db\.collection/);
  });

  it('dikunci pada tanggal WIB, bukan tanggal UTC', () => {
    // Pukul 06.00 WIB adalah 23.00 UTC hari sebelumnya; tanggal UTC membuat
    // ringkasan pagi tersimpan sebagai ringkasan kemarin.
    //
    // 06:00 WIB is 23:00 UTC the previous day; a UTC date would store the
    // morning's snapshot as yesterday's.
    // Diuji dari perilakunya, bukan dari teks di berkasnya: fungsinya kini
    // dipakai dua fitur dan tinggal di lib/time, dan pencarian teks akan gagal
    // hanya karena berkasnya berpindah.
    //
    // Tested through its behaviour rather than text in a file: the function is
    // now used by two features and lives in lib/time, and a text search would
    // fail merely because the file moved.
    expect(wibDate(new Date('2026-03-01T22:30:00Z'))).toBe('2026-03-02');
    expect(wibDate(new Date('2026-03-01T16:00:00Z'))).toBe('2026-03-01');
  });
});

describe('perhitungan angkanya', () => {
  it('membagi dengan jumlah peserta aktif, bukan terdaftar', () => {
    // Menyertakan yang sudah keluar membuat persentase kehadirannya melampaui
    // seratus setelah beberapa peserta drop out.
    //
    // Including those who left would push the attendance percentage past a
    // hundred once some participants drop out.
    expect(compute).toMatch(/if \(!aktifIds\.has\(a\.studentId\)\) continue;/);
    expect(compute).toMatch(/aktif\.length/);
  });

  it('menandai pertemuan yang belum berlangsung sebagai null', () => {
    // Nol berarti tidak ada yang hadir, dan grafiknya akan menunjukkan
    // kemerosotan yang tidak pernah terjadi.
    //
    // Zero means nobody attended, and the chart would show a collapse that
    // never happened.
    expect(compute).toMatch(/if \(sesi\.startsAt > nowIso\) return null;/);
  });

  it('menandai tugas yang belum dinilai sebagai null', () => {
    // Nilai yang belum ada bernilai null di tiap kolom peserta, dan rata-rata di
    // peramban mengembalikan null bila tidak ada yang terukur: nol akan
    // terbaca sebagai seluruh peserta mendapat nol.
    //
    // A missing score is null in each participant column, and the browser's
    // average returns null when nothing was measured: zero would read as everyone
    // scoring zero.
    expect(compute).toMatch(/return t \? tugasSiswa\?\.get\(t\.id\) \?\? null : null;/);
    const page = read('src/app/(admin)/admin/dashboard/page.tsx');
    expect(page).toMatch(/if \(ada\.length === 0\) return null;/);
  });

  it('memakai nilai tertinggi tiap ujian per peserta', () => {
    // Sejalan dengan aturan remedial: percobaan ulang yang lulus sudah dipatok
    // di KKM saat disimpan.
    //
    // In line with the remedial rule: a passing retake was already pinned at
    // the mark when it was stored.
    expect(compute).toMatch(/Math\.max\(peta\.get\(a\.studentId\) \?\? 0, a\.score\)/);
  });

  it('mengecualikan pretest dari rata-rata kuis peserta', () => {
    // Pretest mengukur titik awal sebelum diajar; memasukkannya menyeret
    // seluruh angkanya ke bawah secara merata.
    //
    // A pretest measures the starting point before teaching; folding it in
    // drags every figure down evenly.
    expect(compute).toMatch(/examById\.get\(examId\)\?\.kind === 'pretest'\) continue/);
  });

  it('merata-rata survei hanya dari pertanyaan bernilai angka', () => {
    // Isian bebas dan pilihan ganda tidak punya angka untuk dijumlahkan.
    // Free text and multiple choice have no number to add up.
    expect(compute).toMatch(/NUMERIC_KINDS\.includes\(r\.kind\)/);
  });

  it('mengurutkan daftar siaga dari masalah terbanyak', () => {
    // Peserta yang kehadirannya buruk sekaligus tugasnya tertinggal lebih
    // butuh dihubungi daripada yang hanya satu angkanya rendah.
    //
    // Someone whose attendance is poor and whose tasks are behind needs
    // contacting more than someone with only one low figure.
    expect(compute).toMatch(/b\.issueCount - a\.issueCount/);
  });

  it('memakai ambang yang disepakati', () => {
    expect(ALERT_THRESHOLDS).toEqual({ attendance: 75, task: 70, quiz: 70 });
  });

  it('menyimpan ambangnya pada ringkasannya', () => {
    // Ambang yang berubah membuat daftar lama tidak dapat dibaca ulang dengan
    // aturan yang sama.
    //
    // A changed threshold makes an older list unreadable under the same rule.
    expect(compute).toContain('thresholds: ALERT_THRESHOLDS');
    expect(types).toContain('thresholds: AlertThresholds');
  });

  it('mengecualikan capstone dari hitungan tugas', () => {
    // Capstone punya bobotnya sendiri pada nilai akhir; menghitungnya sebagai
    // tugas harian membuatnya terhitung dua kali.
    //
    // The capstone carries its own weight in the final score; counting it as a
    // daily task would count it twice.
    expect(compute).toMatch(/if \(t\.kind === 'capstone'\) continue;/);
  });

  it('menghitung peringkat dari rata-rata tiga angka yang sama dengan daftar siaga', () => {
    // Nilai akhir berbobot ada pada halaman Nilai Akhir; dua angka berbeda
    // pada satu layar akan terbaca sebagai kesalahan hitung.
    //
    // The weighted final score lives on the Final Score page; two different
    // numbers on one screen would read as a miscalculation.
    expect(compute).toMatch(/t\.attendanceRate \+ t\.taskRate \+ t\.quizAverage\) \/ 3/);
  });
});

describe('penjagaan akses', () => {
  it('hanya admin yang dapat membacanya', () => {
    expect(service.slice(service.indexOf('export async function getSnapshot'))).toContain("actor.role !== 'admin'");
    expect(route).toContain("actor.role !== 'admin'");
  });

  it('hanya admin yang dapat menghitungnya', () => {
    expect(compute).toContain("actor.role !== 'admin'");
  });
});

/**
 * Tabel peserta menampilkan satu baris per orang dengan titik kehadiran tiap
 * pertemuan, nilai tiap kuis, dan nilai tiap tugas.
 *
 * Angka ringkas tidak dapat memberi tahu pertemuan atau tugas mana yang
 * kosong, dan itulah yang dicari admin saat menindaklanjuti.
 *
 * The participant table shows one row per person with a dot per meeting, each
 * quiz's score, and each task's score.
 *
 * A summary figure cannot say which meeting or task is blank, and that is what
 * an admin looks for when following up.
 */
describe('tabel peserta', () => {
  it('menyimpan kehadiran per pertemuan, bukan hanya jumlahnya', () => {
    expect(compute).toMatch(/attendance = sesiTampil\.map/);
    expect(types).toContain('attendance: (boolean | null)[]');
  });

  it('membedakan belum berjalan dari tidak hadir', () => {
    // Tidak hadir dan belum berjalan menuntut tindakan yang berbeda.
    // Absent and not-yet-held call for different action.
    expect(compute).toMatch(/if \(sesi\.startsAt > nowIso\) return null;/);
  });

  it('membagi kehadiran dengan pertemuan yang sudah berjalan', () => {
    // Membaginya dengan seluruh jadwal membuat peserta yang hadir penuh
    // bernilai lima puluh persen di pertengahan program.
    //
    // Dividing by the whole schedule would give a participant with perfect
    // attendance fifty percent halfway through the programme.
    expect(compute).toMatch(/persen\(hadir, sudah\)/);
  });

  it('mengunci urutan kuis dan tugas untuk seluruh peserta', () => {
    // Mengurutkannya per peserta membuat kolom "Kuis 3" memuat kuis yang
    // berbeda pada tiap baris.
    //
    // Sorting per participant would have the "Kuis 3" column hold a different
    // quiz on each row.
    // Urutannya dikunci per kelas, dan jumlah kolomnya sama untuk seluruh
    // peserta supaya barisnya sejajar.
    //
    // The order is fixed per class, and the column count is the same for every
    // participant so the rows line up.
    expect(compute).toMatch(/daftar\.sort\(\(a, b\) => a\.order - b\.order\)/);
    expect(compute).toMatch(/quizScores: Array\.from\(\{ length: kolomKuis \}/);
    expect(compute).toMatch(/taskScores: Array\.from\(\{ length: kolomTugas \}/);
  });

  it('menyertakan label kolomnya pada ringkasan', () => {
    // Tanpa labelnya, kolom bernomor tidak dapat ditelusuri ke pertemuan atau
    // tugas mana pun.
    //
    // Without labels, numbered columns cannot be traced back to any meeting or
    // task.
    expect(compute).toContain('sessionLabels:');
    expect(compute).toContain('quizLabels:');
    expect(compute).toContain('taskLabels:');
  });

  it('memakai nama program kelasnya sebagai jurusan', () => {
    expect(compute).toMatch(/programName: kelas\?\.programName/);
  });

  it('membedakan nonaktif dari siaga', () => {
    // Peserta yang sudah keluar tidak perlu dihubungi, dan menggabungkannya
    // membuat daftar tindak lanjut memuat nama yang tidak dapat
    // ditindaklanjuti.
    //
    // Someone who has left needs no contacting, and merging them would fill the
    // follow-up list with names nothing can be done about.
    expect(compute).toMatch(/!s\.active \? 'nonaktif'/);
  });

  it('menyertakan peserta nonaktif pada tabelnya', () => {
    // Peserta yang keluar tetap perlu terlihat: tabelnya juga dipakai memeriksa
    // siapa yang sudah tidak mengikuti.
    //
    // Participants who left still need to be visible: the table is also used to
    // check who is no longer taking part.
    expect(compute).toMatch(/students\.filter\(\(s\) => !s\.active\)/);
  });
});

describe('catatan admin per peserta', () => {
  const notes = read('src/app/api/dashboard/notes/[studentId]/route.ts');

  it('disimpan di luar dokumen penggunanya', () => {
    // Catatan ini milik admin, bukan milik peserta, dan menaruhnya pada
    // dokumen pengguna berarti ia ikut terbaca setiap kali akun itu dimuat --
    // termasuk pada jalur yang dipakai peserta sendiri.
    //
    // The note belongs to the admin, not the participant, and putting it on the
    // user document means it is read every time that account loads -- including
    // on paths the participant themselves use.
    expect(notes).toMatch(/collection\('studentNotes'\)/);
    expect(notes).not.toMatch(/collection\('users'\)/);
  });

  it('hanya admin yang dapat menulisnya', () => {
    expect(notes).toContain("actor.role !== 'admin'");
  });

  it('membatasi panjangnya', () => {
    // Kolom catatan yang tidak dibatasi membuat satu baris tabel mendorong
    // seluruh kolom lainnya keluar layar.
    //
    // An unbounded note field would have one table row push every other column
    // off screen.
    expect(notes).toMatch(/length > 500/);
  });

  it('menyegarkan ringkasannya setelah disimpan', () => {
    // Tanpa ini, catatan yang baru diketik tidak muncul sampai ringkasannya
    // berumur satu jam, dan admin mengira penyimpanannya gagal.
    //
    // Without this, a note just typed would not appear until the snapshot turns
    // an hour old, and the admin would assume the save failed.
    expect(notes).toMatch(/collection\('dashboardSnapshots'\)\.doc\(hariIni\)\.delete\(\)/);
  });

  it('mencatat siapa yang menulisnya', () => {
    expect(notes).toContain('updatedBy: actor.name');
  });
});

describe('halaman dashboard', () => {
  const page = read('src/app/(admin)/admin/dashboard/page.tsx');
  const charts = read('src/app/(admin)/admin/dashboard/charts.tsx');
  const table = read('src/app/(admin)/admin/dashboard/roster-table.tsx');
  const shell = read('src/components/app-shell.tsx');
  const home = read('src/app/(admin)/admin/page.tsx');

  it('menjadi halaman pertama admin', () => {
    // Dashboard menjawab pertanyaan yang pertama kali diajukan admin saat
    // membuka aplikasi, sedangkan daftar kelas adalah tempat menyusun.
    //
    // The dashboard answers the question an admin asks first on opening the
    // app, while the class list is where things are built.
    expect(home).toContain("redirect('/admin/dashboard')");
    expect(shell).toContain("href: '/admin/dashboard'");
  });

  it('menyebut waktu penghitungan ringkasannya', () => {
    // Angka yang terlihat seperti waktu nyata padahal berumur satu jam membuat
    // admin menarik kesimpulan dari keadaan yang sudah berubah.
    //
    // Figures that look live while being an hour old have an admin draw
    // conclusions from a state that has already changed.
    expect(page).toContain('formatDateTimeWib(snapshot.generatedAt)');
    expect(page).toContain('Hitung Ulang');
  });

  it('menyebut ambangnya pada daftar siaga', () => {
    // Daftar siaga tanpa ambangnya tidak dapat diperiksa siapa pun yang
    // mempertanyakan mengapa seseorang masuk ke dalamnya.
    //
    // An alert list without its thresholds cannot be checked by anyone asking
    // why someone is on it.
    expect(page).toMatch(/snapshot\.thresholds\.attendance/);
    expect(page).toMatch(/snapshot\.thresholds\.quiz/);
  });

  it('membedakan belum berjalan dari nol pada grafiknya', () => {
    // Nol berarti tidak ada yang hadir, dan grafiknya akan menunjukkan
    // kemerosotan yang tidak pernah terjadi.
    //
    // Zero means nobody attended, and the chart would show a collapse that
    // never happened.
    // Peta panasnya menggambar "·" berkelas na, bukan nol persen.
    // The heatmap draws a "·" with the na class rather than zero percent.
    expect(charts).toMatch(/if \(!v \|\| v\.total === 0\)/);
    expect(charts).toMatch(/s\.na/);
    // Batang berkelompoknya menyebut "belum" alih-alih membiarkan ruang kosong.
    // The grouped bars say "belum" rather than leaving empty space.
    expect(charts).toMatch(/!adaIsi && \(/);
    expect(charts).toContain('belum');
  });

  it('tidak menggambar bagian bernilai nol pada batang bertumpuk', () => {
    // Potongan setebal satu piksel terbaca sebagai nilai kecil, bukan sebagai
    // ketiadaan.
    //
    // A one-pixel sliver reads as a small value, not as absence.
    // Bagian bernilai nol tidak digambar pada komposisi maupun mentoring.
    // A zero-valued segment is drawn in neither the composition nor mentoring.
    expect(page).toMatch(/\{c\.droppedOut > 0 && \(/);
    expect(page).toMatch(/\{belum > 0 && </);
  });

  it('menampilkan kenaikan poin sebagai angka, bukan hanya jarak batang', () => {
    // Jarak pada grafik harus diukur mata, sedangkan kenaikan poin adalah yang
    // dilaporkan.
    //
    // A gap on a chart has to be measured by eye, while the point gain is what
    // gets reported.
    expect(charts).toMatch(/r\.posttest - r\.pretest >= 0 \? '\+' : ''/);
    // Kenaikannya hanya muncul bila keduanya ada: selisih dari satu angka
    // bukan kenaikan apa pun.
    //
    // The gain appears only when both exist: a difference from one number is not
    // a gain at all.
    expect(charts).toMatch(/r\.pretest !== null && r\.posttest !== null && \(/);
  });

  it('menyimpan catatan saat kolomnya ditinggalkan', () => {
    // Admin menelusuri belasan peserta berturut-turut, dan satu tombol simpan
    // per baris berarti belasan ketukan tambahan untuk pekerjaan yang sama.
    //
    // An admin works down a dozen participants in a row, and a save button each
    // would mean a dozen extra taps for the same work.
    expect(table).toMatch(/onBlur=\{\(\) => simpanCatatan\(r\)\}/);
  });

  it('tidak menyimpan bila catatannya tidak berubah', () => {
    // Menyimpan setiap kali kolomnya ditinggalkan berarti satu tulisan tiap
    // kali admin sekadar melewatinya.
    //
    // Saving on every blur would mean one write each time an admin merely tabs
    // past it.
    expect(table).toMatch(/if \(d\.note === r\.note && d\.followUp === r\.followUp\) return;/);
  });

  it('mempertahankan catatan di layar bila penyimpanannya gagal', () => {
    // Kegagalan jaringan bukan alasan menghapus yang baru diketik.
    // A network failure is no reason to erase what was just typed.
    const blok = table.slice(table.indexOf('async function simpanCatatan'), table.indexOf('const hitung ='));
    expect(blok).not.toMatch(/setDraft\([\s\S]{0,60}\{\}\)/);
  });

  it('mengekspor seluruh baris tersaring, bukan halaman yang terlihat', () => {
    // Berkas berisi sepuluh baris dari seratus peserta tidak dapat dipakai
    // untuk apa pun.
    //
    // A file holding ten of a hundred participants is no use for anything.
    // Ekspornya kini di halamannya, memuat seluruh baris daerah yang dipilih.
    // The export now lives on the page and carries every row of the chosen region.
    expect(page).toMatch(/snapshot\.roster\.filter\(\(r\) => r\.city === kota\)/);
    expect(page).not.toMatch(/const baris = halaman/);
  });

  it('menggulir tabelnya mendatar alih-alih mempersempit kolomnya', () => {
    // Dua puluh kolom yang dipaksa muat membuat tiap selnya terpotong dan
    // tidak terbaca.
    //
    // Twenty columns forced to fit would leave every cell truncated and
    // unreadable.
    const css = read('src/app/(admin)/admin/dashboard/dashboard.module.css');
    expect(css).toMatch(/\.scroll \{\s*overflow-x: auto;/);
    expect(table).toMatch(/className=\{s\.scroll\}/);
    // Lebar terkecilnya tumbuh seiring jumlah kuis dan tugasnya: lebar tetap
    // membuat kolom terpotong begitu kuisnya bertambah.
    //
    // Its minimum width grows with the quiz and task count: a fixed width would
    // truncate columns as soon as another quiz is added.
    expect(table).toMatch(/\(KQ \+ TG\)/);
  });

  it('memberi keterangan tiap titik kehadiran', () => {
    // Titik tanpa keterangan tidak dapat ditelusuri ke pertemuan mana pun.
    // A dot with no caption cannot be traced back to any meeting.
    expect(table).toMatch(/title=\{`\$\{snapshot\.sessionLabels\[j\]/);
  });

  it('menyebut tempat nilai akhir berbobot berada', () => {
    // Peringkat di sini rata-rata tiga angka; dua angka berbeda pada satu
    // aplikasi akan terbaca sebagai kesalahan hitung bila tidak dijelaskan.
    //
    // The ranking here averages three figures; two different numbers in one app
    // would read as a miscalculation if left unexplained.
    expect(page).toContain('Nilai akhir berbobot ada di menu Nilai Akhir');
  });
});
