/**
 * Teks dan konstanta desain website pameran Bootcamp Future Innovators 2026
 * (jurusan, kelas, jenis karya, teks dokumentasi). Peserta, karya, dan foto
 * berasal dari Firestore lewat read.ts, bukan dari berkas ini.
 *
 * Design text and constants of the Bootcamp Future Innovators 2026 exhibition
 * website (tracks, classes, work types, documentation copy). People, works,
 * and photos come from Firestore through read.ts, not from this file.
 */

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
  ratio?: string;
  slots?: number;
  slotLabel?: string;
  socialW?: string;
}

export interface Cohort {
  key: string;
  track: TrackKey;
  city: string;
  color: string;
  fg: string;
  tint: string;
}

/**
 * Tautan video: YouTube (disarankan, unlisted), Google Drive, Vimeo, atau
 * berkas .mp4. String kosong menampilkan pesan "Video belum ditambahkan".
 *
 * Video links: YouTube (recommended, unlisted), Google Drive, Vimeo, or an
 * .mp4 file. An empty string shows the "Video belum ditambahkan" notice.
 */
export const VIDEOS = {
  afterMovie: '',
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
  'Aplikasi Web': { kind: 'shot', thumb: 'Screenshot aplikasi', tools: ['React', 'Node.js', 'PostgreSQL'], links: ['Lihat demo', 'Kode di GitHub'], },
  'Landing Page': { kind: 'shot', thumb: 'Screenshot landing page', tools: ['HTML', 'CSS', 'JavaScript'], links: ['Lihat demo', 'Kode di GitHub'], },
  'Data Cleaning': { kind: 'pdf', thumb: 'Dataset sebelum & sesudah', tools: ['Python', 'Pandas', 'Google Sheets'], links: ['Unduh laporan', 'Lihat notebook'], },
  'Dashboard': { kind: 'dash', thumb: 'Dashboard interaktif', tools: ['Python', 'HTML'], links: ['Buka dashboard', 'Unduh dataset'], },
  'Analisis Data': { kind: 'pdf', thumb: 'Laporan analisis', tools: ['Python', 'Tableau', 'Excel'], links: ['Unduh laporan', 'Lihat notebook'], },
  'Konten Feed': { kind: 'social', ratio: '4/5', slots: 6, slotLabel: 'Post', socialW: '720px', thumb: 'Konten feed Instagram', tools: ['Canva', 'Instagram', 'Meta Business Suite'], links: ['Lihat di Instagram'], },
  'Reels': { kind: 'social', ratio: '9/16', slots: 3, slotLabel: 'Video', socialW: '640px', thumb: 'Video Reels', tools: ['CapCut', 'TikTok', 'Instagram Reels'], links: ['Lihat di TikTok', 'Lihat di Instagram'], },
  'Capstone': { kind: 'pdf', thumb: 'Dokumen capstone', tools: ['React', 'Node.js', 'PostgreSQL'], links: ['Unduh dokumen', 'Kode di GitHub'], },
  'Brand Identity': { kind: 'pdf', thumb: 'Panduan identitas merek', tools: ['Canva', 'Figma'], links: ['Unduh panduan merek'], },
  'Laporan Campaign': { kind: 'pdf', thumb: 'Laporan performa', tools: ['Meta Ads', 'Google Sheets', 'Looker Studio'], links: ['Unduh laporan'], },
};

export const COHORTS: Cohort[] = [
  { key: 'web-smg', track: 'web', city: 'Semarang', color: '#0072CE', fg: '#FFFFFF', tint: '#E3EFF9' },
  { key: 'da-jkt', track: 'da', city: 'DKI Jakarta', color: '#8AC208', fg: '#243C4B', tint: '#EEF6DC' },
  { key: 'smm-yk', track: 'smm', city: 'Yogyakarta', color: '#DC0080', fg: '#FFFFFF', tint: '#FBE5F2' },
  { key: 'smm-sby', track: 'smm', city: 'Surabaya', color: '#ED632F', fg: '#FFFFFF', tint: '#FDE8DF' },
];
export const COH: Record<string, Cohort> = Object.fromEntries(COHORTS.map((c) => [c.key, c]));
export const cohLabel = (c: Cohort) => TRACKS[c.track].name + ' · ' + c.city;

export const DOC_WEEKS: [string, string][] = [
  ['Foto bersama', 'Peserta dan fasilitator dalam satu bingkai.'],
  ['Pemaparan materi', 'Fasilitator membuka sesi dengan materi baru.'],
  ['Pendampingan', 'Trainer mendampingi peserta saat praktik.'],
  ['Diskusi kelompok', 'Peserta bertukar ide dalam tim kecil.'],
  ['Praktik langsung', 'Materi langsung dicoba di laptop masing-masing.'],
  ['Mengerjakan proyek', 'Peserta membangun karyanya sendiri.'],
  ['Belajar dibimbing', 'Pertanyaan dijawab langsung di meja peserta.'],
  ['Presentasi', 'Peserta menyampaikan hasil kerjanya di depan kelas.'],
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
export const TESTI_T: { track: TrackKey; cohort?: string; role?: string; name: string; quote: string; video?: string }[] = [
  { track: 'web', cohort: 'web-smg', role: 'Fasilitator', name: 'Rifka Aisyah Rokhmah', quote: 'Pengalaman menjadi fasilitator Future Makers sangat berkesan. Melihat antusiasme peserta, terutama saat berkolaborasi dan menyelesaikan proyek dalam waktu singkat, menjadi pengalaman yang seru dan luar biasa. Untuk teman-teman Future Makers, teruslah mencoba, tetap semangat, dan percaya bahwa masa depan yang cerah menanti kalian!' },
  { track: 'web', cohort: 'web-smg', role: 'Trainer', name: 'Wahyu Candra Tama', quote: 'Mengajar selama 12 sesi Future Makers menjadi pengalaman yang sangat berkesan. Antusiasme peserta yang tinggi memberikan kesempatan bagi saya untuk berbagi pengalaman industri dan membekali mereka dengan keterampilan dasar sebelum memasuki dunia kerja. Saya berharap seluruh peserta tetap optimis, percaya diri, dan memiliki semangat untuk terus belajar serta mengembangkan keterampilan agar siap menghadapi perkembangan teknologi dan tantangan dunia profesional.' },
];
export const TESTI_PLAN = { name: 'Nama Perwakilan', role: 'Yayasan Plan International Indonesia', quote: 'Bootcamp Future Innovators adalah bagian dari komitmen kami membuka kesempatan kerja yang setara bagi kaum muda. Karya di pameran ini menunjukkan apa yang mereka capai saat diberi ruang.' };
