import type { RankedStudent } from '@/features/dashboard/snapshot-types';

/**
 * Email pengumuman hasil bootcamp: status per peserta, template, dan isiannya.
 * Modul ini murni, jadi dipakai bersama oleh server dan pratinjau di peramban.
 *
 * Bootcamp result announcement email: per-participant status, templates, and
 * their placeholders. This module is pure, so the server and the browser
 * preview share it.
 */

export type EmailCategory = 'lulus-magang' | 'lulus-tanpa-magang' | 'tidak-lulus' | 'umum';

export const CATEGORY_LABELS: Record<EmailCategory, string> = {
  'lulus-magang': 'Lulus dan berhak magang',
  'lulus-tanpa-magang': 'Lulus, tidak berhak magang',
  'tidak-lulus': 'Tidak lulus',
  umum: 'Umum',
};

/** SPA minimal untuk lulus, sama dengan rubrik di Google Sheet tracking / Minimum SPA to pass, matching the tracking sheet rubric */
export const PASS_SPA = 60;

export const SCHEME_NAMES: Record<string, string> = { full: 'Full Internship', project: 'Project Based' };

// Kontak PIC per kota kelas, sama dengan slide sosialisasi magang / PIC contact per class city, as in the internship briefing slides
export const PIC_KOTA: Record<string, string> = {
  Semarang: 'Rama (0881037638372)',
  Surabaya: 'Cholis (081281731250)',
  Yogyakarta: 'Zulfa (085244775901)',
  'DKI Jakarta': 'Ghea (081383157825)',
};

export interface EmailTemplate {
  id: string;
  name: string;
  category: EmailCategory;
  subject: string;
  body: string;
  updatedAt: string;
}

export type EmailRow = Pick<RankedStudent, 'studentId' | 'studentName' | 'className' | 'city' | 'score' | 'placement' | 'placementReasons'>;

/**
 * Status email peserta. Lulus ditentukan SPA saja; skema magang ditentukan
 * aturan penempatan, jadi peserta lulus bisa tetap tidak ditempatkan.
 *
 * A participant's email status. Passing depends on SPA alone; the internship
 * scheme follows the placement rules, so a passing participant may still not
 * be placed.
 */
export function emailStatus(r: EmailRow): { category: EmailCategory | null; label: string } {
  if (r.placement === 'pending') return { category: null, label: 'Menunggu nilai capstone' };
  if (r.score < PASS_SPA) return { category: 'tidak-lulus', label: 'Tidak lulus' };
  if (r.placement === 'full' || r.placement === 'project') return { category: 'lulus-magang', label: `Lulus · ${SCHEME_NAMES[r.placement]}` };
  return { category: 'lulus-tanpa-magang', label: 'Lulus · tidak ditempatkan' };
}

// Huruf pertama dikecilkan kecuali singkatan seperti SPA / The first letter is lowered unless it is an acronym such as SPA
const kalimat = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

export const PLACEHOLDERS: [string, string][] = [
  ['nama', 'Nama lengkap peserta'], ['jurusan', 'Jurusan'], ['kota', 'Kota kelas'], ['spa', 'Nilai akhir (SPA)'],
  ['skema', 'Full Internship atau Project Based'], ['alasan', 'Syarat skema yang tidak terpenuhi'], ['kontak_pic', 'Nama dan nomor PIC kota'],
];

export function templateVars(r: EmailRow): Record<string, string> {
  return {
    nama: r.studentName,
    jurusan: r.className.split(' - ')[0],
    kota: r.city,
    spa: String(r.score),
    skema: SCHEME_NAMES[r.placement] ?? '-',
    alasan: (r.placementReasons ?? []).map(kalimat).join('; ') || '-',
    kontak_pic: PIC_KOTA[r.city] ?? 'PIC kota kelasmu',
  };
}

/** Isian yang tidak dikenal dibiarkan apa adanya agar salah ketik terlihat di pratinjau / Unknown placeholders are left as is so typos show in the preview */
export const renderTemplate = (text: string, vars: Record<string, string>): string =>
  text.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));

export function toHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`).replace(/\n/g, '<br>');
}

export function validateTemplateInput(raw: unknown): Pick<EmailTemplate, 'name' | 'category' | 'subject' | 'body'> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const name = s(r.name);
  const subject = s(r.subject);
  const body = typeof r.body === 'string' ? r.body.replace(/\s+$/, '') : '';
  if (!name) throw new Error('Nama template wajib diisi');
  if (!(String(r.category) in CATEGORY_LABELS)) throw new Error('Kategori template tidak dikenal');
  if (!subject) throw new Error('Subjek email wajib diisi');
  if (!body) throw new Error('Isi email wajib diisi');
  if (subject.length > 200) throw new Error('Subjek email maksimal 200 karakter');
  if (body.length > 10_000) throw new Error('Isi email maksimal 10.000 karakter');
  return { name, category: r.category as EmailCategory, subject, body };
}

/**
 * Penerima yang sudah menerima template yang sama dilewati, kecuali admin
 * sengaja mengirim ulang; satu klik ganda tidak boleh membuat peserta
 * menerima pengumuman dua kali.
 *
 * Recipients who already received the same template are skipped unless the
 * admin deliberately resends; a double click must not send a participant the
 * announcement twice.
 */
export function planSend(ids: string[], sent: Set<string>, resend: boolean): { send: string[]; skipped: string[] } {
  const unik = [...new Set(ids)];
  if (resend) return { send: unik, skipped: [] };
  return { send: unik.filter((id) => !sent.has(id)), skipped: unik.filter((id) => sent.has(id)) };
}

const PORTAL = 'https://innovators.iodacademy.id/app/karier';
const SALAM = '\n\nSalam,\nTim Future Innovators Bootcamp';

// Template awal; admin menyuntingnya di halaman Email / Starter templates; admins edit them on the Email page
export const DEFAULT_TEMPLATES: Omit<EmailTemplate, 'updatedAt'>[] = [
  {
    id: 'lulus-magang',
    name: 'Lulus dan berhak magang',
    category: 'lulus-magang',
    subject: 'Selamat, kamu lulus Future Innovators Bootcamp dan berhak ikut magang',
    body: `Halo {nama},

Selamat! Kamu dinyatakan LULUS Future Innovators Bootcamp kelas {jurusan} {kota} dengan nilai akhir (SPA) {spa}.

Berdasarkan hasil penilaian, kamu berhak mengikuti program magang dengan skema {skema}.

Langkah berikutnya:
1. Masuk ke LMS lalu buka menu Portal Karier: ${PORTAL}
2. Pilih lowongan yang sesuai dan kirim lamaranmu paling lambat Kamis, 12 November 2026 pukul 23.59 WIB.
3. Pantau status lamaran dan jadwal interview di Portal Karier.

Pertanyaan seputar magang dapat disampaikan ke PIC kelasmu: {kontak_pic}.${SALAM}`,
  },
  {
    id: 'lulus-tanpa-magang',
    name: 'Lulus, tidak berhak magang',
    category: 'lulus-tanpa-magang',
    subject: 'Hasil akhir Future Innovators Bootcamp',
    body: `Halo {nama},

Selamat! Kamu dinyatakan LULUS Future Innovators Bootcamp kelas {jurusan} {kota} dengan nilai akhir (SPA) {spa}.

Untuk periode ini kamu belum memenuhi syarat mengikuti program magang karena {alasan}.

Syarat minimal program magang Project Based adalah SPA 50, nilai TPM + capstone 50, dan absen paling banyak 3 kali.

Terima kasih atas partisipasimu selama bootcamp. Pertanyaan tentang hasil ini dapat disampaikan ke PIC kelasmu: {kontak_pic}.${SALAM}`,
  },
  {
    id: 'tidak-lulus',
    name: 'Tidak lulus',
    category: 'tidak-lulus',
    subject: 'Hasil akhir Future Innovators Bootcamp',
    body: `Halo {nama},

Terima kasih telah mengikuti Future Innovators Bootcamp kelas {jurusan} {kota}.

Berdasarkan penilaian akhir, nilai akhir (SPA) kamu {spa}, di bawah batas kelulusan 60. Karena itu kamu dinyatakan belum lulus bootcamp dan belum dapat mengikuti program magang.

Catatan penilaian: {alasan}.

Pertanyaan tentang hasil ini dapat disampaikan ke PIC kelasmu: {kontak_pic}.${SALAM}`,
  },
];
