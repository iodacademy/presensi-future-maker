/**
 * Isi website pameran Bootcamp Future Innovators 2026.
 *
 * Disalin apa adanya dari desain (docs/Website Pameran Future Makers 2026),
 * termasuk peserta dan karya contoh yang dibangkitkan dari benih tetap. Bila
 * data asli dari Firestore sudah siap, cukup berkas ini yang diganti; halaman
 * hanya membaca bentuk datanya.
 *
 * Content of the Bootcamp Future Innovators 2026 exhibition website.
 *
 * Copied as-is from the design (docs/Website Pameran Future Makers 2026),
 * including the sample people and works generated from a fixed seed. Once real
 * Firestore data is ready, only this file needs replacing; the pages read
 * nothing but its shape.
 */
import photos from './photos.json';

export type TrackKey = 'web' | 'da' | 'smm';

export interface Track {
  key: TrackKey;
  name: string;
  short: string;
  color: string;
  fg: string;
  tint: string;
  tagline: string;
  desc: string;
  types: string[];
  outputs: string[];
}

export interface WorkType {
  kind: 'shot' | 'pdf' | 'dash' | 'social';
  thumb: string;
  tools: string[];
  links: string[];
  titles: string[];
  ratio?: string;
  slots?: number;
  slotLabel?: string;
  socialW?: string;
}

export interface Cohort {
  key: string;
  track: TrackKey;
  city: string;
  n: number;
  color: string;
  fg: string;
  tint: string;
}

export interface Person {
  id: string;
  track: TrackKey;
  name: string;
  initials: string;
  city: string;
  cohort: string;
  works: string[];
}

export interface Work {
  id: string;
  track: TrackKey;
  cohort: string;
  type: string;
  person: string;
  title: string;
  pdfPages: number;
}

/**
 * Alamat foto per slot, hasil `npm run upload-pameran-photos`.
 *
 * Slot yang belum punya foto menampilkan placeholder, sama seperti desainnya.
 *
 * Photo address per slot, produced by `npm run upload-pameran-photos`.
 *
 * Slots without a photo show a placeholder, the same as the design.
 */
export const PHOTOS: Record<string, string> = photos;

/**
 * Tautan video: YouTube (disarankan, unlisted), Google Drive, Vimeo, atau
 * berkas .mp4. String kosong menampilkan pesan "Video belum ditambahkan".
 *
 * Video links: YouTube (recommended, unlisted), Google Drive, Vimeo, or an
 * .mp4 file. An empty string shows the "Video belum ditambahkan" notice.
 */
export const VIDEOS = {
  afterMovie: '',
  peserta: { 'web-smg': '', 'da-jkt': '', 'smm-yk': '', 'smm-sby': '' } as Record<string, string>,
  trainer: { web: '', da: '', smm: '' } as Record<TrackKey, string>,
  plan: '',
};

export const SLIDE_INTERVAL_SECONDS = 5;
export const PAGE_SIZE = 24;

export const TRACKS: Record<TrackKey, Track> = {
  web: { key: 'web', name: 'Web Programming', short: 'Web Programming', color: '#0072CE', fg: '#FFFFFF', tint: '#E3EFF9',
    tagline: 'Aplikasi yang dibangun dari rancangan sampai siap dipakai.',
    desc: 'Peserta membangun aplikasi web dari rancangan antarmuka sampai siap dipakai pengguna.',
    types: ['Landing Page', 'Aplikasi Web', 'Capstone'],
    outputs: ['Aplikasi web dengan demo yang bisa dicoba', 'Repositori kode di GitHub', 'Dokumentasi fitur dan API'] },
  da: { key: 'da', name: 'Data Analyst', short: 'Data Analyst', color: '#8AC208', fg: '#243C4B', tint: '#EEF6DC',
    tagline: 'Dari data mentah ke dashboard yang menjawab pertanyaan.',
    desc: 'Peserta mengolah data mentah menjadi dataset bersih, analisis, dan dashboard.',
    types: ['Dashboard', 'Data Cleaning', 'Analisis Data'],
    outputs: ['Dataset hasil data cleaning', 'Dashboard interaktif (Looker Studio / Tableau)', 'Laporan analisis dan rekomendasi'] },
  smm: { key: 'smm', name: 'Social Media Marketing', short: 'SMM', color: '#DC0080', fg: '#FFFFFF', tint: '#FBE5F2',
    tagline: 'Konten, campaign, dan laporan performanya.',
    desc: 'Peserta merancang konten, menjalankan campaign, dan melaporkan performanya.',
    types: ['Konten Feed', 'Reels', 'Brand Identity', 'Laporan Campaign'],
    outputs: ['Konten feed dan Reels', 'Identitas merek', 'Laporan performa campaign'] },
};

export const TYPE: Record<string, WorkType> = {
  'Aplikasi Web': { kind: 'shot', thumb: 'Screenshot aplikasi', tools: ['React', 'Node.js', 'PostgreSQL'], links: ['Lihat demo', 'Kode di GitHub'],
    titles: ['Sistem Antrean Puskesmas', 'Aplikasi Bank Sampah Warga', 'Platform Les Privat Mahasiswa', 'Pencatat Keuangan UMKM', 'Marketplace Kerajinan Lokal', 'Aplikasi Lapor Jalan Rusak', 'Pendaftaran Posyandu Online', 'Sistem Peminjaman Buku Desa'] },
  'Landing Page': { kind: 'shot', thumb: 'Screenshot landing page', tools: ['HTML', 'CSS', 'JavaScript'], links: ['Lihat demo', 'Kode di GitHub'],
    titles: ['Landing Page Kedai Kopi', 'Profil Komunitas Literasi', 'Halaman Donasi Bencana', 'Portofolio Fotografer', 'Landing Page Wisata Desa', 'Profil Karang Taruna'] },
  'Data Cleaning': { kind: 'pdf', thumb: 'Dataset sebelum & sesudah', tools: ['Python', 'Pandas', 'Google Sheets'], links: ['Unduh laporan', 'Lihat notebook'],
    titles: ['Pembersihan Data Penjualan Ritel', 'Data Survei Kepuasan Pelanggan', 'Data Transaksi E-commerce', 'Data Peserta Pelatihan Kerja', 'Data Harga Pangan Pasar'] },
  'Dashboard': { kind: 'dash', thumb: 'Dashboard interaktif', tools: ['Python', 'HTML'], links: ['Buka dashboard', 'Unduh dataset'],
    titles: ['Dashboard Penjualan Kopi Nusantara', 'Dashboard Kualitas Udara Kota', 'Dashboard Kinerja Toko Online', 'Dashboard Lowongan Kerja Muda', 'Dashboard Kunjungan Wisata', 'Dashboard Pengeluaran Rumah Tangga'] },
  'Analisis Data': { kind: 'pdf', thumb: 'Laporan analisis', tools: ['Python', 'Tableau', 'Excel'], links: ['Unduh laporan', 'Lihat notebook'],
    titles: ['Analisis Churn Pelanggan Telko', 'Pola Belanja Akhir Pekan', 'Analisis Ulasan Aplikasi Ojol', 'Faktor Keterlambatan Pengiriman'] },
  'Konten Feed': { kind: 'social', ratio: '4/5', slots: 6, slotLabel: 'Post', socialW: '720px', thumb: 'Konten feed Instagram', tools: ['Canva', 'Instagram', 'Meta Business Suite'], links: ['Lihat di Instagram'],
    titles: ['Seri Edukasi Kesehatan Mental', 'Konten Promo Produk Lokal', 'Kampanye Hemat Air', 'Seri Tips Wawancara Kerja', 'Konten Hari Anak Nasional'] },
  'Reels': { kind: 'social', ratio: '9/16', slots: 3, slotLabel: 'Video', socialW: '640px', thumb: 'Video Reels', tools: ['CapCut', 'TikTok', 'Instagram Reels'], links: ['Lihat di TikTok', 'Lihat di Instagram'],
    titles: ['Reels Sehari Jadi Barista', 'TikTok Mitos vs Fakta Gizi', 'Reels Behind the Scene UMKM', 'Seri Video Literasi Keuangan'] },
  'Capstone': { kind: 'pdf', thumb: 'Dokumen capstone', tools: ['React', 'Node.js', 'PostgreSQL'], links: ['Unduh dokumen', 'Kode di GitHub'],
    titles: ['Capstone Sistem Antrean Klinik', 'Capstone Platform Donasi Warga', 'Capstone Aplikasi Kasir UMKM'] },
  'Brand Identity': { kind: 'pdf', thumb: 'Panduan identitas merek', tools: ['Canva', 'Figma'], links: ['Unduh panduan merek'],
    titles: ['Identitas Merek Kedai Kopi Lokal', 'Panduan Merek Toko Kue Rumahan', 'Identitas Merek Brand Fesyen Daur Ulang'] },
  'Laporan Campaign': { kind: 'pdf', thumb: 'Laporan performa', tools: ['Meta Ads', 'Google Sheets', 'Looker Studio'], links: ['Unduh laporan'],
    titles: ['Laporan Campaign Ramadan Toko Kue', 'Performa Campaign Open Donasi', 'Laporan Iklan Kelas Bahasa', 'Evaluasi Campaign Brand Fesyen'] },
};

const FIRST = ['Aulia','Bima','Citra','Dimas','Eka','Fajar','Gita','Hana','Ilham','Intan','Joko','Kirana','Laras','Mega','Nanda','Oki','Putri','Rafi','Rani','Sari','Tegar','Utari','Vina','Wulan','Yoga','Zahra','Ayu','Bayu','Dewi','Farhan','Galih','Hesti','Indra','Nabila','Rizky','Salsa','Tiara','Wahyu','Yusuf','Anisa'];

export const BIO: Record<TrackKey, string> = {
  web: 'Tertarik membangun aplikasi yang membantu kegiatan warga sehari-hari. Selama bootcamp fokus pada front-end dan integrasi API.',
  da: 'Suka menemukan pola dari data dan menyampaikannya lewat visual yang mudah dipahami. Selama bootcamp fokus pada SQL dan dashboard.',
  smm: 'Senang membuat konten yang dekat dengan audiens muda. Selama bootcamp fokus pada perencanaan konten dan analisis performa.',
};

export const COHORTS: Cohort[] = [
  { key: 'web-smg', track: 'web', city: 'Semarang', n: 44, color: '#0072CE', fg: '#FFFFFF', tint: '#E3EFF9' },
  { key: 'da-jkt', track: 'da', city: 'DKI Jakarta', n: 42, color: '#8AC208', fg: '#243C4B', tint: '#EEF6DC' },
  { key: 'smm-yk', track: 'smm', city: 'Yogyakarta', n: 20, color: '#DC0080', fg: '#FFFFFF', tint: '#FBE5F2' },
  { key: 'smm-sby', track: 'smm', city: 'Surabaya', n: 20, color: '#ED632F', fg: '#FFFFFF', tint: '#FDE8DF' },
];
export const COH: Record<string, Cohort> = Object.fromEntries(COHORTS.map((c) => [c.key, c]));
export const cohLabel = (c: Cohort) => TRACKS[c.track].name + ' · ' + c.city;

export const DOC_WEEKS: [string, string][] = [
  ['Kick-off dan perkenalan', 'Peserta bertemu trainer dan teman sekelas untuk pertama kali.'],
  ['Materi dasar', 'Fondasi keterampilan sesuai jurusan masing-masing.'],
  ['Praktik terpandu', 'Latihan langsung dengan pendampingan trainer.'],
  ['Kerja kelompok', 'Peserta berlatih berkolaborasi dalam tim kecil.'],
  ['Sesi bersama praktisi', 'Berbagi pengalaman dari dunia kerja.'],
  ['Mengerjakan proyek akhir', 'Setiap peserta mulai membangun karyanya sendiri.'],
  ['Mentoring dan review', 'Karya dikaji bersama trainer sebelum dipresentasikan.'],
  ['Presentasi dan kelulusan', 'Peserta mempresentasikan karya dan merayakan kelulusan.'],
];
export const DOC_HERO = ['Hari pertama', 'Fokus belajar', 'Diskusi tim', 'Presentasi', 'Foto bersama'];
export const DOC_BENTO: { c: number; r: number; cap?: string; word?: string; bg?: string; fg?: string }[] = [
  { c: 3, r: 2, cap: 'Kick-off' }, { c: 1, r: 1, word: 'Belajar.', bg: '#DC0080', fg: '#fff' }, { c: 2, r: 2, cap: 'Sesi kelas' },
  { c: 1, r: 1, cap: 'Diskusi' }, { c: 2, r: 1, cap: 'Kerja kelompok' }, { c: 1, r: 1, word: 'Berkarya.', bg: '#FFD500', fg: '#243C4B' },
  { c: 2, r: 2, cap: 'Mentoring' }, { c: 1, r: 2, cap: 'Di balik layar' }, { c: 1, r: 1, word: 'Presentasi.', bg: '#8AC208', fg: '#243C4B' },
  { c: 2, r: 1, cap: 'Presentasi akhir' }, { c: 1, r: 1, cap: 'Sertifikat' }, { c: 1, r: 1, word: 'Lulus!', bg: '#0072CE', fg: '#fff' },
];
export const DOC_MASONRY = ['Diskusi kelompok', 'Sesi tanya jawab', 'Istirahat bareng', 'Coding bersama', 'Membaca data', 'Syuting konten', 'Presentasi ide', 'Review karya', 'Ice breaking', 'Mentoring satu lawan satu', 'Foto bersama', 'Penyerahan sertifikat'];
export const DOC_RATIOS = ['4/5', '1/1', '3/4', '4/3', '2/3', '5/4'];
export const DOC_POLAROID = ['Hari pertama!', 'Tim paling kompak', 'Lembur demi deadline', 'Akhirnya jalan juga', 'Konten pertama tayang', 'Kami lulus!'];
export const DOC_DESC: Record<TrackKey, string> = { web: 'Dari menulis baris kode pertama sampai aplikasi yang bisa dicoba pengguna.', da: 'Dari spreadsheet berantakan sampai dashboard yang menjawab pertanyaan.', smm: 'Dari ide konten sampai campaign yang tayang dan dilaporkan.' };
export const SLIDES = [
  { caption: 'Pembukaan bootcamp', place: 'Semarang', color: '#0072CE', fg: '#FFFFFF' },
  { caption: 'Sesi kelas Data Analyst', place: 'DKI Jakarta', color: '#8AC208', fg: '#243C4B' },
  { caption: 'Praktik produksi konten', place: 'Yogyakarta', color: '#DC0080', fg: '#FFFFFF' },
  { caption: 'Presentasi campaign', place: 'Surabaya', color: '#ED632F', fg: '#FFFFFF' },
  { caption: 'Demo day', place: 'Semua kota', color: '#FFD500', fg: '#243C4B' },
];
export const BENTO: { type: 'photo' | 'stat'; cols: number; rows: number; label: string; key?: 'people' | 'works'; value?: string; bg?: string; fg?: string }[] = [
  { type: 'photo', cols: 2, rows: 2, label: 'Foto sesi kelas' },
  { type: 'stat', cols: 1, rows: 1, key: 'people', label: 'peserta', bg: '#0072CE', fg: '#FFFFFF' },
  { type: 'photo', cols: 1, rows: 1, label: 'Foto mentoring' },
  { type: 'photo', cols: 1, rows: 2, label: 'Foto peserta berkarya' },
  { type: 'stat', cols: 1, rows: 1, value: '4', label: 'kota', bg: '#DC0080', fg: '#FFFFFF' },
  { type: 'photo', cols: 2, rows: 1, label: 'Foto presentasi' },
  { type: 'stat', cols: 1, rows: 1, value: '3', label: 'jurusan', bg: '#8AC208', fg: '#243C4B' },
  { type: 'photo', cols: 1, rows: 1, label: 'Foto kebersamaan' },
  { type: 'photo', cols: 2, rows: 1, label: 'Foto demo day' },
  { type: 'stat', cols: 1, rows: 1, key: 'works', label: 'karya', bg: '#FFD500', fg: '#243C4B' },
];
export const TESTI_P: Record<string, string> = {
  'web-smg': 'Dulu aku cuma bisa ikut tutorial. Sekarang aku punya aplikasi sendiri yang bisa dipakai orang lain.',
  'da-jkt': 'Aku belajar bahwa data berantakan itu biasa. Yang penting tahu cara merapikannya dan pertanyaan apa yang mau dijawab.',
  'smm-yk': 'Bikin kalender konten sebulan penuh bikin aku sadar konten yang bagus itu direncanakan, bukan kebetulan.',
  'smm-sby': 'Awalnya angka di laporan iklan bikin bingung. Di akhir bootcamp aku bisa membaca dan menjelaskannya sendiri.',
};
export const TESTI_T: { track: TrackKey; name: string; quote: string }[] = [
  { track: 'web', name: 'Nama Trainer', quote: 'Latar belakang peserta beragam, tapi semuanya menyelesaikan proyek yang bisa didemokan.' },
  { track: 'da', name: 'Nama Trainer', quote: 'Mereka terbiasa bertanya “datanya bilang apa?” sebelum membuat grafik. Itu kebiasaan analis yang baik.' },
  { track: 'smm', name: 'Nama Trainer', quote: 'Banyak campaign peserta yang dijalankan untuk usaha nyata di sekitar mereka.' },
];
export const TESTI_PLAN = { name: 'Nama Perwakilan', role: 'Yayasan Plan International Indonesia', quote: 'Bootcamp Future Innovators adalah bagian dari komitmen kami membuka kesempatan kerja yang setara bagi kaum muda. Karya di pameran ini menunjukkan apa yang mereka capai saat diberi ruang.' };
export const SKILLS: Record<TrackKey, string[]> = { web: ['HTML & CSS','JavaScript','React','Git','REST API'], da: ['Excel','SQL','Python','Looker Studio','Data cleaning'], smm: ['Copywriting','Canva','Perencanaan konten','Meta Ads','Analisis performa'] };

function rng(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

/**
 * Array.sort milik Chrome (151) untuk array pendek: binary insertion sort,
 * ditulis ulang apa adanya.
 *
 * Desain mengacak urutan jenis karya dengan sort(() => r() - 0.5). Hasil sort
 * dengan pembanding acak bergantung pada urutan pemanggilan pembanding, yang
 * berbeda antara Chrome, V8 di Node 24, Safari, dan Firefox. Akibatnya data
 * contoh di server berbeda dari peramban dan hydration gagal. Menulis ulang
 * algoritmanya membuat semua tempat menghasilkan data yang sama dengan desain
 * saat dibuka di Chrome.
 *
 * Chrome's (151) Array.sort for short arrays: binary insertion sort, rewritten
 * as-is.
 *
 * The design shuffles work types with sort(() => r() - 0.5). With a random
 * comparator the result depends on the order the comparator is called, which
 * differs between Chrome, V8 in Node 24, Safari, and Firefox, so the sample
 * data on the server differed from the browser and hydration failed. Rewriting
 * the algorithm makes every runtime produce the data the design shows in
 * Chrome.
 */
function chromeSort<T>(input: T[], cmp: (a: T, b: T) => number): T[] {
  const a = input.slice(), n = a.length;
  for (let start = 1; start < n; start++) {
    const pivot = a[start];
    let left = 0, right = start;
    while (left < right) {
      const mid = left + ((right - left) >> 1);
      if (cmp(pivot, a[mid]) < 0) right = mid; else left = mid + 1;
    }
    a.splice(start, 1);
    a.splice(left, 0, pivot);
  }
  return a;
}

function build() {
  const r = rng(2026), people: Person[] = [], works: Work[] = [];
  let pid = 0, wid = 0;
  COHORTS.forEach((c) => {
    const tk = c.track;
    for (let i = 0; i < c.n; i++) {
      const first = FIRST[Math.floor(r() * FIRST.length)];
      // Desain mengundi inisial nama belakang di sini. Undiannya tetap dijalankan agar
      // karya contoh tidak bergeser, tetapi hasilnya dibuang: demi privasi, yang tampil
      // hanya nama panggilan.
      //
      // The design draws a surname initial here. The draw still runs so the sample
      // works do not shift, but its result is discarded: for privacy, only the
      // nickname is shown.
      r();
      const p: Person = { id: 'p' + (pid++), track: tk, name: first, initials: first[0], city: c.city, cohort: c.key, works: [] };
      const n = r() < 0.45 ? 2 : 1;
      chromeSort(TRACKS[tk].types, () => r() - 0.5).slice(0, n).forEach((ty) => {
        const T = TYPE[ty];
        const w: Work = { id: 'w' + (wid++), track: tk, cohort: c.key, type: ty, person: p.id, title: T.titles[Math.floor(r() * T.titles.length)], pdfPages: 6 + Math.floor(r() * 18) };
        works.push(w); p.works.push(w.id);
      });
      people.push(p);
    }
  });
  return { people, works, P: Object.fromEntries(people.map((p) => [p.id, p])) as Record<string, Person>, W: Object.fromEntries(works.map((w) => [w.id, w])) as Record<string, Work> };
}
export const DATA = build();

export function descFor(w: Work): string {
  const k = TYPE[w.type].kind;
  if (w.type === 'Data Cleaning') return 'Dataset mentah dirapikan dari duplikasi, nilai kosong, dan format yang tidak konsisten. Laporan berisi langkah pembersihan, perbandingan sebelum dan sesudah, serta dataset final.';
  if (w.type === 'Dashboard') return 'Dashboard interaktif yang merangkum indikator utama dan bisa difilter per periode serta kategori. Data diolah dengan SQL sebelum divisualisasikan.';
  if (w.type === 'Analisis Data') return 'Analisis eksploratif untuk menjawab pertanyaan bisnis, lengkap dengan temuan utama dan rekomendasi tindak lanjut.';
  if (w.type === 'Laporan Campaign') return 'Laporan performa campaign selama empat minggu: jangkauan, engagement, klik, dan biaya per hasil, beserta evaluasi dan rekomendasi.';
  if (w.type === 'Kalender Konten') return 'Rencana konten satu bulan berisi pilar konten, format, jadwal unggah, dan caption untuk setiap posting.';
  if (k === 'social') return 'Rangkaian konten yang dirancang untuk audiens muda, dari riset ide, naskah, desain visual, sampai caption dan jadwal unggah.';
  if (w.type === 'REST API') return 'Layanan backend dengan endpoint yang terdokumentasi, autentikasi pengguna, dan pengujian dasar.';
  return 'Aplikasi web yang dirancang untuk menyelesaikan masalah nyata pengguna, mulai dari riset kebutuhan, desain antarmuka, sampai deployment.';
}

/** Data kartu karya yang dipakai galeri, profil, dan beranda / Work card data shared by gallery, profile, and home */
export function card(w: Work) {
  const t = TRACKS[w.track], p = DATA.P[w.person], c = COH[w.cohort];
  return { id: w.id, title: w.title, type: w.type, trackShort: t.short, trackName: t.name, color: t.color, tint: t.tint, city: p.city,
    cColor: c.color, cFg: c.fg, cTint: c.tint, cLabel: cohLabel(c), initials: p.initials, thumbLabel: TYPE[w.type].thumb, personName: p.name, href: '/karya/' + w.id };
}

export function personCard(p: Person) {
  const c = COH[p.cohort];
  return { ...p, trackShort: TRACKS[p.track].short, tint: TRACKS[p.track].tint, workCount: p.works.length, workLabel: p.works.length + ' karya',
    cColor: c.color, cFg: c.fg, cTint: c.tint, cLabel: cohLabel(c), href: '/peserta/' + p.id };
}
