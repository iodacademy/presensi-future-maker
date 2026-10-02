// Layanan profil peserta / Participant profile service
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import {
  DISABILITY_LABELS,
  ENTRY_STATUS_LABELS,
  GENDER_LABELS,
  type ProfileInput,
  type StudentProfileDocument,
} from './profile-types';

/** Usia terendah dan tertinggi yang masuk akal bagi peserta / The lowest and highest ages that make sense for a participant */
export const MIN_AGE = 15;
export const MAX_AGE = 60;

/**
 * Menghitung usia dari tanggal lahir.
 *
 * Dihitung saat dibaca, bukan disimpan: usia yang disimpan menjadi salah tiap
 * ulang tahun, dan tidak ada yang memperbaruinya.
 *
 * Computes age from a birth date.
 *
 * Computed on read rather than stored: a stored age turns wrong on every
 * birthday, and nothing updates it.
 */
export function ageFrom(birthDate: string, now = new Date()): number | null {
  const lahir = new Date(`${birthDate}T00:00:00+07:00`);
  if (Number.isNaN(lahir.getTime())) return null;

  let usia = now.getFullYear() - lahir.getFullYear();
  const bulan = now.getMonth() - lahir.getMonth();
  // Ulang tahun yang belum lewat tahun ini mengurangi satu. Tanpa ini, peserta
  // yang lahir Desember terhitung setahun lebih tua sepanjang sebelas bulan.
  //
  // A birthday not yet reached this year subtracts one. Without it, someone
  // born in December counts a year older for eleven months.
  if (bulan < 0 || (bulan === 0 && now.getDate() < lahir.getDate())) usia -= 1;

  return usia;
}

/**
 * Memvalidasi masukan profil.
 *
 * Diperiksa di server meski formulirnya sudah membatasi pilihannya: muatan
 * yang dikirim dapat diubah sebelum tiba, dan nilai di luar daftar akan
 * memunculkan kategori yang tidak pernah ditawarkan pada rekap.
 *
 * Validates profile input.
 *
 * Checked on the server although the form already limits the choices: the
 * payload sent can be altered before it arrives, and a value outside the list
 * would put a category nobody was offered into the report.
 */
export function validateProfile(input: Partial<ProfileInput>): ProfileInput {
  const birthDate = (input.birthDate ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new Error('Tanggal lahir wajib diisi');
  }

  const usia = ageFrom(birthDate);
  if (usia === null) {
    throw new Error('Tanggal lahir tidak dapat dibaca');
  }
  if (usia < MIN_AGE || usia > MAX_AGE) {
    // Tanggal yang salah ketik -- tahun 2026 alih-alih 2006 -- menghasilkan
    // usia nol, dan rata-rata usia seluruh angkatan ikut melesat.
    //
    // A mistyped date -- 2026 instead of 2006 -- yields an age of zero, and the
    // cohort's average age slides with it.
    throw new Error(`Usia dari tanggal itu ${usia} tahun. Periksa kembali tahun lahirnya.`);
  }

  if (!input.gender || !(input.gender in GENDER_LABELS)) {
    throw new Error('Jenis kelamin wajib dipilih');
  }
  if (!input.disability || !(input.disability in DISABILITY_LABELS)) {
    throw new Error('Status disabilitas wajib dipilih');
  }
  if (!input.entryStatus || !(input.entryStatus in ENTRY_STATUS_LABELS)) {
    throw new Error('Status saat mendaftar wajib dipilih');
  }

  const phone = (input.phone ?? '').replace(/[\s-]/g, '');
  if (!/^(\+62|62|0)8\d{7,12}$/.test(phone)) {
    throw new Error('Nomor WhatsApp tidak valid. Contoh: 08123456789');
  }

  const disabilityNote = (input.disabilityNote ?? '').trim().slice(0, 200);
  if (input.disability === 'lainnya' && !disabilityNote) {
    // "Lainnya" tanpa keterangan tidak memberi tahu apa pun yang dapat
    // ditindaklanjuti penyelenggara.
    //
    // "Other" with no note tells the organisers nothing they can act on.
    throw new Error('Sebutkan jenis disabilitasnya');
  }

  return {
    birthDate,
    gender: input.gender,
    disability: input.disability,
    disabilityNote,
    entryStatus: input.entryStatus,
    phone,
  };
}

export async function getProfile(uid: string): Promise<StudentProfileDocument | null> {
  const snap = await getAdminDb().collection('studentProfiles').doc(uid).get();
  return snap.exists ? (snap.data() as StudentProfileDocument) : null;
}

/**
 * Menyimpan profil peserta.
 *
 * Peserta menyimpan profilnya sendiri; admin tidak mengisikannya. Data ini
 * tentang dirinya, dan menanyakannya lewat admin berarti seratus percakapan
 * yang jawabannya sudah dipegang orangnya.
 *
 * Saves a participant's profile.
 *
 * Participants save their own; an admin does not fill it in for them. This is
 * about themselves, and asking through an admin would mean a hundred
 * conversations whose answers the person already holds.
 */
export async function saveProfile(actor: Actor, input: Partial<ProfileInput>): Promise<void> {
  if (actor.role !== 'student') {
    throw new Error('Hanya peserta yang mengisi profil');
  }

  const validated = validateProfile(input);

  await getAdminDb().collection('studentProfiles').doc(actor.uid).set({
    id: actor.uid,
    ...validated,
    updatedAt: new Date().toISOString(),
  } satisfies StudentProfileDocument);
}
