// Informasi program yang ditampilkan pada halaman Overview peserta
// Program information shown on the participant Overview page

/**
 * Disalin dari `src/config/program.ts` pada projek landing page
 * (4. BOOTCAMP INNOV) per 24 September 2026.
 *
 * Kedua salinan tidak saling terhubung. Bila jadwal, kurikulum, atau syarat
 * berubah di landing page, berkas ini tidak ikut berubah dan tidak ada yang
 * memberi tahu. `program-freshness.test.ts` menggagalkan build ketika tanggal
 * program sudah terlampaui, supaya data basi tidak diam-diam tersaji kepada
 * peserta -- itu pengingat, bukan penyelarasan otomatis.
 *
 * Copied from `src/config/program.ts` in the landing page project
 * (4. BOOTCAMP INNOV) on 24 September 2026.
 *
 * The two copies are not linked. If schedules, curriculum, or requirements
 * change on the landing page, this file does not follow and nothing announces
 * it. `program-freshness.test.ts` fails the build once the programme dates have
 * passed, so stale data is not quietly served to participants -- that is a
 * reminder, not automatic syncing.
 */
export const PROGRAM_SOURCE_DATE = '2026-09-24';

export type PackageKey = 'web' | 'smm' | 'data';

export interface CurriculumMeeting {
  title: string;
  outcome: string;
}

export interface PackageCurriculum {
  label: string;
  capstoneNote: string;
  capstoneList: string[];
  meetings: CurriculumMeeting[];
  /** Pertemuan ke berapa yang diadakan luring / Which meetings are held offline */
  offlineMeetings: number[];
}

export const PACKAGE_ORDER: [PackageKey, string][] = [
  ['web', 'Web Programming'],
  ['smm', 'Social Media Marketing'],
  ['data', 'Data Analyst'],
];

export const LOCATIONS = [
  {
    city: 'Semarang',
    major: 'Web Programming',
    packageKey: 'web' as PackageKey,
    venue: 'BBPVP Semarang',
    address:
      'Jalan Brigjen Sudiarto No. 118, Palebon, Kecamatan Pedurungan, Kota Semarang, Jawa Tengah 50246',
    offlineCount: 6,
  },
  {
    city: 'Surabaya',
    major: 'Social Media Marketing',
    packageKey: 'smm' as PackageKey,
    venue: 'Disnaker Provinsi Jawa Timur',
    address:
      'Jalan Dukuh Menanggal Selatan No. 124-126, Dukuh Menanggal, Kecamatan Gayungan, Surabaya, Jawa Timur 60234',
    offlineCount: 4,
  },
  {
    city: 'Yogyakarta',
    major: 'Social Media Marketing',
    packageKey: 'smm' as PackageKey,
    venue: 'BPO Yogyakarta',
    address:
      'Ndalem Ngadiwinatan, Suryoputran KT II No. 23, Panembahan, Kecamatan Kraton, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55133',
    offlineCount: 4,
  },
  {
    city: 'DKI Jakarta',
    major: 'Data Analyst',
    packageKey: 'data' as PackageKey,
    venue: 'Poltek APP Jakarta',
    address:
      'Jalan Timbul No. 34, RT.6/RW.5, Cipedak, Kecamatan Jagakarsa, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12630',
    offlineCount: 4,
  },
];

export const PROGRAM_STAGES = [
  { title: 'Seleksi', date: 'September 2026' },
  { title: 'Onboarding', date: '25 September 2026' },
  { title: 'Bootcamp teknis', date: '28 September – 12 November 2026' },
  { title: 'Capstone & showcase', date: '26 Oktober – 12 November 2026' },
  { title: 'Magang berbayar', date: '23 November 2026 – 19 Februari 2027' },
  { title: 'Persiapan kerja', date: '1 Februari – 30 April 2027' },
];

/**
 * Tanggal berakhirnya program dalam bentuk yang dapat dibandingkan mesin.
 * Dipakai uji kesegaran; tanggal pada PROGRAM_STAGES ditulis untuk dibaca
 * manusia sehingga tidak dapat diurai secara andal.
 *
 * The programme end date in machine-comparable form. Used by the freshness
 * test; the dates in PROGRAM_STAGES are written for humans and cannot be parsed
 * reliably.
 */
export const PROGRAM_ENDS_AT = '2027-04-30';

export const CURRICULUM: Record<PackageKey, PackageCurriculum> = {
  web: {
    label: 'Web Programming',
    capstoneNote: 'Dipilih pada pertemuan pertama, dikerjakan sampai deploy production.',
    capstoneList: ['HRIS', 'ERP Custom', 'LMS', 'POS', 'Aplikasi Manajemen Properti', 'Finance dan Accounting'],
    offlineMeetings: [1, 3, 6, 9, 12],
    meetings: [
      { title: 'Setup & App 1: Landing Page', outcome: 'Setup tools, prompt landing page, deploy live ke Netlify, dan memilih proyek capstone dari katalog' },
      { title: 'Requirement, Business Logic & Data Model', outcome: 'Menyusun PRD, ERD' },
      { title: 'App 2 CRUD Satu Peran', outcome: 'Membangun app CRUD dari nol sampai deploy' },
      { title: 'Authentication & Authorization', outcome: 'Menyusun Matriks Role & Permission untuk App 3' },
      { title: 'Routing, State & Desain', outcome: 'Menyusun peta routing dan design system 1 halaman untuk App 3' },
      { title: 'App 3 Multi-Role + Auth & RBAC', outcome: 'Membangun app multi-role dari nol sampai deploy' },
      { title: 'API Design & Error Handling', outcome: 'Menyusun daftar endpoint dan tabel error code untuk App 3' },
      { title: 'Security & Data Consistency', outcome: 'Menyusun daftar operasi yang wajib atomic dan peta state machine App 3' },
      { title: 'App 4 Aplikasi Berstatus', outcome: 'Membangun 1 dari 4 pilihan app (Peminjaman, Cuti, Ticketing, Reservasi) dari nol sampai deploy' },
      { title: 'App 5 Aplikasi Terhubung Payment Gateway', outcome: '1 aplikasi yang terhubung dengan payment gateway' },
      { title: 'Testing, Audit Trail & Deployment', outcome: 'Menyusun test plan capstone minimal 15 test case dan checklist rilis siap pakai' },
      { title: 'Capstone Build & Hardening', outcome: 'Menyelesaikan capstone, deploy production, uji tembus akhir, tutup bug kritis' },
    ],
  },
  smm: {
    label: 'Social Media Marketing',
    capstoneNote: 'Produk yang dikerjakan divariasikan antar peserta.',
    capstoneList: ['Produksi konten', 'Campaign Meta Ads', 'Campaign TikTok Ads', 'Campaign report'],
    offlineMeetings: [1, 6, 12],
    meetings: [
      { title: 'Fondasi Strategi dan Riset dengan AI', outcome: 'Brand Knowledge Base, Brand Brief 1 halaman' },
      { title: 'Ekosistem Digital Marketing dan Brand Identity', outcome: 'Brand identity guide, peta ekosistem channel untuk brand yang dipakai' },
      { title: 'Content Strategy dan Brand Voice Engine', outcome: 'Content calendar 1 bulan, 5 content brief' },
      { title: 'Pembuatan SOP dan Penjadwalan Konten', outcome: 'Content system doc dan SOP, konten 2 minggu terjadwal' },
      { title: 'Distribusi Multi Platform dan Community Management', outcome: 'Konten live di 3 platform, SOP community management' },
      { title: 'Produksi Aset Visual dan Video dengan Google AI', outcome: 'Minimal 10 aset siap tayang, template repurposing' },
      { title: 'Analytics Organik dan Kriteria Iterasi', outcome: 'Backlog eksperimen' },
      { title: 'Jalankan dan Optimasi Kampanye Organik', outcome: 'Performance report' },
      { title: 'CRM dan Customer Lifecycle Management dalam Digital Marketing', outcome: 'Peta customer lifecycle, alur CRM untuk brand yang dipakai' },
      { title: 'Fondasi Paid Ads Meta dan TikTok', outcome: 'Draft campaign siap nyala di Meta dan TikTok' },
      { title: 'Creative Testing dan Optimasi Multi Platform', outcome: 'Ads creative matrix, laporan hasil test' },
      { title: 'Melakukan Campaign End to End Organik dan Berbayar', outcome: 'Campaign live, full campaign report, scaling plan, portfolio case study' },
    ],
  },
  data: {
    label: 'Data Analyst',
    capstoneNote: 'Dataset yang diberikan bervariasi antar peserta.',
    capstoneList: ['Data cleaning', 'Analisis data', 'Dashboarding', 'Presentasi insight'],
    offlineMeetings: [1, 6, 12],
    meetings: [
      { title: 'Data Analyst 101 & Setup Tools', outcome: 'Tools ter-install dan siap pakai, catatan awal alur kerja DA' },
      { title: 'Intake dan Profiling Data', outcome: 'Profiling report hasil Antigravity, daftar temuan terverifikasi manual' },
      { title: 'Data Cleaning', outcome: 'Log revisi rulebook, cleaning script yang jalan, cleaning log, data bersih' },
      { title: 'Etika Data, PII, dan Batasan Kerja dengan Agent', outcome: 'Catatan audit PII, checklist etika data untuk sesi berikutnya' },
      { title: 'Membangun Pipeline Multi Sumber (bagian 1)', outcome: 'Draft pipeline dari 6 sumber data, data dictionary awal' },
      { title: 'Dokumentasi, Peer Review, dan Uji Reproducibility (bagian 2)', outcome: 'Pipeline reproducible, dataset analysis ready, data dictionary final' },
      { title: 'Analisis Kuantitatif dan Kriteria Temuan Sah', outcome: 'Analysis notebook berisi temuan yang lolos kriteria, catatan temuan gugur beserta alasannya' },
      { title: 'Analisis Teks dan Sentimen dengan Kriteria Terdefinisi', outcome: 'Dataset berlabel, coding scheme tertulis, laporan akurasi ringkas sebelum-sesudah revisi' },
      { title: 'Dashboard HTML Interaktif dengan Python', outcome: '1 file dashboard HTML interaktif' },
      { title: 'Bedah Kasus Bisnis Kuantitatif dan Teks', outcome: 'Insight memo 1 halaman dashboard HTML dari data kasus bisnis' },
      { title: 'Otomasi dan Reusability Kerja dengan Agent', outcome: 'Pipeline berparameter plus README, prompt library pribadi, catatan uji reproducibility lintas peserta dan periode data' },
      { title: 'Data Mentah ke Dashboard Interaktif', outcome: 'Dashboard HTML, insight memo' },
    ],
  },
};

export const REQUIREMENTS = [
  { title: 'Khusus perempuan', body: 'Program ini hanya dapat diikuti perempuan. Pendaftar laki-laki tidak diproses pada seleksi administratif.' },
  { title: 'Kelas Yogyakarta', body: 'Kelas Yogyakarta terbuka untuk umum maupun perempuan penyandang disabilitas, dengan pendampingan dan akomodasi bagi yang membutuhkan.' },
  { title: 'Usia dan domisili', body: '18–29 tahun, atau 18–35 tahun bagi penyandang disabilitas. Berdomisili di provinsi lokasi pelaksanaan.' },
  { title: 'Pendidikan', body: 'Minimal lulus SMA, SMK, atau sederajat.' },
  { title: 'Perangkat', body: 'Laptop dengan RAM minimal 8 GB dan koneksi internet stabil.' },
  { title: 'Komitmen waktu', body: 'Bootcamp satu bulan pada Senin, Rabu, dan Jumat. Sesi online 19.00–22.00, sesi offline 09.00–16.00. Dilanjutkan magang berbayar tiga bulan.' },
  { title: 'Kemampuan awal', body: 'Paham dasar bidang yang dipilih dan terbiasa memakai AI generatif seperti Gemini, ChatGPT, atau Claude.' },
  { title: 'Akomodasi', body: 'Penyelenggara menanggung transportasi lokal dan konsumsi sesi offline. Perjalanan dari daerah asal ke kota lokasi dan akomodasi ditanggung peserta.' },
  { title: 'Akomodasi disabilitas', body: 'Kebutuhan akomodasi dapat dicantumkan pada formulir, misalnya juru bahasa isyarat, materi format alternatif, atau aksesibilitas ruang kelas. Penyelenggara mengupayakan pemenuhannya.' },
];

/**
 * Pertanyaan seputar pendaftaran dan seleksi sengaja tidak disalin: pembaca
 * halaman ini sudah diterima, sehingga "apakah laki-laki boleh mendaftar"
 * hanya menambah derau.
 *
 * Registration and selection questions are deliberately left out: readers of
 * this page have already been accepted, so "can men apply" only adds noise.
 */
export const FAQ = [
  { question: 'Biaya transportasi diganti?', answer: 'Penyelenggara menanggung transportasi lokal. Perjalanan dari daerah asal ke kota lokasi dan akomodasi ditanggung peserta.' },
  { question: 'Apakah magang berbayar harus pindah kota?', answer: 'Tidak. Magang full remote, kamu bekerja dari tempat masing-masing.' },
  { question: 'Berapa kali datang ke lokasi?', answer: 'Semarang 6 kali termasuk showcase. Surabaya, Yogyakarta, dan Jakarta 4 kali. Sisanya online.' },
  { question: 'Mahasiswa aktif boleh ikut?', answer: 'Boleh, sepanjang sanggup hadir di seluruh pertemuan luring dan sesi daring sesuai jadwal.' },
  { question: 'Magang berbayar bisa dihentikan lebih awal?', answer: 'Bisa, apabila perusahaan mitra menilai performa peserta tidak memenuhi standar. Peserta kehilangan sisa upah dan tidak memperoleh penggantian tempat magang. Sampaikan kendala pada sesi mentoring sejak dini.' },
  { question: 'Apakah lulusan dijamin bekerja?', answer: 'Tidak. Program menyiapkan dan membuka akses, keputusan penerimaan tetap di perusahaan.' },
];

/**
 * Menebak paket kurikulum dari nama kelas peserta, misalnya
 * "Web Programming - Semarang". Mengembalikan null bila tidak dikenali,
 * sehingga halaman menampilkan seluruh jurusan alih-alih menebak keliru.
 *
 * Infers the curriculum package from a participant's class name, e.g.
 * "Web Programming - Semarang". Returns null when unrecognised, so the page
 * shows every major rather than guessing wrong.
 */
export function packageFromClassName(className: string | null | undefined): PackageKey | null {
  if (!className) return null;
  const lower = className.toLowerCase();
  if (lower.includes('web')) return 'web';
  if (lower.includes('data')) return 'data';
  if (lower.includes('social media') || lower.includes('marketing')) return 'smm';
  return null;
}
