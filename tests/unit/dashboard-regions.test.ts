// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hitungFase, keteranganFase, tanggalSingkat, PHASES_AFTER_BOOTCAMP } from '@/features/dashboard/phases';
import { SNAPSHOT_VERSION } from '@/features/dashboard/snapshot-service';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const page = read('src/app/(admin)/admin/dashboard/page.tsx');
const charts = read('src/app/(admin)/admin/dashboard/charts.tsx');
const table = read('src/app/(admin)/admin/dashboard/roster-table.tsx');
const service = read('src/features/dashboard/snapshot-service.ts');
const types = read('src/features/dashboard/snapshot-types.ts');
const login = read('src/features/dashboard/login-service.ts');
const layout = read('src/app/(student)/app/layout.tsx');

const sesi = (tanggal: string[]) => tanggal.map((date) => ({ date }));

/**
 * Fase program diturunkan dari jadwal sesi yang sudah ada.
 *
 * Tanggal yang ditulis terpisah akan menyimpang dari jadwal sebenarnya begitu
 * satu pertemuan digeser, dan panelnya akan menyebut minggu yang berbeda dari
 * yang dilihat peserta di jadwalnya sendiri.
 *
 * The programme phases derive from the existing session schedule.
 *
 * Separately written dates would drift from the real schedule the moment one
 * meeting moves, and the panel would name a different week from the one
 * participants see in their own schedule.
 */
describe('fase program', () => {
  it('menurunkan onboarding dan bootcamp dari jadwal sesinya', () => {
    const f = hitungFase(sesi(['2026-09-11', '2026-09-14', '2026-10-09']), '2026-09-30T00:00:00Z');
    expect(f[0]).toMatchObject({ name: 'Onboarding', range: '11 Sep' });
    expect(f[1]).toMatchObject({ name: 'Bootcamp', range: '14 Sep sampai 9 Okt' });
  });

  it('menandai fase yang sedang berjalan', () => {
    const f = hitungFase(sesi(['2026-09-11', '2026-09-14', '2026-10-09']), '2026-09-30T00:00:00Z');
    expect(f.find((x) => x.name === 'Bootcamp')?.status).toBe('berjalan');
    expect(f.find((x) => x.name === 'Onboarding')?.status).toBe('selesai');
    expect(f.find((x) => x.name === 'Showcase')?.status).toBe('akan-datang');
  });

  it('menghitung kemajuan dari pertemuan yang sudah berjalan, bukan hari kalender', () => {
    // Bootcamp tidak berjalan tiap hari, dan hitungan kalender akan menunjukkan
    // kemajuan pada hari tanpa pertemuan.
    //
    // The bootcamp does not run daily, and a calendar count would show progress
    // on days with no meeting.
    const f = hitungFase(
      sesi(['2026-09-11', '2026-09-14', '2026-09-16', '2026-09-18', '2026-09-21']),
      '2026-09-17T00:00:00Z'
    );
    // Dua dari empat pertemuan bootcamp sudah berjalan pada 17 Sep.
    // Two of the bootcamp's four meetings have been held by 17 Sep.
    expect(f.find((x) => x.name === 'Bootcamp')?.progress).toBe(50);
  });

  it('tidak memberi kemajuan pada fase yang belum berjalan', () => {
    const f = hitungFase(sesi(['2026-09-11', '2026-09-14']), '2026-09-30T00:00:00Z');
    for (const x of f.filter((y) => y.name !== 'Bootcamp')) {
      expect(x.progress, x.name).toBe(null);
    }
  });

  it('tidak pernah menyelesaikan fase tanpa tanggal akhir', () => {
    // Pendampingan kerja berjalan sampai ada yang menyatakannya berakhir, dan
    // menandainya selesai berdasarkan tanggal akan menyembunyikannya.
    //
    // Job support runs until someone says it has ended, and marking it complete by
    // date would hide it.
    const f = hitungFase(sesi(['2026-09-11']), '2030-01-01T00:00:00Z');
    expect(f.find((x) => x.name === 'Pendampingan kerja')?.status).toBe('berjalan');
  });

  it('tetap menampilkan fase lanjutannya saat belum ada sesi sama sekali', () => {
    // Dashboard yang dibuka sebelum jadwal diisi tidak boleh kosong sama sekali.
    // A dashboard opened before the schedule is filled must not be wholly empty.
    const f = hitungFase([], '2026-09-30T00:00:00Z');
    expect(f).toHaveLength(PHASES_AFTER_BOOTCAMP.length);
    expect(f.map((x) => x.name)).toContain('Capstone');
  });

  it('menulis tanggalnya dalam bahasa Indonesia', () => {
    expect(tanggalSingkat('2026-10-09')).toBe('9 Okt');
    expect(tanggalSingkat('2026-05-01')).toBe('1 Mei');
  });
});

/**
 * Login dicatat sekali per peserta per hari.
 *
 * Mencatat tiap pembukaan berarti sekitar seribu lima ratus tulis sehari untuk
 * seratus peserta -- hampir sepersepuluh kuota gratis untuk satu grafik.
 *
 * A login is recorded once per participant per day.
 *
 * Recording every open would mean around fifteen hundred writes a day for a
 * hundred participants -- nearly a tenth of the free quota for one chart.
 */
describe('aktivitas login', () => {
  it('memakai satu dokumen per peserta per tanggal WIB', () => {
    expect(login).toMatch(/\$\{uid\}_\$\{tanggal\}/);
    expect(login).toMatch(/wibDate\(\)/);
  });

  it('tidak menambah tulis untuk pembukaan kedua pada hari yang sama', () => {
    expect(login).toMatch(/if \(sudahDitulis\.has\(id\)\) return;/);
  });

  it('tidak menghalangi halamannya terbuka bila penulisannya gagal', () => {
    // Peserta yang gagal membuka aplikasi karena grafik admin adalah pertukaran
    // yang salah arah.
    //
    // A participant unable to use the app because of an admin's chart is the wrong
    // trade.
    expect(login).toMatch(/catch \{/);
    expect(layout).toMatch(/void recordDailyLogin\(actor\.uid\)/);
  });

  it('dicatat di layout, bukan di halaman masuk', () => {
    // Peserta membuka aplikasi dari ikon layar utama berhari-hari tanpa pernah
    // melewati halaman masuk lagi, dan grafiknya akan memperlihatkan nol pada
    // hari-hari peserta justru paling aktif.
    //
    // Participants open the app from a home-screen icon for days without passing
    // through login again, and the chart would show zero on exactly the days they
    // were most active.
    const masuk = read('src/app/api/auth/login/route.ts');
    expect(masuk).not.toMatch(/recordDailyLogin/);
  });

  it('menyebut bahwa angkanya bukan jumlah pembukaan', () => {
    // Admin yang menyangka angkanya jumlah pembukaan akan menyimpulkan pemakaian
    // yang jauh lebih rendah dari kenyataannya.
    //
    // An admin reading the figure as a number of opens would conclude usage far
    // lower than it is.
    expect(page).toContain('sekali per peserta per hari, bukan tiap kali membuka');
  });

  it('hanya menghitung peserta yang masih aktif', () => {
    const blok = service.slice(service.indexOf('loginsSnap.docs'), service.indexOf('const logins:'));
    expect(blok).toMatch(/aktifIds\.has\(l\.uid\)/);
  });
});

/**
 * Penyaring daerah bekerja di peramban.
 *
 * Ringkasannya sudah memuat satu baris per peserta beserta daerahnya, sehingga
 * berpindah daerah tidak menuntut satu pun pembacaan tambahan ke basis data.
 *
 * The region filter works in the browser.
 *
 * The snapshot already carries one row per participant with their region, so
 * switching regions costs no extra database reads at all.
 */
describe('penyaring daerah', () => {
  it('tidak memuat ulang ringkasannya saat daerahnya berpindah', () => {
    // Satu penghitungan ulang berarti membaca tiga belas ribu dokumen; empat
    // tombol daerah akan menghabiskan kuota harian dalam satu sesi penelusuran.
    //
    // One recomputation reads thirteen thousand documents; four region buttons
    // would exhaust the daily quota in a single browsing session.
    const tombol = page.slice(page.indexOf('aria-label="Filter daerah"'), page.indexOf('</div>', page.indexOf('aria-label="Filter daerah"')));
    expect(tombol).toMatch(/onClick=\{\(\) => onCity\(k\)\}/);
    expect(tombol).not.toMatch(/onReload|fetch\(/);
  });

  it('menurunkan daftar daerahnya dari kelas yang ada, bukan dari daftar di kode', () => {
    // Kelas baru akan muncul sendiri pada penyaringnya, tanpa menyunting kode.
    // A new class appears in the filter on its own, with no code change.
    expect(page).toMatch(/new Set\(snapshot\.classes\.map\(\(c\) => c\.city\)\)/);
  });

  it('menyaring seluruh panel dari baris peserta yang sama', () => {
    // Panel yang menyaring dengan caranya sendiri akan memperlihatkan daerah
    // yang berbeda dari grafik di sebelahnya.
    //
    // A panel filtering its own way would show a different region from the chart
    // beside it.
    expect(page).toMatch(/const perKota = useMemo/);
    expect(table).toMatch(/rows: RosterRow\[\]/);
    expect(table).not.toMatch(/snapshot\.roster\.filter/);
  });

  it('menghitung baris "Semua" dari jumlah mentahnya, bukan merata-rata persentase', () => {
    // Daerah berisi enam belas peserta dan daerah berisi dua puluh delapan tidak
    // boleh berbobot sama.
    //
    // A region of sixteen and one of twenty-eight must not carry equal weight.
    const blok = charts.slice(charts.indexOf("kota === 'Semua'"), charts.indexOf('if (!v || v.total === 0)'));
    expect(blok).toMatch(/hit: \(akum\?\.hit \?\? 0\) \+ satu\.hit/);
    expect(blok).toMatch(/total: \(akum\?\.total \?\? 0\) \+ satu\.total/);
  });

  it('menyembunyikan tabel peserta saat seluruh daerah ditampilkan', () => {
    // Tabelnya memuat dua puluh kolom per peserta; seratus baris dari empat
    // daerah sekaligus tidak dapat ditelusuri.
    //
    // The table carries twenty columns per participant; a hundred rows from four
    // regions at once cannot be scanned.
    expect(page).toMatch(/\{satuDaerah && \(/);
  });

  it('memakai warna yang sama untuk satu daerah di seluruh grafik', () => {
    // Daerah yang berganti warna antar-grafik menuntut pembacanya mencocokkan
    // keterangan dua kali untuk satu pertanyaan.
    //
    // A region that changes colour between charts makes its reader match the
    // legend twice for one question.
    expect(charts).toMatch(/export function cityColor/);
    expect(page).toMatch(/cityColor\(cities, k\)/);
  });
});

/**
 * Terkumpul atau tidak dibedakan dari nilainya.
 *
 * Tugas yang terkumpul tetapi belum dinilai bernilai null pada nilainya -- sama
 * dengan tugas yang tidak pernah dikumpulkan, padahal yang pertama menunggu
 * admin dan yang kedua menunggu peserta.
 *
 * Submission is kept apart from the score.
 *
 * A task submitted but not yet graded is null in its score -- the same as one
 * never handed in, though the first waits on the admin and the second on the
 * participant.
 */
describe('status pengumpulan tugas', () => {
  it('mencatat terkumpul atau tidak terpisah dari nilainya', () => {
    expect(types).toMatch(/taskSubmitted: \(boolean \| null\)\[\]/);
    expect(service).toMatch(/terkumpulPerSiswa\.get\(uid\)\?\.has\(t\.id\)/);
  });

  it('tidak menandai tugas yang tenggatnya belum lewat sebagai tidak mengumpulkan', () => {
    // Peserta masih punya waktu, dan menandainya terlambat membuat admin
    // menghubungi orang yang tidak terlambat.
    //
    // The participant still has time, and marking it late would have an admin
    // contact someone who is not late.
    const blok = service.slice(service.indexOf('const statusKumpul'), service.indexOf('const tugasTerhitung'));
    expect(blok).toMatch(/if \(!tenggat \|\| tenggat > nowIso\) return null;/);
  });

  it('membedakan belum dinilai dari tidak mengumpulkan pada tabelnya', () => {
    // Keduanya kosong pada kolom nilainya, tetapi yang pertama menunggu admin
    // dan yang kedua menunggu peserta.
    //
    // Both are blank in the score column, but the first waits on the admin and the
    // second on the participant.
    expect(table).toContain('Tidak mengumpulkan');
    expect(table).toContain('belum dinilai');
    expect(table).toMatch(/if \(terkumpul === false\)/);
  });
});

/**
 * Rating kepuasan dipecah per daerah.
 *
 * Satu angka gabungan menyembunyikan daerah yang ratingnya jatuh: rata-rata 4,2
 * dapat berarti seluruh daerah baik, atau tiga daerah sangat baik menutupi satu
 * daerah yang buruk.
 *
 * The satisfaction rating is split by region.
 *
 * A single combined figure hides the region whose rating has dropped: an average
 * of 4.2 can mean every region is fine, or three very good regions masking one bad
 * one.
 */
describe('rating kepuasan per daerah', () => {
  it('menyimpan rata-rata tiap pertanyaan per kota', () => {
    expect(types).toMatch(/byCity: Record<string, number \| null>/);
    expect(service).toMatch(/surveyQuestions\.push\(\{ label: q\.questionText, byCity \}\)/);
  });

  it('hanya merata-rata pertanyaan bernilai angka', () => {
    // Isian bebas dan pilihan ganda tidak punya angka untuk dijumlahkan.
    // Free text and multiple choice have no number to add up.
    const blok = service.slice(service.indexOf('const surveyQuestions'), service.indexOf('const surveys ='));
    expect(blok).toMatch(/if \(!NUMERIC_KINDS\.includes\(q\.kind\)\) continue;/);
  });

  it('membagi persentase pengisi dengan peserta aktif daerah itu, bukan seluruhnya', () => {
    // Dibagi seluruh peserta, daerah berisi enam belas orang tidak akan pernah
    // melampaui enam belas persen meski semuanya mengisi.
    //
    // Divided by every participant, a region of sixteen could never pass sixteen
    // percent even with everyone responding.
    expect(service).toMatch(/aktifPerKota\.get\(kota\) \?\? 0/);
  });

  it('tidak menampilkan nol untuk pertanyaan yang belum dijawab di satu daerah', () => {
    // Nol pada skala satu sampai lima terbaca sebagai penilaian terburuk, bukan
    // sebagai tidak ada jawaban.
    //
    // Zero on a one-to-five scale reads as the worst possible rating, not as no
    // answer at all.
    // Peta panasnya sudah diganti panel feedback kelas; aturan yang sama
    // berlaku di sana.
    //
    // The heatmap was replaced by the class feedback panel; the same rule
    // applies there.
    const feedback = readFileSync(resolve(process.cwd(), 'src/app/(admin)/admin/dashboard/feedback-panel.tsx'), 'utf-8');
    expect(feedback).toContain('Belum ada jawaban pada saringan ini');
    expect(feedback).toMatch(/avg: count > 0 \? sum \/ count : null/);
  });
});

/**
 * Biaya yang bertumbuh dibatasi di kedua ujungnya.
 *
 * Catatan login bertambah seratus baris sehari. Tanpa batas, penghitungan
 * ringkasan akan membaca empat puluh ribu dokumen dalam dua tahun, dan dokumen
 * ringkasannya memuat empat ratus baris untuk hari-hari yang tidak ada yang
 * menelusuri lagi.
 *
 * Growing costs are capped at both ends.
 *
 * Login records grow by a hundred rows a day. Uncapped, the snapshot computation
 * would read forty thousand documents within two years, and the snapshot document
 * would carry four hundred rows for days nobody scans any more.
 */
describe('batas biaya login', () => {
  it('membatasi pembacaannya pada hari-hari terakhir, bukan seluruh koleksinya', () => {
    expect(service).toMatch(/collection\('lmsLogins'\)\s*\.where\('date', '>=',/);
  });

  it('memangkas barisnya sebelum disimpan', () => {
    const blok = service.slice(service.indexOf('const logins:'), service.indexOf('// --- peringkat'));
    expect(blok).toMatch(/\.slice\(-60\)/);
  });
});

/**
 * Keterangan fase menyebut minggu keberapa bootcamp berjalan.
 *
 * Dihitung bersama fasenya di server, bukan di peramban: keduanya diturunkan
 * dari jadwal sesi yang sama, dan menghitungnya di dua tempat membuat
 * keterangan dan kotaknya dapat menyebut minggu yang berbeda.
 *
 * The phase caption names which week of the bootcamp is running.
 *
 * Computed with the phases on the server rather than in the browser: both derive
 * from the same session schedule, and computing it in two places would let the
 * caption and the cards name different weeks.
 */
describe('keterangan fase', () => {
  it('menyebut minggu keberapa dari berapa', () => {
    // 14 Sep mulai, 9 Okt akhir: empat minggu. 30 Sep ada di minggu ketiga.
    // Starting 14 Sep, ending 9 Okt: four weeks. 30 Sep falls in the third.
    const k = keteranganFase(sesi(['2026-09-11', '2026-09-14', '2026-10-09']), '2026-09-30T00:00:00Z');
    expect(k).toBe('Per 30 September 2026: bootcamp minggu ke-3 dari 4');
  });

  it('menghitung minggunya dari pertemuan pertama, bukan pergantian pekan', () => {
    // Bootcamp yang mulai hari Senin dan yang mulai hari Kamis akan menghitung
    // minggu yang berbeda bila diukur dari pergantian pekan.
    //
    // A bootcamp starting on a Monday and one starting on a Thursday would count
    // different weeks if measured from week boundaries.
    const kamis = keteranganFase(sesi(['2026-09-01', '2026-09-03', '2026-09-30']), '2026-09-09T00:00:00Z');
    expect(kamis).toContain('minggu ke-1');
    const seninLalu = keteranganFase(sesi(['2026-09-01', '2026-09-03', '2026-09-30']), '2026-09-11T00:00:00Z');
    expect(seninLalu).toContain('minggu ke-2');
  });

  it('tidak pernah menyebut minggu melampaui totalnya', () => {
    // Diperiksa menyeluruh atas rentang yang mungkin, bukan satu contoh:
    // "minggu ke-5 dari 4" adalah kalimat yang mustahil, dan satu contoh hanya
    // membuktikan satu tanggal.
    //
    // Checked exhaustively across the possible ranges rather than with one
    // example: "minggu ke-5 dari 4" is an impossible sentence, and a single
    // example proves only one date.
    const hari = (n: number) => new Date(Date.UTC(2026, 8, 14) + n * 86400000).toISOString().slice(0, 10);

    for (let akhir = 0; akhir < 120; akhir += 5) {
      for (let kini = 0; kini <= akhir; kini += 3) {
        const teks = keteranganFase(sesi(['2026-09-11', hari(0), hari(akhir)]), `${hari(kini)}T00:00:00Z`);
        const cocok = teks.match(/minggu ke-(\d+) dari (\d+)/);
        if (!cocok) continue;
        expect(Number(cocok[1]), teks).toBeLessThanOrEqual(Number(cocok[2]));
      }
    }
  });

  it('menyebut keadaannya saat bootcamp belum mulai atau sudah selesai', () => {
    const belum = keteranganFase(sesi(['2026-09-11', '2026-09-14', '2026-10-09']), '2026-09-12T00:00:00Z');
    expect(belum).toContain('bootcamp mulai 14 Sep');
    const usai = keteranganFase(sesi(['2026-09-11', '2026-09-14', '2026-10-09']), '2026-11-01T00:00:00Z');
    expect(usai).toContain('bootcamp selesai 9 Okt');
  });

  it('tetap menyebut tanggalnya saat jadwalnya belum diisi', () => {
    expect(keteranganFase([], '2026-09-30T00:00:00Z')).toBe('Per 30 September 2026');
  });

  it('dihitung di server, bukan di peramban', () => {
    expect(service).toMatch(/keteranganFase\(sessions, nowIso\)/);
    expect(page).toMatch(/\{snapshot\.phaseCaption\}/);
  });
});

/**
 * Daerah disingkat pada ubin yang sempit.
 *
 * Singkatannya diturunkan dari namanya, bukan dari daftar di kode: daerah baru
 * akan tersingkat sendiri tanpa menyunting apa pun.
 *
 * Regions are abbreviated on the narrow tiles.
 *
 * The abbreviation derives from the name rather than a list in code: a new region
 * abbreviates itself with nothing to edit.
 */
describe('singkatan daerah', () => {
  it('menurunkan singkatannya dari namanya, bukan daftar di kode', () => {
    expect(page).toMatch(/function singkatan\(kota: string\)/);
    // Daftar harfiah akan menuntut penyuntingan kode tiap kelas baru dibuka.
    // A literal list would demand a code change each time a class opens.
    expect(page).not.toMatch(/'DKI Jakarta':\s*'DKI'/);
  });

  it('memakai huruf awal untuk nama banyak kata', () => {
    expect(page).toMatch(/kata\.map\(\(k\) => k\[0\]\)/);
  });

  it('membuang vokal tengah untuk nama satu kata', () => {
    expect(page).toMatch(/replace\(\/\[aeiou\]\/gi, ''\)/);
  });
});

/**
 * Tiap peserta hanya punya kolom untuk sesi kelasnya sendiri.
 *
 * Menyatukan sesi seluruh kelas memberi tiap peserta puluhan kolom yang bukan
 * jadwalnya, dan tiap kolom itu terhitung "tidak hadir" sehingga kehadirannya
 * jatuh ke angka yang tidak pernah terjadi.
 *
 * A participant has columns only for their own class's sessions.
 *
 * Pooling every class's sessions gives each participant dozens of columns that are
 * not their schedule, and each counts as "absent", dropping their attendance to a
 * figure that never happened.
 */
describe('kolom kehadiran per kelas', () => {
  it('mengelompokkan sesinya per kelas, bukan menyatukan semuanya', () => {
    expect(service).toMatch(/const sesiPerKelasId = new Map<string, SessionDocument\[\]>/);
    // Kelas gabungan (onboarding) muncul pada tiap kelas yang menghadirinya.
    // A shared session (onboarding) appears under every class attending it.
    expect(service).toMatch(/for \(const cid of sesi\.classIds \?\? \[sesi\.classId\]\)/);
  });

  it('tidak memberi peserta kolom milik kelas lain', () => {
    // Empat kelas berisi dua belas pertemuan masing-masing menghasilkan lima
    // puluh empat kolom bila disatukan, dan empat puluh dua di antaranya bukan
    // jadwal peserta mana pun yang melihatnya.
    //
    // Four classes of twelve meetings each yield fifty-four columns when pooled,
    // and forty-two of them are not the schedule of any participant looking at it.
    const blok = service.slice(service.indexOf('const sesiKelas ='), service.indexOf('const sudah ='));
    expect(blok).toMatch(/sesiPerKelasId\.get\(cid\)/);
    expect(blok).not.toMatch(/sesiTampil\.map\(\(sesi\)/);
  });

  it('menandai kolom di luar jadwal kelasnya sebagai belum berjalan', () => {
    // Kelas yang sesinya lebih sedikit tidak boleh terbaca sebagai peserta yang
    // membolos pada pertemuan yang tidak pernah dijadwalkan untuknya.
    //
    // A class with fewer sessions must not read as a participant skipping meetings
    // that were never scheduled for them.
    const blok = service.slice(service.indexOf('const sesiKelas ='), service.indexOf('const sudah ='));
    expect(blok).toMatch(/if \(!sesi\) return null;/);
  });

  it('memakai judul sesi hanya bila seluruh kelas memakai judul yang sama', () => {
    // Kelas yang pertemuan ketiganya "Design Thinking" dan kelas yang ketiganya
    // "Data Cleaning" tidak dapat diwakili satu judul, dan keterangan yang salah
    // lebih buruk daripada tanpa keterangan.
    //
    // A class whose third meeting is "Design Thinking" and one whose third is
    // "Data Cleaning" cannot share one title, and a wrong caption is worse than
    // none.
    const blok = service.slice(service.indexOf('sessionLabels:'), service.indexOf('quizLabels:'));
    expect(blok).toMatch(/new Set\(judul\)\.size === 1 \? judul\[0\] : `Pertemuan \$\{i \+ 1\}`/);
  });

  it('melebarkan peta panasnya seiring jumlah kolomnya', () => {
    // Lima puluh kolom pada lebar tetap tujuh ratus piksel menjadi sebelas
    // piksel masing-masing, dan angkanya bertindihan sampai tidak terbaca.
    //
    // Fifty columns at a fixed seven hundred pixels become eleven pixels each, and
    // the figures overlap until they cannot be read.
    expect(charts).toMatch(/const lebar = minWidth \?\? \d+ \+ columns\.length \* \d+/);
    expect(charts).toMatch(/minWidth: lebar/);
    // Tidak ada pemanggil yang memaksanya nol: lebar nol mengembalikan
    // perasan yang sama pada kotak yang lebih sempit.
    //
    // No caller forces it to zero: a zero width restores the same squeeze inside a
    // narrower box.
    expect(page).not.toMatch(/minWidth=\{0\}/);
  });
});

/**
 * Ringkasan berbentuk lama dihitung ulang sendiri.
 *
 * Ringkasan yang dibuat kode lama memuat angka yang dihitung dengan aturan yang
 * sudah diperbaiki. Menampilkannya berarti perbaikan yang sudah tayang tidak
 * terlihat sampai ada yang menekan Hitung Ulang -- beban yang dipikul admin
 * untuk kesalahan yang bukan miliknya.
 *
 * An older-shaped snapshot recomputes itself.
 *
 * A snapshot built by older code carries figures computed under rules that have
 * since been fixed. Showing it means a deployed fix stays invisible until somebody
 * presses Hitung Ulang -- a burden carried by an admin for a mistake that is not
 * theirs.
 */
describe('versi bentuk ringkasan', () => {
  it('memeriksa versinya sebelum umurnya', () => {
    // Ringkasan berbentuk lama yang baru saja ditulis adalah yang paling muda,
    // dan pemeriksaan umur saja justru membuatnya bertahan paling lama.
    //
    // A freshly written older-shaped snapshot is the youngest of all, and an age
    // check alone is exactly what would keep it around longest.
    expect(service).toMatch(/\(data\.version \?\? 1\) === SNAPSHOT_VERSION && umur < SNAPSHOT_MAX_AGE_MS/);
  });

  it('memperlakukan ringkasan tanpa versi sebagai versi satu', () => {
    // Ringkasan yang sudah tersimpan sebelum versinya ada tidak punya medan itu,
    // dan undefined yang tidak ditangani akan membuatnya bertahan selamanya.
    //
    // A snapshot stored before the version existed lacks the field, and an
    // unhandled undefined would keep it forever.
    expect(service).toMatch(/data\.version \?\? 1/);
  });

  it('menyertakan versinya pada ringkasan yang baru dihitung', () => {
    expect(service).toMatch(/version: SNAPSHOT_VERSION/);
    expect(SNAPSHOT_VERSION).toBeGreaterThanOrEqual(2);
  });
});

/**
 * Tiap peserta hanya punya kolom untuk tugas dan kuis kelasnya sendiri.
 *
 * Menyatukan tugas seluruh kelas menjadi satu deret membuat kolom "Tugas 2"
 * milik satu kelas saja, dan peserta kelas lain -- yang tidak mungkin
 * mengumpulkannya -- terhitung nol persen begitu tenggatnya lewat.
 *
 * Each participant has columns only for their own class's tasks and quizzes.
 *
 * Pooling every class's tasks into one run makes the "Tugas 2" column belong to
 * one class alone, and participants from other classes -- who cannot possibly
 * submit it -- count as zero percent once its deadline passes.
 */
describe('kolom tugas dan kuis per kelas', () => {
  it('mengelompokkan tugasnya per kelas, bukan satu deret untuk semua', () => {
    expect(service).toMatch(/const tugasPerKelasId = new Map/);
    expect(service).toMatch(/per\.get\(t\.classId\)!\.push\(t\)/);
    expect(service).not.toMatch(/const tasks = tasksSnap\.docs/);
  });

  it('mengelompokkan kuisnya per kelas, bukan satu deret untuk semua', () => {
    // Kuis pertemuan 3 Surabaya bukan kuis pertemuan 3 Semarang.
    // Surabaya's meeting 3 quiz is not Semarang's.
    expect(service).toMatch(/const kuisPerKelasId = new Map/);
    expect(service).not.toMatch(/const kuisUrut = exams\.filter/);
  });

  it('mengurutkan kuis menurut tanggal pertemuannya', () => {
    expect(service).toMatch(/tanggalSesi\.get\(a\.sessionId\)/);
  });

  it('mengambil tugas dan kuis dari kelas peserta itu sendiri', () => {
    const blok = service.slice(service.indexOf('quizScores: Array.from'), service.indexOf('status: (!s.active'));
    expect(blok).toMatch(/kuisPerKelasId\.get\(cid\)\?\.\[i\]/);
    expect(blok.match(/tugasPerKelasId\.get\(cid\)\?\.\[i\]/g)).toHaveLength(2);
  });

  it('menandai kolom di luar deret kelasnya sebagai kosong, bukan tidak mengumpulkan', () => {
    // Kelas yang tugasnya lebih sedikit tidak boleh terbaca sebagai yang tidak
    // mengumpulkan.
    //
    // A class with fewer tasks must not read as one that failed to submit.
    const blok = service.slice(service.indexOf('const statusKumpul'), service.indexOf('const tugasTerhitung'));
    sebelumTeks(blok, 'if (!t) return null;', 'return false;');
  });

  it('memakai judul bersama hanya bila seluruh kelas sepakat', () => {
    expect(service).toMatch(/new Set\(judul\)\.size === 1 \? judul\[0\] : `\$\{awalan\} \$\{i \+ 1\}`/);
    expect(service).toMatch(/taskLabels: labelKolom\(tugasPerKelasId, kolomTugas, 'Tugas'\)/);
  });

  it('tidak lagi menyimpan agregat yang dihitung dari deret campuran', () => {
    // Medan-medan ini tidak dipakai halaman mana pun, dan angkanya salah:
    // tugas, kuis, dan kehadiran seluruh kelas dibagi dengan seluruh peserta.
    //
    // These fields are used by no page, and their figures were wrong: every
    // class's tasks, quizzes, and attendance divided by every participant.
    for (const medan of ['attendancePerSession', 'submissionPerTask', 'scorePerTask', 'quizPerSession']) {
      expect(types, medan).not.toContain(medan);
      expect(service, medan).not.toContain(medan);
    }
  });

  it('menaikkan versi ringkasannya supaya ringkasan lama dihitung ulang', () => {
    // Tanpa ini, ringkasan hari ini yang sudah tersimpan tetap menampilkan
    // nol persen sampai umurnya habis.
    //
    // Without this, today's already-stored snapshot keeps showing zero percent
    // until it ages out.
    expect(SNAPSHOT_VERSION).toBeGreaterThanOrEqual(3);
  });
});

function sebelumTeks(teks: string, a: string, b: string) {
  const i = teks.indexOf(a);
  const j = teks.indexOf(b);
  expect(i, `tidak ditemukan: ${a}`).toBeGreaterThan(-1);
  expect(j, `tidak ditemukan: ${b}`).toBeGreaterThan(-1);
  expect(i).toBeLessThan(j);
}

describe('nilai sementara di ringkasan', () => {
  it('baris peringkat membawa komponen yang belum dinilai, dan versinya naik', () => {
    // Job Portal menandai nilai akhir "sementara" dari medan ini / The Job Portal marks a final score "provisional" from this field
    expect(service).toMatch(/pending: nilai\.pending/);
    expect(SNAPSHOT_VERSION).toBeGreaterThanOrEqual(17);
  });
});
