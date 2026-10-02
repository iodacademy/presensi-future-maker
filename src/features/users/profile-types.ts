// Profil peserta yang dilengkapi sendiri / The participant-completed profile

export type Gender = 'perempuan' | 'laki-laki';

export const GENDER_LABELS: Record<Gender, string> = {
  perempuan: 'Perempuan',
  'laki-laki': 'Laki-laki',
};

/**
 * Jenis disabilitas.
 *
 * 'tidak-ada' adalah pilihan tersendiri, bukan ketiadaan jawaban: peserta yang
 * memilihnya berbeda dari peserta yang melewatkan pertanyaannya, dan
 * menggabungkan keduanya membuat jumlah peserta disabilitas tidak dapat
 * dipercaya.
 *
 * Disability kinds.
 *
 * 'tidak-ada' is a choice of its own rather than the absence of an answer: a
 * participant who picks it differs from one who skipped the question, and
 * merging the two makes the disability count untrustworthy.
 */
export type Disability = 'tidak-ada' | 'fisik' | 'sensorik' | 'intelektual' | 'mental' | 'lainnya';

export const DISABILITY_LABELS: Record<Disability, string> = {
  'tidak-ada': 'Tidak ada',
  fisik: 'Fisik',
  sensorik: 'Sensorik',
  intelektual: 'Intelektual',
  mental: 'Mental',
  lainnya: 'Lainnya',
};

export type EntryStatus = 'pelajar' | 'mahasiswa' | 'bekerja' | 'mencari-kerja' | 'wirausaha' | 'lainnya';

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  pelajar: 'Pelajar',
  mahasiswa: 'Mahasiswa',
  bekerja: 'Bekerja',
  'mencari-kerja': 'Sedang mencari kerja',
  wirausaha: 'Wirausaha',
  lainnya: 'Lainnya',
};

/**
 * Profil peserta.
 *
 * Tanggal lahir disimpan, bukan usianya: usia yang disimpan menjadi salah tiap
 * ulang tahun, dan tidak ada yang memperbaruinya.
 *
 * Disimpan di luar dokumen pengguna. Dokumen itu dibaca pada hampir setiap
 * jalur -- presensi, tugas, ujian -- dan tanggal lahir serta disabilitas tidak
 * dibutuhkan satu pun di antaranya.
 *
 * A participant's profile.
 *
 * The birth date is stored, not the age: a stored age turns wrong on every
 * birthday, and nothing updates it.
 *
 * Kept outside the user document. That document is read on nearly every path --
 * attendance, tasks, exams -- and neither the birth date nor the disability is
 * needed by any of them.
 */
export interface StudentProfileDocument {
  /** Sama dengan uid peserta / Same as the participant's uid */
  id: string;
  /** "YYYY-MM-DD" / "YYYY-MM-DD" */
  birthDate: string;
  gender: Gender;
  disability: Disability;
  /** Keterangan bila disabilitasnya 'lainnya' / A note when the disability is 'lainnya' */
  disabilityNote: string;
  entryStatus: EntryStatus;
  phone: string;
  updatedAt: string;
}

export type ProfileInput = Omit<StudentProfileDocument, 'id' | 'updatedAt'>;
