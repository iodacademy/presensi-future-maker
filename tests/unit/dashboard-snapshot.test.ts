// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALERT_THRESHOLDS, SNAPSHOT_MAX_AGE_MS } from '@/features/dashboard/snapshot-service';

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
    expect(service).toContain("timeZone: 'Asia/Jakarta'");
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
    expect(compute).toMatch(/s\.startsAt > nowIso \? null/);
  });

  it('menandai tugas yang belum dinilai sebagai null', () => {
    expect(compute).toMatch(/nilai\.length === 0 \? null/);
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
    expect(compute).toMatch(/t\.kind !== 'capstone'/);
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
    expect(compute).toMatch(/kuisUrut\.map\(\(e\) =>/);
    expect(compute).toMatch(/tasks\.map\(\(t\) =>/);
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
