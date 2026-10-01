// Definisi tipe formulir survei dan jawabannya / Survey form and response type definitions

/**
 * Jenis pertanyaan survei.
 *
 * 'skala' dan 'rating' sama-sama menyimpan angka satu sampai lima; yang
 * membedakan hanya bentuknya di layar peserta, berupa tombol berangka atau
 * bintang. 'pilihan' adalah daftar jawaban yang disusun admin, dan 'teks'
 * dibiarkan terbuka untuk masukan yang tidak terwakili ketiganya.
 *
 * Survey question kinds.
 *
 * 'skala' and 'rating' both store a number from one to five; only their shape
 * on the participant's screen differs, as numbered buttons or as stars.
 * 'pilihan' is a list of answers an admin writes, and 'teks' stays open for
 * feedback none of the others covers.
 */
export type SurveyQuestionKind = 'skala' | 'rating' | 'pilihan' | 'teks';

export const SURVEY_QUESTION_LABELS: Record<SurveyQuestionKind, string> = {
  skala: 'Skala 1-5',
  rating: 'Bintang 1-5',
  pilihan: 'Pilihan Ganda',
  teks: 'Isian Bebas',
};

/**
 * Jenis yang nilainya berupa angka satu sampai lima.
 *
 * Skala dan bintang menyimpan angka yang sama dan dirata-rata dengan cara
 * yang sama; yang berbeda hanya bentuknya di layar peserta. Memisahkan
 * aturannya akan membuat dua tempat yang harus dijaga tetap sama.
 *
 * Kinds whose value is a number from one to five.
 *
 * A scale and a star rating store the same number and average the same way;
 * only their shape on the participant's screen differs. Separating their rules
 * would create two places to keep in step.
 */
export const NUMERIC_KINDS: SurveyQuestionKind[] = ['skala', 'rating'];

export interface SurveyQuestion {
  id: string;
  kind: SurveyQuestionKind;
  text: string;
  /** Hanya untuk 'pilihan'; kosong bagi jenis lain / Only for 'pilihan'; empty for other kinds */
  options: string[];
  required: boolean;
  order: number;
}

/**
 * Formulir survei, satu untuk seluruh kelas dan seluruh pertemuan.
 *
 * Satu formulir, bukan satu per sesi: pertanyaannya sama di tiap pertemuan,
 * dan menyalinnya ke tiap sesi berarti menyunting lima puluh lima salinan
 * setiap kali satu kata berubah. Sesi mana yang dinilai dicatat pada
 * jawabannya, bukan pada formulirnya.
 *
 * The survey form, one for every class and every meeting.
 *
 * One form rather than one per session: the questions are the same at every
 * meeting, and copying them into each session would mean editing fifty-five
 * copies each time one word changes. Which session is being rated is recorded
 * on the response, not on the form.
 */
export interface SurveyFormDocument {
  /** Selalu 'default': hanya ada satu formulir / Always 'default': there is only one form */
  id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  /**
   * Formulir yang belum terbit tidak diminta dari peserta.
   *
   * Formulir tanpa pertanyaan yang terbit menagih peserta mengisi layar
   * kosong, sehingga penerbitannya diperiksa terhadap jumlah pertanyaannya.
   *
   * An unpublished form is never asked of participants.
   *
   * A published form with no questions asks participants to fill in an empty
   * screen, so publishing is checked against the question count.
   */
  published: boolean;
  /**
   * Dinaikkan setiap kali pertanyaannya berubah.
   *
   * Dicatat pada tiap jawaban agar rekapnya dapat memisahkan jawaban atas
   * pertanyaan lama dari yang baru.
   *
   * Raised whenever the questions change.
   *
   * Recorded on every response so a report can separate answers to the old
   * questions from the new ones.
   */
  version: number;
  updatedAt: string;
}

/**
 * Jawaban satu pertanyaan, beserta salinan pertanyaannya.
 *
 * Teks pertanyaannya ikut disalin, bukan hanya id-nya. Formulirnya satu dan
 * dipakai berbulan-bulan, sehingga pertanyaannya pasti berubah di tengah
 * jalan; tanpa salinan ini, jawaban lama akan tampil di bawah pertanyaan yang
 * tidak pernah dibaca orang yang menjawabnya.
 *
 * One question's answer, with a copy of the question.
 *
 * The question text is copied, not just its id. There is one form used over
 * months, so its questions will change partway through; without this copy, an
 * old answer would appear beneath a question its author never read.
 */
export interface SurveyAnswer {
  questionId: string;
  questionText: string;
  kind: SurveyQuestionKind;
  /** Angka untuk 'skala' dan 'rating', teks untuk jenis lain / A number for 'skala' and 'rating', text for other kinds */
  value: string;
}

export interface SurveyResponseDocument {
  id: string; // ${sessionId}_${studentId}
  sessionId: string;
  sessionTitle: string;
  sessionDate: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  /** Versi formulir saat dijawab / The form version at the time of answering */
  formVersion: number;
  answers: SurveyAnswer[];
  submittedAt: string;
}

/** Survei sebuah pertemuan sebagaimana tampil pada kartu peserta / A meeting's survey as it appears on a participant's card */
export interface SessionSurveyState {
  /** Null berarti belum ada formulir terbit / Null means no published form */
  formTitle: string | null;
  questionCount: number;
  submitted: boolean;
}
