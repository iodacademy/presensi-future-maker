// Rencana jadwal dan lokasi luring keempat kelas
// The schedule plan and offline venues for all four classes

export interface ScheduleRow {
  kota: string;
  jurusan: string;
  /** Format d/m/yyyy sesuai rencana program / d/m/yyyy as written in the programme plan */
  tanggal: string;
  hari: string;
  kegiatan: string;
  moda: 'Daring' | 'Luring';
  materi: string;
}

/**
 * Mengubah tanggal d/m/yyyy menjadi YYYY-MM-DD.
 *
 * Rencana program menulis tanggal sebagai 2/10/2026 yang berarti 2 Oktober.
 * Date.parse membacanya sebagai 10 Februari dalam tatanan Amerika, sehingga
 * penguraiannya dilakukan sendiri.
 *
 * Converts a d/m/yyyy date into YYYY-MM-DD.
 *
 * The programme plan writes dates as 2/10/2026 meaning 2 October. Date.parse
 * reads that as 10 February under US ordering, so the parsing is done by hand.
 */
export function toIsoDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/').map((v) => parseInt(v, 10));
  if (!d || !m || !y) throw new Error(`Tanggal tidak dapat diurai: ${ddmmyyyy}`);
  if (m < 1 || m > 12 || d < 1 || d > 31) throw new Error(`Tanggal di luar rentang: ${ddmmyyyy}`);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface Venue {
  name: string;
  address: string;
  mapsUrl: string;
}

/**
 * Tautan Maps memakai tautan pendek yang diberikan dan sudah diperiksa
 * penyelenggara. Tujuan tiap tautan ditelusuri dan dicatat pada komentar di
 * bawah, sebab bentuk pendek tidak memperlihatkan ke mana ia mengarah saat
 * kode ini dibaca kembali.
 *
 * Maps links use the short links the organisers supplied and checked. Each
 * link's destination was resolved and is recorded in the comments below, since
 * the short form does not reveal where it points when this code is read later.
 */

export const VENUES: Record<string, Venue> = {
  Semarang: {
    name: 'BBPVP Semarang',
    address:
      'Jalan Brigjen Sudiarto No. 118, Palebon, Kecamatan Pedurungan, Kota Semarang, Jawa Tengah 50246',
    // Menuju "Balai Besar Pelatihan Vokasi & Produktivitas Semarang"
    mapsUrl: 'https://maps.app.goo.gl/bnodtySTG5X5rEke8',
  },
  Surabaya: {
    name: 'Disnaker Provinsi Jawa Timur',
    address:
      'Jalan Dukuh Menanggal Selatan No. 124-126, Dukuh Menanggal, Kecamatan Gayungan, Surabaya, Jawa Timur 60234',
    // Menuju "Dinas Tenaga Kerja dan Transmigrasi Provinsi Jawa Timur"
    mapsUrl: 'https://maps.app.goo.gl/5FgJZ3UcCwhsXozT9',
  },
  Yogyakarta: {
    name: 'BPO Yogyakarta',
    address:
      'Ndalem Ngadiwinatan, Suryoputran KT II No. 23, Panembahan, Kecamatan Kraton, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55133',
    // Menuju "Youth And Sports Hall DIY (BPO DIY)" di Panembahan, Kraton --
    // nama yang tercatat di Maps berbeda dari nama bangunan cagar budayanya.
    //
    // Points at "Youth And Sports Hall DIY (BPO DIY)" in Panembahan, Kraton --
    // the name on Maps differs from the heritage building's name.
    mapsUrl: 'https://maps.app.goo.gl/UGh4ByRaJerZYLgFA',
  },
  'DKI Jakarta': {
    name: 'Poltek APP Jakarta',
    address:
      'Jalan Timbul No. 34, RT.6/RW.5, Cipedak, Kecamatan Jagakarsa, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12630',
    // Menuju "Politeknik APP Jakarta"
    mapsUrl: 'https://maps.app.goo.gl/MygQMTsj1HGztyyn7',
  },
};

export const SCHEDULE: ScheduleRow[] = [
  // Semarang - Web Programming
  { kota: 'Semarang', jurusan: 'Web Programming', tanggal: '25/9/2026', hari: 'Jumat', kegiatan: 'Onboarding dan Pertemuan 1', moda: 'Luring', materi: 'Setup & App 1: Landing Page' },
  { kota: 'Semarang', jurusan: 'Web Programming', tanggal: '30/9/2026', hari: 'Rabu', kegiatan: 'Pertemuan 2', moda: 'Daring', materi: 'Requirement, Business Logic & Data Model' },
  { kota: 'Semarang', jurusan: 'Web Programming', tanggal: '2/10/2026', hari: 'Jumat', kegiatan: 'Pertemuan 3', moda: 'Luring', materi: 'App 2 CRUD Satu Peran' },
  { kota: 'Semarang', jurusan: 'Web Programming', tanggal: '5/10/2026', hari: 'Senin', kegiatan: 'Pertemuan 4', moda: 'Daring', materi: 'Authentication & Authorization' },
  { kota: 'Semarang', jurusan: 'Web Programming', tanggal: '7/10/2026', hari: 'Rabu', kegiatan: 'Pertemuan 5', moda: 'Daring', materi: 'Routing, State & Desain' },
  { kota: 'Semarang', jurusan: 'Web Programming', tanggal: '9/10/2026', hari: 'Jumat', kegiatan: 'Pertemuan 6', moda: 'Luring', materi: 'App 3 Multi-Role + Auth & RBAC' },
  { kota: 'Semarang', jurusan: 'Web Programming', tanggal: '12/10/2026', hari: 'Senin', kegiatan: 'Pertemuan 7', moda: 'Daring', materi: 'API Design & Error Handling' },
  { kota: 'Semarang', jurusan: 'Web Programming', tanggal: '14/10/2026', hari: 'Rabu', kegiatan: 'Pertemuan 8', moda: 'Daring', materi: 'Security & Data Consistency' },
  { kota: 'Semarang', jurusan: 'Web Programming', tanggal: '16/10/2026', hari: 'Jumat', kegiatan: 'Pertemuan 9', moda: 'Luring', materi: 'App 4 Aplikasi Berstatus' },
  { kota: 'Semarang', jurusan: 'Web Programming', tanggal: '19/10/2026', hari: 'Senin', kegiatan: 'Pertemuan 10', moda: 'Daring', materi: 'App 5 Aplikasi Terhubung Payment Gateway' },
  { kota: 'Semarang', jurusan: 'Web Programming', tanggal: '21/10/2026', hari: 'Rabu', kegiatan: 'Pertemuan 11', moda: 'Daring', materi: 'Testing, Audit Trail & Deployment' },
  { kota: 'Semarang', jurusan: 'Web Programming', tanggal: '23/10/2026', hari: 'Jumat', kegiatan: 'Pertemuan 12', moda: 'Luring', materi: 'Capstone Build & Hardening' },
  { kota: 'Semarang', jurusan: 'Web Programming', tanggal: '30/10/2026', hari: 'Jumat', kegiatan: 'Showcase', moda: 'Luring', materi: 'Presentasi capstone project' },

  // Surabaya - Social Media Marketing
  { kota: 'Surabaya', jurusan: 'Social Media Marketing', tanggal: '25/9/2026', hari: 'Jumat', kegiatan: 'Onboarding', moda: 'Daring', materi: 'Pengenalan program, mentor, aturan main, rubrik penilaian, dan panduan LMS' },
  { kota: 'Surabaya', jurusan: 'Social Media Marketing', tanggal: '29/9/2026', hari: 'Selasa', kegiatan: 'Pertemuan 1', moda: 'Luring', materi: 'Fondasi Strategi dan Riset dengan AI' },
  { kota: 'Surabaya', jurusan: 'Social Media Marketing', tanggal: '1/10/2026', hari: 'Kamis', kegiatan: 'Pertemuan 2', moda: 'Daring', materi: 'Ekosistem Digital Marketing dan Brand Identity' },
  { kota: 'Surabaya', jurusan: 'Social Media Marketing', tanggal: '5/10/2026', hari: 'Senin', kegiatan: 'Pertemuan 3', moda: 'Daring', materi: 'Content Strategy dan Brand Voice Engine' },
  { kota: 'Surabaya', jurusan: 'Social Media Marketing', tanggal: '7/10/2026', hari: 'Rabu', kegiatan: 'Pertemuan 4', moda: 'Daring', materi: 'Pembuatan SOP dan Penjadwalan Konten' },
  { kota: 'Surabaya', jurusan: 'Social Media Marketing', tanggal: '9/10/2026', hari: 'Jumat', kegiatan: 'Pertemuan 5', moda: 'Daring', materi: 'Distribusi Multi Platform dan Community Management' },
  { kota: 'Surabaya', jurusan: 'Social Media Marketing', tanggal: '13/10/2026', hari: 'Selasa', kegiatan: 'Pertemuan 6', moda: 'Luring', materi: 'Produksi Aset Visual dan Video dengan Google AI' },
  { kota: 'Surabaya', jurusan: 'Social Media Marketing', tanggal: '15/10/2026', hari: 'Kamis', kegiatan: 'Pertemuan 7', moda: 'Daring', materi: 'Analytics Organik dan Kriteria Iterasi' },
  { kota: 'Surabaya', jurusan: 'Social Media Marketing', tanggal: '19/10/2026', hari: 'Senin', kegiatan: 'Pertemuan 8', moda: 'Daring', materi: 'Jalankan dan Optimasi Kampanye Organik' },
  { kota: 'Surabaya', jurusan: 'Social Media Marketing', tanggal: '21/10/2026', hari: 'Rabu', kegiatan: 'Pertemuan 9', moda: 'Daring', materi: 'CRM dan Customer Lifecycle Management dalam Digital Marketing' },
  { kota: 'Surabaya', jurusan: 'Social Media Marketing', tanggal: '26/10/2026', hari: 'Senin', kegiatan: 'Pertemuan 10', moda: 'Daring', materi: 'Fondasi Paid Ads Meta dan TikTok' },
  { kota: 'Surabaya', jurusan: 'Social Media Marketing', tanggal: '29/10/2026', hari: 'Kamis', kegiatan: 'Pertemuan 11', moda: 'Daring', materi: 'Creative Testing dan Optimasi Multi Platform' },
  { kota: 'Surabaya', jurusan: 'Social Media Marketing', tanggal: '3/11/2026', hari: 'Selasa', kegiatan: 'Pertemuan 12', moda: 'Luring', materi: 'Melakukan Campaign End to End Organik dan Berbayar' },
  { kota: 'Surabaya', jurusan: 'Social Media Marketing', tanggal: '10/11/2026', hari: 'Selasa', kegiatan: 'Showcase', moda: 'Luring', materi: 'Presentasi capstone project' },

  // Yogyakarta - Social Media Marketing
  { kota: 'Yogyakarta', jurusan: 'Social Media Marketing', tanggal: '25/9/2026', hari: 'Jumat', kegiatan: 'Onboarding', moda: 'Daring', materi: 'Pengenalan program, mentor, aturan main, rubrik penilaian, dan panduan LMS' },
  { kota: 'Yogyakarta', jurusan: 'Social Media Marketing', tanggal: '30/9/2026', hari: 'Rabu', kegiatan: 'Pertemuan 1', moda: 'Luring', materi: 'Fondasi Strategi dan Riset dengan AI' },
  { kota: 'Yogyakarta', jurusan: 'Social Media Marketing', tanggal: '2/10/2026', hari: 'Jumat', kegiatan: 'Pertemuan 2', moda: 'Daring', materi: 'Ekosistem Digital Marketing dan Brand Identity' },
  { kota: 'Yogyakarta', jurusan: 'Social Media Marketing', tanggal: '5/10/2026', hari: 'Senin', kegiatan: 'Pertemuan 3', moda: 'Daring', materi: 'Content Strategy dan Brand Voice Engine' },
  { kota: 'Yogyakarta', jurusan: 'Social Media Marketing', tanggal: '7/10/2026', hari: 'Rabu', kegiatan: 'Pertemuan 4', moda: 'Daring', materi: 'Pembuatan SOP dan Penjadwalan Konten' },
  { kota: 'Yogyakarta', jurusan: 'Social Media Marketing', tanggal: '9/10/2026', hari: 'Jumat', kegiatan: 'Pertemuan 5', moda: 'Daring', materi: 'Distribusi Multi Platform dan Community Management' },
  { kota: 'Yogyakarta', jurusan: 'Social Media Marketing', tanggal: '14/10/2026', hari: 'Rabu', kegiatan: 'Pertemuan 6', moda: 'Luring', materi: 'Produksi Aset Visual dan Video dengan Google AI' },
  { kota: 'Yogyakarta', jurusan: 'Social Media Marketing', tanggal: '16/10/2026', hari: 'Jumat', kegiatan: 'Pertemuan 7', moda: 'Daring', materi: 'Analytics Organik dan Kriteria Iterasi' },
  { kota: 'Yogyakarta', jurusan: 'Social Media Marketing', tanggal: '19/10/2026', hari: 'Senin', kegiatan: 'Pertemuan 8', moda: 'Daring', materi: 'Jalankan dan Optimasi Kampanye Organik' },
  { kota: 'Yogyakarta', jurusan: 'Social Media Marketing', tanggal: '21/10/2026', hari: 'Rabu', kegiatan: 'Pertemuan 9', moda: 'Daring', materi: 'CRM dan Customer Lifecycle Management dalam Digital Marketing' },
  { kota: 'Yogyakarta', jurusan: 'Social Media Marketing', tanggal: '23/10/2026', hari: 'Jumat', kegiatan: 'Pertemuan 10', moda: 'Daring', materi: 'Fondasi Paid Ads Meta dan TikTok' },
  { kota: 'Yogyakarta', jurusan: 'Social Media Marketing', tanggal: '26/10/2026', hari: 'Senin', kegiatan: 'Pertemuan 11', moda: 'Daring', materi: 'Creative Testing dan Optimasi Multi Platform' },
  { kota: 'Yogyakarta', jurusan: 'Social Media Marketing', tanggal: '28/10/2026', hari: 'Rabu', kegiatan: 'Pertemuan 12', moda: 'Luring', materi: 'Melakukan Campaign End to End Organik dan Berbayar' },
  { kota: 'Yogyakarta', jurusan: 'Social Media Marketing', tanggal: '4/11/2026', hari: 'Rabu', kegiatan: 'Showcase', moda: 'Luring', materi: 'Presentasi capstone project' },

  // DKI Jakarta - Data Analyst
  { kota: 'DKI Jakarta', jurusan: 'Data Analyst', tanggal: '25/9/2026', hari: 'Jumat', kegiatan: 'Onboarding', moda: 'Daring', materi: 'Pengenalan program, mentor, aturan main, rubrik penilaian, dan panduan LMS' },
  { kota: 'DKI Jakarta', jurusan: 'Data Analyst', tanggal: '1/10/2026', hari: 'Kamis', kegiatan: 'Pertemuan 1', moda: 'Luring', materi: 'Data Analyst 101 & Setup Tools' },
  { kota: 'DKI Jakarta', jurusan: 'Data Analyst', tanggal: '5/10/2026', hari: 'Senin', kegiatan: 'Pertemuan 2', moda: 'Daring', materi: 'Intake dan Profiling Data' },
  { kota: 'DKI Jakarta', jurusan: 'Data Analyst', tanggal: '7/10/2026', hari: 'Rabu', kegiatan: 'Pertemuan 3', moda: 'Daring', materi: 'Data Cleaning' },
  { kota: 'DKI Jakarta', jurusan: 'Data Analyst', tanggal: '9/10/2026', hari: 'Jumat', kegiatan: 'Pertemuan 4', moda: 'Daring', materi: 'Etika Data, PII, dan Batasan Kerja dengan Agent' },
  { kota: 'DKI Jakarta', jurusan: 'Data Analyst', tanggal: '12/10/2026', hari: 'Senin', kegiatan: 'Pertemuan 5', moda: 'Daring', materi: 'Membangun Pipeline Multi Sumber (bagian 1)' },
  { kota: 'DKI Jakarta', jurusan: 'Data Analyst', tanggal: '15/10/2026', hari: 'Kamis', kegiatan: 'Pertemuan 6', moda: 'Luring', materi: 'Dokumentasi, Peer Review, dan Uji Reproducibility (bagian 2)' },
  { kota: 'DKI Jakarta', jurusan: 'Data Analyst', tanggal: '19/10/2026', hari: 'Senin', kegiatan: 'Pertemuan 7', moda: 'Daring', materi: 'Analisis Kuantitatif dan Kriteria Temuan Sah' },
  { kota: 'DKI Jakarta', jurusan: 'Data Analyst', tanggal: '21/10/2026', hari: 'Rabu', kegiatan: 'Pertemuan 8', moda: 'Daring', materi: 'Analisis Teks dan Sentimen dengan Kriteria Terdefinisi' },
  { kota: 'DKI Jakarta', jurusan: 'Data Analyst', tanggal: '23/10/2026', hari: 'Jumat', kegiatan: 'Pertemuan 9', moda: 'Daring', materi: 'Dashboard HTML Interaktif dengan Python' },
  { kota: 'DKI Jakarta', jurusan: 'Data Analyst', tanggal: '29/10/2026', hari: 'Kamis', kegiatan: 'Pertemuan 10', moda: 'Daring', materi: 'Bedah Kasus Bisnis Kuantitatif dan Teks' },
  { kota: 'DKI Jakarta', jurusan: 'Data Analyst', tanggal: '2/11/2026', hari: 'Senin', kegiatan: 'Pertemuan 11', moda: 'Daring', materi: 'Otomasi dan Reusability Kerja dengan Agent' },
  { kota: 'DKI Jakarta', jurusan: 'Data Analyst', tanggal: '5/11/2026', hari: 'Kamis', kegiatan: 'Pertemuan 12', moda: 'Luring', materi: 'Data Mentah ke Dashboard Interaktif' },
  { kota: 'DKI Jakarta', jurusan: 'Data Analyst', tanggal: '12/11/2026', hari: 'Kamis', kegiatan: 'Showcase', moda: 'Luring', materi: 'Presentasi capstone project' },
];
