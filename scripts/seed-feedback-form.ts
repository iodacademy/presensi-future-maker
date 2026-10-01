/**
 * Menyusun formulir "Feedback Pasca Training" beserta seluruh pertanyaannya.
 *
 * Dijalankan sebagai skrip, bukan diketik satu per satu di layar: dua puluh
 * empat pertanyaan berarti dua puluh empat putaran formulir yang sama, dan
 * satu salah ketik di tengahnya hanya ketahuan setelah peserta mengisinya.
 *
 * Judul bagian (B, C, D, E, F) ikut tertulis pada pertanyaan pertama tiap
 * bagian, sebab formulirnya tidak mengenal pengelompokan -- tanpa itu, dua
 * puluh empat pertanyaan mengalir tanpa jeda yang menunjukkan pergantian
 * topik.
 *
 * Seeds the "Feedback Pasca Training" form with all of its questions.
 *
 * Run as a script rather than typed in one at a time: twenty-four questions
 * mean twenty-four rounds of the same form, and one typo halfway through only
 * surfaces after participants have answered it.
 *
 * The section headings (B, C, D, E, F) are folded into the first question of
 * each section, since the form has no notion of grouping -- without them,
 * twenty-four questions run on with nothing marking a change of topic.
 *
 * Jalankan / Run:
 *   npx tsx scripts/seed-feedback-form.ts
 */
import crypto from 'crypto';
import { getAdminDb } from '../src/lib/firebase/admin';
import type { SurveyFormDocument, SurveyQuestion, SurveyQuestionKind } from '../src/features/survey/types';

const JUDUL = 'Feedback Pasca Training';

type Bahan = [SurveyQuestionKind, string];

const PERTANYAAN: Bahan[] = [
  // B. Materi dan Penyampaian
  ['skala', 'B. Materi dan Penyampaian - Tujuan pelatihan disampaikan dengan jelas di awal kelas.'],
  ['skala', 'Urutan materi mudah diikuti.'],
  ['skala', 'Istilah teknis dijelaskan dengan bahasa yang mudah saya pahami.'],
  ['skala', 'Contoh dan studi kasus yang dipakai membantu saya memahami materi.'],
  ['skala', 'Materi relevan dengan kebutuhan atau rencana saya ke depan.'],
  ['skala', 'Tingkat kesulitan materi sesuai dengan kemampuan saya.'],

  // C. Fasilitator dan Mentor
  ['skala', 'C. Fasilitator dan Mentor - Fasilitator menyampaikan materi dengan jelas dan runtut.'],
  ['skala', 'Fasilitator menguasai materi yang diajarkan.'],
  ['skala', 'Demonstrasi atau contoh langsung membantu saya mengerjakan praktik.'],
  ['skala', 'Mentor sigap membantu ketika saya mengalami kendala.'],
  ['skala', 'Fasilitator mendorong peserta untuk bertanya dan berbagi pendapat.'],

  // D. Praktik dan Aktivitas
  ['skala', 'D. Praktik dan Aktivitas - Instruksi praktik jelas dan mudah diikuti.'],
  ['skala', 'Dokumen pendukung (modul, lembar kerja, panduan) membantu saya menyelesaikan praktik.'],
  ['skala', 'Waktu yang diberikan untuk praktik sudah cukup.'],
  ['skala', 'Aktivitas di kelas membuat saya aktif terlibat, tidak hanya mendengarkan.'],

  // E. Alat dan Fasilitas
  ['skala', 'E. Alat dan Fasilitas - Alat atau aplikasi yang dipakai mudah saya gunakan.'],
  ['skala', 'Ruang kelas, koneksi internet, dan perangkat mendukung kegiatan belajar.'],
  ['skala', 'Slide dan materi tayang mudah dibaca.'],
  ['skala', 'Durasi dan jadwal kelas sudah sesuai.'],

  // F. Kesan Umum
  ['rating', 'F. Kesan Umum - Secara keseluruhan, saya puas dengan kelas ini.'],
  ['nps', 'Seberapa besar kemungkinan kamu merekomendasikan kelas ini ke teman?'],
  ['teks', 'Bagian mana dari kelas ini yang paling bermanfaat untukmu?'],
  ['teks', 'Bagian mana yang paling sulit atau membingungkan?'],
  ['teks', 'Apa satu hal yang perlu kami perbaiki untuk kelas berikutnya?'],
];

async function main() {
  const db = getAdminDb();

  // Formulir berjudul sama dicari lebih dulu. Menjalankan skrip ini dua kali
  // tanpa pemeriksaan itu menghasilkan dua formulir identik yang keduanya
  // muncul pada kartu pertemuan peserta.
  //
  // An existing form with the same title is looked up first. Running this
  // script twice without that check yields two identical forms, both appearing
  // on participants' meeting cards.
  const snap = await db.collection('surveyForms').get();
  const ada = snap.docs
    .map((d) => d.data() as SurveyFormDocument)
    .find((f) => f.title.trim().toLowerCase() === JUDUL.toLowerCase());

  if (ada) {
    console.log(`Formulir "${JUDUL}" sudah ada (${ada.questions.length} pertanyaan).`);
    console.log('Hapus dulu dari halaman Pengaturan bila ingin menyusunnya ulang.');
    return;
  }

  const now = new Date().toISOString();
  const questions: SurveyQuestion[] = PERTANYAAN.map(([kind, text], i) => ({
    id: crypto.randomUUID(),
    kind,
    text,
    options: [],
    // Isian bebas tidak diwajibkan: memaksa peserta menulis sesuatu pada tiga
    // kolom terakhir menghasilkan jawaban "-" yang tidak berisi apa pun.
    //
    // Free text is not required: forcing participants to write something in the
    // last three fields yields answers of "-" that carry nothing.
    required: kind !== 'teks',
    order: i + 1,
  }));

  const id = crypto.randomUUID();
  const form: SurveyFormDocument = {
    id,
    title: JUDUL,
    description:
      'Masukan Anda dipakai untuk memperbaiki pelatihan berikutnya. Isi sejujurnya; tidak ada jawaban yang benar atau salah.',
    questions,
    // Cakupannya seluruh kelas dan seluruh pertemuan. Admin dapat
    // mempersempitnya dari halaman Pengaturan, dan cakupan yang terlalu luas
    // terlihat sedangkan cakupan kosong tidak.
    //
    // Its scope is every class and every meeting. An admin can narrow it from
    // the Settings page, and too wide a scope is visible while an empty one is
    // not.
    scope: { classIds: [], sessionIds: [] },
    // Dibiarkan draf: admin memeriksanya lebih dulu, lalu menerbitkannya
    // sendiri. Formulir yang langsung terbit menagih peserta sebelum siapa pun
    // sempat membacanya.
    //
    // Left as a draft: an admin reviews it first, then publishes it. A form
    // that publishes itself asks participants before anyone has read it.
    published: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('surveyForms').doc(id).set(form);

  const hitung = questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.kind] = (acc[q.kind] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Formulir "${JUDUL}" dibuat dengan ${questions.length} pertanyaan:`);
  for (const [kind, n] of Object.entries(hitung)) {
    console.log(`  ${kind}: ${n}`);
  }
  console.log('\nMasih berstatus draf. Periksa di Pengaturan, lalu klik Terbitkan.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
