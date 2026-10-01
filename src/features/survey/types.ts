// Definisi tipe formulir survei dan jawabannya / Survey form and response type definitions

/**
 * Jenis pertanyaan survei.
 *
 * 'skala', 'rating', dan 'nps' sama-sama menyimpan angka dan dirata-rata
 * dengan cara yang sama; yang membedakan hanya rentang dan bentuknya di layar
 * peserta. 'pilihan' adalah daftar jawaban yang disusun admin, dan 'teks'
 * dibiarkan terbuka untuk masukan yang tidak terwakili ketiganya.
 *
 * Survey question kinds.
 *
 * 'skala', 'rating', and 'nps' all store a number and average the same way;
 * only their range and their shape on the participant's screen differ.
 * 'pilihan' is a list of answers an admin writes, and 'teks' stays open for
 * feedback none of the others covers.
 */
export type SurveyQuestionKind = 'skala' | 'rating' | 'nps' | 'pilihan' | 'teks';

export const SURVEY_QUESTION_LABELS: Record<SurveyQuestionKind, string> = {
  skala: 'Skala 1-5',
  rating: 'Bintang 1-5',
  nps: 'Skala 0-10',
  pilihan: 'Pilihan Ganda',
  teks: 'Isian Bebas',
};

/**
 * Rentang angka yang sah untuk tiap jenis bernilai angka.
 *
 * Dipisahkan per jenis sebab 'nps' dimulai dari nol: pertanyaan rekomendasi
 * memang menyediakan nol sebagai jawaban, dan memaksanya mulai dari satu
 * menghilangkan jawaban paling negatif yang dapat diberikan seseorang.
 *
 * The valid number range for each numeric kind.
 *
 * Kept per kind because 'nps' starts at zero: a recommendation question does
 * offer zero as an answer, and forcing it to start at one removes the most
 * negative answer anyone can give.
 */
export const NUMERIC_RANGES: Record<string, { min: number; max: number }> = {
  skala: { min: 1, max: 5 },
  rating: { min: 1, max: 5 },
  nps: { min: 0, max: 10 },
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
export const NUMERIC_KINDS: SurveyQuestionKind[] = ['skala', 'rating', 'nps'];

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
 * Cakupan sebuah formulir: kelas dan pertemuan mana yang memakainya.
 *
 * Daftar kosong berarti seluruhnya. Menyimpan seluruh id kelas saat admin
 * memilih "semua kelas" akan membuat kelas yang dibuat kemudian terlewat,
 * sebab daftarnya dibekukan pada saat formulir disimpan.
 *
 * A form's scope: which classes and meetings use it.
 *
 * An empty list means all of them. Storing every class id when an admin picks
 * "all classes" would miss classes created later, since the list would be
 * frozen at the moment the form was saved.
 */
export interface SurveyScope {
  /** Kosong berarti seluruh kelas / Empty means every class */
  classIds: string[];
  /** Kosong berarti seluruh pertemuan / Empty means every meeting */
  sessionIds: string[];
}

/**
 * Formulir survei.
 *
 * Beberapa formulir dapat berdampingan, masing-masing dengan cakupannya
 * sendiri: survei pembukaan hanya untuk pertemuan pertama, survei mingguan
 * untuk seluruhnya. Pertemuan mana yang dinilai tetap dicatat pada jawabannya,
 * bukan dengan menyalin pertanyaannya ke tiap sesi.
 *
 * A survey form.
 *
 * Several forms can stand side by side, each with its own scope: an opening
 * survey for the first meeting only, a weekly one for all of them. Which
 * meeting is being rated is still recorded on the response rather than by
 * copying the questions into each session.
 */
export interface SurveyFormDocument {
  id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  scope: SurveyScope;
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
  createdAt: string;
  updatedAt: string;
}

/**
 * Jawaban satu pertanyaan, beserta salinan pertanyaannya.
 *
 * Teks pertanyaannya ikut disalin, bukan hanya id-nya. Formulirnya dipakai
 * berbulan-bulan, sehingga pertanyaannya pasti berubah di tengah jalan; tanpa
 * salinan ini, jawaban lama akan tampil di bawah pertanyaan yang tidak pernah
 * dibaca orang yang menjawabnya.
 *
 * One question's answer, with a copy of the question.
 *
 * The question text is copied, not just its id. A form is used over months, so
 * its questions will change partway through; without this copy, an old answer
 * would appear beneath a question its author never read.
 */
export interface SurveyAnswer {
  questionId: string;
  questionText: string;
  kind: SurveyQuestionKind;
  /** Angka untuk jenis bernilai angka, teks untuk jenis lain / A number for numeric kinds, text for the others */
  value: string;
}

export interface SurveyResponseDocument {
  id: string; // ${formId}_${sessionId}_${studentId}
  /**
   * Formulir yang dijawab.
   *
   * Dicatat sejak beberapa formulir dapat berdampingan: tanpa ini, rekap
   * sebuah formulir akan ikut menghitung jawaban atas formulir lain yang
   * kebetulan mengenai pertemuan yang sama.
   *
   * The form that was answered.
   *
   * Recorded now that several forms can coexist: without it, one form's report
   * would count answers to another form that happened to cover the same
   * meeting.
   */
  formId: string;
  formTitle: string;
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

/** Satu survei sebagaimana tampil pada kartu pertemuan peserta / One survey as it appears on a participant's meeting card */
export interface SessionSurveyState {
  formId: string;
  formTitle: string;
  questionCount: number;
  submitted: boolean;
}
