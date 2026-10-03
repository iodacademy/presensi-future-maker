// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hitungFase, keteranganFase, tanggalSingkat, PHASES_AFTER_BOOTCAMP } from '@/features/dashboard/phases';

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
    const masuk = read('src/app/api/auth/session/route.ts');
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
    expect(service).toMatch(/terkumpulPerSiswa\.get\(s\.uid\)\?\.has\(t\.id\)/);
  });

  it('tidak menandai tugas yang tenggatnya belum lewat sebagai tidak mengumpulkan', () => {
    // Peserta masih punya waktu, dan menandainya terlambat membuat admin
    // menghubungi orang yang tidak terlambat.
    //
    // The participant still has time, and marking it late would have an admin
    // contact someone who is not late.
    const blok = service.slice(service.indexOf('taskSubmitted: tasks.map'), service.indexOf('status: (!s.active'));
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
    expect(page).toMatch(/v === null \? \(/);
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
