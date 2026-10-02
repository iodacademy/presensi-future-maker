// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateProfile, ageFrom, MIN_AGE, MAX_AGE } from '@/features/users/profile-service';
import { DISABILITY_LABELS, GENDER_LABELS, ENTRY_STATUS_LABELS } from '@/features/users/profile-types';
import type { ProfileInput } from '@/features/users/profile-types';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const layout = read('src/app/(student)/app/layout.tsx');
const gate = read('src/components/profile-gate.tsx');
const service = read('src/features/users/profile-service.ts');
const types = read('src/features/users/profile-types.ts');

const isi = (over: Partial<ProfileInput> = {}): Partial<ProfileInput> => ({
  birthDate: '2004-05-17',
  gender: 'perempuan',
  disability: 'tidak-ada',
  disabilityNote: '',
  entryStatus: 'mahasiswa',
  phone: '08123456789',
  ...over,
});

/**
 * Usia dihitung dari tanggal lahir, bukan disimpan.
 *
 * Usia yang disimpan menjadi salah tiap ulang tahun, dan tidak ada yang
 * memperbaruinya -- angkanya diam sementara orangnya bertambah tua.
 *
 * Age is computed from the birth date, not stored.
 *
 * A stored age turns wrong on every birthday, and nothing updates it -- the
 * number sits still while the person grows older.
 */
describe('perhitungan usia', () => {
  it('menghitung dari tanggal lahirnya', () => {
    expect(ageFrom('2004-01-01', new Date('2026-06-01T00:00:00+07:00'))).toBe(22);
  });

  it('mengurangi satu bila ulang tahunnya belum lewat', () => {
    // Tanpa ini, peserta yang lahir Desember terhitung setahun lebih tua
    // sepanjang sebelas bulan.
    //
    // Without this, someone born in December counts a year older for eleven
    // months.
    expect(ageFrom('2004-12-31', new Date('2026-06-01T00:00:00+07:00'))).toBe(21);
    expect(ageFrom('2004-12-31', new Date('2026-12-31T00:00:00+07:00'))).toBe(22);
  });

  it('tidak menyimpan usianya pada profilnya', () => {
    const badan = types.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(badan).toContain('birthDate: string');
    expect(badan).not.toMatch(/\bage\b|\busia\b/i);
  });

  it('mengembalikan null untuk tanggal yang tidak terbaca', () => {
    expect(ageFrom('bukan-tanggal')).toBe(null);
  });
});

describe('validasi profil', () => {
  it('menerima isian yang lengkap', () => {
    expect(() => validateProfile(isi())).not.toThrow();
  });

  it('menolak tanggal lahir yang kosong atau salah bentuk', () => {
    expect(() => validateProfile(isi({ birthDate: '' }))).toThrow(/Tanggal lahir wajib/);
    expect(() => validateProfile(isi({ birthDate: '17 Mei 2004' }))).toThrow(/Tanggal lahir wajib/);
  });

  it('menolak usia di luar rentang yang masuk akal', () => {
    // Tanggal yang salah ketik -- tahun 2026 alih-alih 2006 -- menghasilkan
    // usia nol, dan rata-rata usia seluruh angkatan ikut melesat.
    //
    // A mistyped date -- 2026 instead of 2006 -- yields an age of zero, and the
    // cohort's average age slides with it.
    const tahunIni = new Date().getFullYear();
    expect(() => validateProfile(isi({ birthDate: `${tahunIni}-01-01` }))).toThrow(/Periksa kembali tahun lahirnya/);
    expect(() => validateProfile(isi({ birthDate: '1900-01-01' }))).toThrow(/Periksa kembali tahun lahirnya/);
  });

  it('menerima usia tepat di batasnya', () => {
    const tahunIni = new Date().getFullYear();
    expect(() => validateProfile(isi({ birthDate: `${tahunIni - MIN_AGE}-01-01` }))).not.toThrow();
    expect(() => validateProfile(isi({ birthDate: `${tahunIni - MAX_AGE}-12-31` }))).not.toThrow();
  });

  it('menolak pilihan di luar daftarnya', () => {
    // Muatan yang dikirim dapat diubah sebelum tiba, dan nilai di luar daftar
    // akan memunculkan kategori yang tidak pernah ditawarkan pada rekap.
    //
    // The payload sent can be altered before it arrives, and a value outside
    // the list would put a category nobody was offered into the report.
    expect(() => validateProfile(isi({ gender: 'lain' as never }))).toThrow(/Jenis kelamin/);
    expect(() => validateProfile(isi({ disability: 'apa-saja' as never }))).toThrow(/disabilitas/);
    expect(() => validateProfile(isi({ entryStatus: 'ngawur' as never }))).toThrow(/Status saat mendaftar/);
  });

  it('menuntut keterangan bila disabilitasnya lainnya', () => {
    // "Lainnya" tanpa keterangan tidak memberi tahu apa pun yang dapat
    // ditindaklanjuti penyelenggara.
    //
    // "Other" with no note tells the organisers nothing they can act on.
    expect(() => validateProfile(isi({ disability: 'lainnya', disabilityNote: '' }))).toThrow(/Sebutkan jenis/);
    expect(() => validateProfile(isi({ disability: 'lainnya', disabilityNote: 'Tuli sebelah' }))).not.toThrow();
  });

  it('membedakan tidak ada disabilitas dari belum menjawab', () => {
    // Peserta yang memilih "tidak ada" berbeda dari yang melewatkan
    // pertanyaannya, dan menggabungkan keduanya membuat jumlah peserta
    // disabilitas tidak dapat dipercaya.
    //
    // Someone who picks "none" differs from one who skipped the question, and
    // merging the two makes the disability count untrustworthy.
    expect(DISABILITY_LABELS['tidak-ada']).toBe('Tidak ada');
    expect(() => validateProfile(isi({ disability: undefined }))).toThrow(/disabilitas/);
  });

  it('menerima nomor WhatsApp dalam beberapa bentuk', () => {
    for (const n of ['08123456789', '+628123456789', '628123456789', '0812-3456-789']) {
      expect(() => validateProfile(isi({ phone: n })), n).not.toThrow();
    }
  });

  it('menolak nomor yang bukan ponsel Indonesia', () => {
    for (const n of ['', '021555123', '12345', 'nomor saya']) {
      expect(() => validateProfile(isi({ phone: n })), n).toThrow(/WhatsApp/);
    }
  });

  it('membuang spasi dan tanda hubung dari nomornya', () => {
    expect(validateProfile(isi({ phone: '0812-3456-789' })).phone).toBe('08123456789');
  });

  it('memangkas keterangan yang terlalu panjang', () => {
    const panjang = 'a'.repeat(400);
    expect(validateProfile(isi({ disability: 'lainnya', disabilityNote: panjang })).disabilityNote).toHaveLength(200);
  });
});

/**
 * Gerbangnya dipasang di layout, bukan pada kerangka tampilannya.
 *
 * Empat halaman -- pengerjaan ujian, hasil ujian, pemindaian QR, dan pengisian
 * survei -- tidak memakai kerangka itu, dan tautan langsung ke salah satunya
 * akan melewati gerbangnya.
 *
 * The gate sits in the layout, not the view shell.
 *
 * Four pages -- the exam runner, the exam result, QR scanning, and filling in a
 * survey -- do not use that shell, and a direct link to any would bypass it.
 */
describe('gerbang profil', () => {
  it('dipasang di layout peserta', () => {
    expect(existsSync(resolve(process.cwd(), 'src/app/(student)/app/layout.tsx'))).toBe(true);
    expect(layout).toContain('getProfile(actor.uid)');
    expect(layout).toContain('<ProfileGateClient />');
  });

  it('menjaga halaman yang tidak memakai kerangka tampilannya', () => {
    // Keempatnya berada di bawah layout ini, sehingga tidak ada satu pun yang
    // dapat dibuka tanpa melewati gerbangnya.
    //
    // All four sit under this layout, so none can be opened without passing
    // the gate.
    for (const p of [
      'src/app/(student)/app/ujian/[examId]/page.tsx',
      'src/app/(student)/app/ujian/[examId]/hasil/[attemptId]/page.tsx',
      'src/app/(student)/app/presensi/scan/page.tsx',
      'src/app/(student)/app/survei/[formId]/[sessionId]/page.tsx',
    ]) {
      expect(existsSync(resolve(process.cwd(), p)), p).toBe(true);
    }
  });

  it('menggambar formulirnya di tempat, tidak mengalihkan', () => {
    // Halaman pengisiannya pun berada di bawah layout ini, sehingga mengalihkan
    // ke sana akan memicu pemeriksaan yang sama dan mengalihkannya lagi --
    // lingkaran yang tidak pernah berhenti.
    //
    // The form's own page would also sit under this layout, so redirecting to
    // it would trigger the same check and redirect again -- a loop that never
    // ends.
    expect(layout).not.toContain('redirect(');
  });

  it('melewatkan mentor dan admin', () => {
    // Keduanya tidak pernah diminta melengkapinya, dan menahan mereka pada
    // formulir yang bukan untuknya mengunci seluruh aplikasi bagi admin.
    //
    // Neither is ever asked to complete one, and holding them on a form that is
    // not theirs would lock the whole app for an admin.
    expect(layout).toMatch(/actor\.role !== 'student'/);
  });

  it('diperiksa di server, bukan di peramban', () => {
    // Pemeriksaan di peramban hanya menyembunyikan halamannya; tautan langsung
    // tetap menggambar isinya sebelum pemeriksaannya selesai.
    //
    // A browser check only hides the page; a direct link still draws its
    // contents before the check finishes.
    expect(layout).not.toContain("'use client'");
  });

  it('menyebut alasan datanya diminta', () => {
    // Formulir yang menghadang tanpa menjelaskan kenapa terbaca sebagai
    // halangan, dan peserta mengisinya asal supaya cepat lewat.
    //
    // A form that blocks without explaining why reads as an obstacle, and
    // participants fill it carelessly to get past.
    expect(gate).toContain('menyiapkan kebutuhan belajar Anda');
    expect(gate).toContain('menyiapkan akomodasi');
  });

  it('menahan tombol simpan sampai seluruhnya terisi', () => {
    expect(gate).toMatch(/const lengkap =/);
    expect(gate).toMatch(/disabled=\{busy \|\| !lengkap\}/);
  });

  it('menampilkan kolom keterangan hanya bila diperlukan', () => {
    expect(gate).toMatch(/disability === 'lainnya' && \(/);
  });
});

describe('penyimpanan profil', () => {
  it('disimpan di luar dokumen penggunanya', () => {
    // Dokumen pengguna dibaca pada hampir setiap jalur -- presensi, tugas,
    // ujian -- dan tanggal lahir serta disabilitas tidak dibutuhkan satu pun di
    // antaranya.
    //
    // The user document is read on nearly every path -- attendance, tasks,
    // exams -- and neither the birth date nor the disability is needed by any.
    expect(service).toMatch(/collection\('studentProfiles'\)/);
    expect(service).not.toMatch(/collection\('users'\)/);
  });

  it('hanya peserta yang mengisinya sendiri', () => {
    // Data ini tentang dirinya, dan menanyakannya lewat admin berarti seratus
    // percakapan yang jawabannya sudah dipegang orangnya.
    //
    // This is about themselves, and asking through an admin would mean a
    // hundred conversations whose answers the person already holds.
    expect(service).toMatch(/actor\.role !== 'student'/);
    expect(service).toContain('actor.uid');
  });

  it('memakai seluruh pilihan yang ditawarkan formulirnya', () => {
    // Pilihan yang ada di layar tetapi ditolak server membuat peserta terhenti
    // pada jawaban yang baru saja ia pilih.
    //
    // A choice on screen that the server refuses leaves a participant stuck on
    // the answer they just picked.
    // Formulirnya menurunkan pilihannya dari daftar yang sama dengan yang
    // diperiksa server, bukan mengetiknya ulang: daftar yang diketik ulang
    // menyimpang begitu salah satunya berubah.
    //
    // The form derives its choices from the same list the server checks rather
    // than retyping them: a retyped list drifts apart as soon as one changes.
    for (const peta of ['GENDER_LABELS', 'DISABILITY_LABELS', 'ENTRY_STATUS_LABELS']) {
      expect(gate, peta).toContain(`Object.keys(${peta})`);
    }
    expect(Object.keys(GENDER_LABELS).length).toBeGreaterThan(0);
    expect(Object.keys(DISABILITY_LABELS)).toContain('tidak-ada');
    expect(Object.keys(ENTRY_STATUS_LABELS).length).toBeGreaterThan(0);
  });
});

/**
 * Profilnya meringkas ke dashboard dari koleksinya sendiri.
 *
 * Yang belum melengkapi dicatat terpisah: persentase yang dihitung dari tujuh
 * puluh peserta tetapi disajikan seolah dari seratus akan dibaca sebagai
 * gambaran utuh angkatannya.
 *
 * The profile summarises onto the dashboard from its own collection.
 *
 * Those who have not completed theirs are recorded separately: a percentage
 * computed over seventy participants but presented as if over a hundred would be
 * read as the whole cohort.
 */
describe('profil pada ringkasan dashboard', () => {
  const service = read('src/features/dashboard/snapshot-service.ts');
  const types = read('src/features/dashboard/snapshot-types.ts');
  const page = read('src/app/(admin)/admin/dashboard/page.tsx');

  it('dibaca dalam satu putaran bersama koleksi lainnya', () => {
    // Pembacaan terpisah setelah Promise.all menambah satu perjalanan ke basis
    // data pada penghitungan yang sudah membaca tiga belas ribu dokumen.
    //
    // A separate read after the Promise.all adds another round trip to a
    // computation that already reads thirteen thousand documents.
    const satuPutaran = service.slice(service.indexOf('await Promise.all(['), service.indexOf(']);'));
    expect(satuPutaran).toContain("db.collection('studentProfiles').get()");
  });

  it('hanya menghitung peserta yang masih aktif', () => {
    // Profil peserta yang sudah keluar tetap tersimpan, dan menyertakannya
    // membuat sebarannya menggambarkan angkatan yang tidak lagi ada.
    //
    // A departed participant's profile stays stored, and including it would have
    // the distribution describe a cohort that no longer exists.
    const blok = service.slice(service.indexOf('profilesSnap.docs'), service.indexOf('const usia ='));
    expect(blok).toMatch(/aktifIds\.has\(pr\.id\)/);
  });

  it('mencatat yang belum melengkapi terpisah dari sebarannya', () => {
    expect(types).toMatch(/profilePendingByCity: Record<string, number>/);
    expect(service).toMatch(/if \(sudahLengkap\.has\(s\.uid\)\) continue;/);
    expect(page).toContain('snapshot.profilePendingByCity');
  });

  it('menyebut pembaginya saat ada yang belum melengkapi', () => {
    // Sebaran yang ditampilkan tanpa pembaginya terbaca sebagai gambaran utuh.
    // A distribution shown without its denominator reads as the whole picture.
    expect(page).toContain('Dari {profiles.length} peserta yang sudah melengkapi profilnya');
    expect(page).toMatch(/\{pending > 0 \? `, \$\{pending\} belum`/);
  });

  it('menyimpan barisnya mentah agar dapat disaring per daerah', () => {
    // Sebaran yang sudah dijumlah tidak dapat dipecah lagi, dan dashboardnya
    // dapat disaring per daerah.
    //
    // A summed distribution cannot be split again, and the dashboard can be
    // filtered by region.
    expect(types).toMatch(/profiles: ProfileRow\[\]/);
    expect(types).toMatch(/city: string/);
    expect(page).toMatch(/snapshot\.profiles\.filter\(\(p\) => cities\.includes\(p\.city\)\)/);
  });

  it('tidak menyertakan nama peserta pada barisnya', () => {
    // Tidak ada panel yang menyebut siapa yang disabilitas atau berapa usianya,
    // dan menyertakan namanya hanya menambah data pribadi yang beredar tanpa
    // ada yang memakainya.
    //
    // No panel names who has a disability or how old they are, and including the
    // name would only put personal data in circulation with nothing using it.
    const blok = types.slice(types.indexOf('export interface ProfileRow'), types.indexOf('export interface SurveyQuestionPoint'));
    expect(blok).not.toMatch(/\bname\b|studentId|uid/i);
  });

  it('tidak menghitung "tidak ada" sebagai disabilitas', () => {
    // Menjumlahkannya ke dalam hitungan peserta disabilitas membuat angkanya
    // menjadi seluruh peserta.
    //
    // Adding it to the disability count would make the figure the entire cohort.
    expect(page).toMatch(/d\.label !== 'Tidak ada'/);
  });

  it('menghitung usia saat meringkas, bukan menyimpannya', () => {
    expect(service).toMatch(/ageFrom\(pr\.birthDate\)/);
    expect(types).not.toMatch(/birthDate/);
  });

  it('membuang kategori yang tidak ada isinya', () => {
    // Enam batang kosong di samping satu yang terisi membuat yang terisi
    // menjadi sulit dibandingkan. Dihitung di peramban dari barisnya, sehingga
    // hanya kategori yang benar-benar dipilih seseorang yang muncul.
    //
    // Six empty bars beside one filled makes the filled one hard to compare.
    // Counted in the browser from the rows, so only categories someone actually
    // picked appear at all.
    expect(page).toMatch(/peta\.set\(ambil\(p\), \(peta\.get\(ambil\(p\)\) \?\? 0\) \+ 1\)/);
    expect(page).toMatch(/\.filter\(\(\[, v\]\) => v > 0\)/);
  });

  it('tidak memakai hijau dan merah untuk kategori yang netral', () => {
    // Kategori ini tidak punya arti baik atau buruk; warna peringatan membuat
    // "mencari kerja" terbaca sebagai kegagalan.
    //
    // These categories carry no good or bad meaning; an alert colour would have
    // "job seeking" read as a failure.
    const blok = page.slice(page.indexOf('const SEBARAN_WARNA'), page.indexOf('export default'));
    expect(blok).not.toMatch(/color-danger|color-success|color-warning/);
  });

  it('menurunkan labelnya dari daftar yang sama dengan formulirnya', () => {
    // Label yang diketik ulang menyimpang begitu salah satunya berubah, dan
    // rekapnya menyebut kategori dengan nama yang tidak pernah dilihat peserta.
    //
    // A retyped label drifts apart as soon as one changes, and the report names a
    // category by a name no participant ever saw.
    for (const peta of ['GENDER_LABELS', 'DISABILITY_LABELS', 'ENTRY_STATUS_LABELS']) {
      expect(service, peta).toContain(peta);
    }
  });
});
