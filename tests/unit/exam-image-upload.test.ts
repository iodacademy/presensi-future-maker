// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateImage, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/features/uploads/service';
import { validateQuestion } from '@/features/exams/policy';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const uploads = read('src/features/uploads/service.ts');
const examService = read('src/features/exams/service.ts');
const editor = read('src/app/(admin)/admin/ujian/[examId]/page.tsx');
const builder = read('src/app/(admin)/admin/kelas/[classId]/exam-builder.tsx');
const runner = read('src/app/(student)/app/ujian/[examId]/page.tsx');
const rules = read('storage.rules');

const ok = { contentType: 'image/png', size: 1000, fileName: 'soal.png' };

/**
 * Berkas yang diunggah dibuka peserta lewat tautan terbuka.
 *
 * Daftar putih dipakai, bukan daftar hitam: jenis yang tidak terduga selalu
 * lebih banyak daripada yang dapat disebutkan, dan satu jenis yang terlewat
 * pada daftar hitam berarti berkas apa pun dapat masuk.
 *
 * Uploaded files open to participants through a public link.
 *
 * An allowlist is used, not a blocklist: unexpected types always outnumber the
 * ones anyone can name, and a single type missed on a blocklist means any file
 * can pass.
 */
describe('pemeriksaan berkas unggahan', () => {
  it('menerima jenis gambar yang didaftar', () => {
    for (const t of ALLOWED_IMAGE_TYPES) {
      const ext = t === 'image/jpeg' ? 'jpg' : t.split('/')[1];
      expect(() => validateImage({ ...ok, contentType: t, fileName: `a.${ext}` }), t).not.toThrow();
    }
  });

  it('menolak jenis di luar daftarnya', () => {
    for (const t of ['application/pdf', 'text/html', 'application/octet-stream', '']) {
      expect(() => validateImage({ ...ok, contentType: t }), t).toThrow(/harus berupa gambar/);
    }
  });

  it('menolak SVG pada jenisnya, bukan hanya pada namanya', () => {
    // Isinya dapat memuat skrip yang berjalan saat gambarnya dibuka langsung.
    //
    // Diuji dengan nama berkas yang sah: pemeriksaan awalan "image/" akan
    // meloloskan SVG lewat jenisnya, dan hanya nama berkasnya yang menahan --
    // pertahanan yang runtuh begitu seseorang menamainya .png.
    //
    // Its contents can carry script that runs when the image is opened
    // directly.
    //
    // Tested with a valid file name: a prefix check on "image/" would let SVG
    // through on its type, leaving only the file name to stop it -- a defence
    // that falls the moment someone names it .png.
    expect(ALLOWED_IMAGE_TYPES).not.toContain('image/svg+xml');
    expect(() => validateImage({ ...ok, contentType: 'image/svg+xml', fileName: 'a.png' })).toThrow(
      /harus berupa gambar/
    );
  });

  it('memeriksa namanya, bukan hanya jenis yang dikirim peramban', () => {
    // Keduanya dapat dipalsukan sendiri-sendiri; memeriksa keduanya menuntut
    // pemalsuan yang konsisten.
    //
    // Either can be forged on its own; checking both demands a consistent
    // forgery.
    expect(() => validateImage({ ...ok, fileName: 'muatan.exe' })).toThrow(/berakhiran/);
    expect(() => validateImage({ ...ok, fileName: 'tanpa-ekstensi' })).toThrow(/berakhiran/);
  });

  it('menolak berkas melebihi batas ukurannya', () => {
    // Gambar dibuka peserta lewat jaringan seluler di ruang kelas.
    // Participants open these over mobile connections in a classroom.
    expect(() => validateImage({ ...ok, size: MAX_IMAGE_BYTES + 1 })).toThrow(/maksimal/);
    expect(() => validateImage({ ...ok, size: MAX_IMAGE_BYTES })).not.toThrow();
  });

  it('menolak berkas kosong', () => {
    expect(() => validateImage({ ...ok, size: 0 })).toThrow(/kosong/);
  });
});

describe('penjagaan unggahan', () => {
  it('hanya admin yang dapat mengunggah', () => {
    expect(uploads).toContain("actor.role !== 'admin'");
  });

  it('membuat ulang nama berkasnya, tidak memakai nama kiriman', () => {
    // Nama kiriman dapat memuat garis miring yang memindahkan berkasnya ke
    // jalur lain, dan dapat menimpa berkas yang sudah ada bila namanya
    // kebetulan sama.
    //
    // A submitted name can carry slashes that move the file elsewhere, and can
    // overwrite an existing file when the name happens to match.
    expect(uploads).toMatch(/exam-images\/\$\{examId\}\/\$\{crypto\.randomUUID\(\)\}/);
  });

  it('membatasi penghapusan pada jalur gambar ujian', () => {
    // Tanpa itu, penghapusan dapat diarahkan ke berkas lain di dalam bucket
    // yang sama.
    //
    // Without it, a deletion could be aimed at any other file in the same
    // bucket.
    expect(uploads).toMatch(/!path\.startsWith\('exam-images\/'\)/);
  });

  it('melewatkan berkas yang sudah tidak ada', () => {
    // Menggagalkan penghapusan soal karena gambarnya hilang meninggalkan soal
    // yang tidak dapat dihapus sama sekali.
    //
    // Failing a question's deletion because its image is missing would leave a
    // question that cannot be deleted at all.
    const blok = uploads.slice(uploads.indexOf('export async function deleteExamImage'));
    expect(blok).toMatch(/} catch \{/);
  });

  it('aturan penyimpanan tetap menolak akses langsung', () => {
    // Unggahan lewat server kehilangan artinya bila peramban tetap dapat
    // menulis sendiri ke bucket.
    //
    // Server-side upload means nothing if the browser can still write to the
    // bucket itself.
    expect(rules).toMatch(/allow read, write: if false/);
  });

  it('memeriksa ukurannya sebelum berkasnya dibaca ke memori', () => {
    // Membaca lebih dulu lalu menolaknya berarti berkas besar tetap
    // menghabiskan memori server sebelum ditolak.
    //
    // Reading first and refusing after would still spend server memory on a
    // large file.
    const route = read('src/app/api/uploads/exam-image/route.ts');
    expect(route.indexOf('file.size > MAX_IMAGE_BYTES')).toBeLessThan(route.indexOf('file.arrayBuffer()'));
  });
});

describe('gambar pada soal', () => {
  const opsi = [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
  ];

  it('mengizinkan soal tanpa teks bila bergambar', () => {
    // Soal "perhatikan diagram berikut" yang seluruh isinya ada pada gambarnya
    // tidak punya kalimat untuk diketik.
    //
    // A "study the diagram below" question whose whole content is in the image
    // has no sentence to type.
    expect(() =>
      validateQuestion({ kind: 'pilihan-ganda', text: '', imageUrl: 'https://x/a.png', options: opsi, correctOptionId: 'a' })
    ).not.toThrow();
  });

  it('tetap menolak soal tanpa teks maupun gambar', () => {
    expect(() =>
      validateQuestion({ kind: 'pilihan-ganda', text: '  ', options: opsi, correctOptionId: 'a' })
    ).toThrow(/wajib diisi/);
  });

  it('mengizinkan pilihan bergambar tanpa teks', () => {
    // Soal yang pilihannya berupa empat gambar tidak punya kalimat untuk tiap
    // pilihannya.
    //
    // A question whose options are four images has no sentence for each.
    expect(() =>
      validateQuestion({
        kind: 'pilihan-ganda',
        text: 'Mana yang benar?',
        options: [
          { id: 'a', text: '', imageUrl: 'https://x/a.png' },
          { id: 'b', text: '', imageUrl: 'https://x/b.png' },
        ],
        correctOptionId: 'a',
      })
    ).not.toThrow();
  });

  it('tetap menolak pilihan tanpa teks maupun gambar', () => {
    expect(() =>
      validateQuestion({
        kind: 'pilihan-ganda',
        text: 'Soal?',
        options: [{ id: 'a', text: 'A' }, { id: 'b', text: '  ' }],
        correctOptionId: 'a',
      })
    ).toThrow(/teks atau gambarnya/);
  });

  it('menghapus gambarnya bersama soalnya', () => {
    // Berkas yang soalnya hilang tidak pernah terbaca lagi tetapi tetap
    // menempati penyimpanan dan tetap dapat dibuka siapa pun yang pernah
    // menyalin tautannya.
    //
    // A file whose question is gone is never read again yet still occupies
    // storage and stays openable by anyone who copied its link.
    expect(examService).toContain('removeQuestionImages');
    expect(examService).toMatch(/await removeQuestionImages\(actor, question\)/);
  });

  it('menghapus seluruh gambar soal saat ujiannya dihapus', () => {
    const blok = examService.slice(examService.indexOf('export async function deleteExam'));
    expect(blok).toContain('removeQuestionImages');
  });

  it('menyimpan tautannya, bukan data gambarnya', () => {
    // Gambar base64 di dalam dokumen membuat tiap soal terbaca utuh setiap
    // kali daftarnya dimuat.
    //
    // A base64 image inside the document makes every question read whole each
    // time the list loads.
    // Komentarnya memang menyebut base64 untuk menjelaskan kenapa tidak
    // dipakai; yang diperiksa isi antarmukanya, bukan penjelasannya.
    //
    // The comment does mention base64 to explain why it is not used; what is
    // checked is the interface body, not the explanation.
    const types = read('src/features/exams/types.ts');
    const tanpaKomentar = types.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(tanpaKomentar).toContain('imageUrl?: string | null');
    expect(tanpaKomentar).not.toMatch(/imageData|base64/i);
  });

  it('tampil pada soal dan pilihannya di layar peserta', () => {
    expect(runner).toMatch(/soal\.imageUrl && \(/);
    expect(runner).toMatch(/o\.imageUrl && \(/);
  });

  it('membatasi tinggi gambar soal agar pilihannya tetap terlihat', () => {
    // Gambar setinggi layar mendorong seluruh pilihan ke bawah lipatan, dan
    // peserta mengira soalnya tidak punya jawaban.
    //
    // A full-height image pushes every option below the fold, and participants
    // think the question has no answers.
    expect(runner).toMatch(/maxHeight: '260px'/);
  });
});

describe('penyusun soal berhalaman sendiri', () => {
  it('halamannya ada', () => {
    expect(existsSync(resolve(process.cwd(), 'src/app/(admin)/admin/ujian/[examId]/page.tsx'))).toBe(true);
  });

  it('kartu kelas menaut ke sana, tidak menyunting di tempat', () => {
    // Dua puluh soal beserta pilihan dan gambarnya tidak muat pada kartu yang
    // melebar.
    //
    // Twenty questions with their options and images do not fit in an
    // expanding card.
    expect(builder).toContain('/admin/ujian/${exam.id}');
    expect(builder).not.toContain('QuestionEditor');
    expect(builder).not.toContain('ExamRoster');
  });

  it('ujian baru langsung masuk ke penyuntingnya', () => {
    expect(builder).toMatch(/router\.push\(`\/admin\/ujian\/\$\{data\.id\}`\)/);
  });

  it('mengunggah gambar begitu dipilih, tidak menunggu soalnya disimpan', () => {
    // Tautan gambarnya sudah ada saat soalnya dikirim, sehingga kegagalan
    // unggah tidak menyeret seluruh soalnya.
    //
    // The image link already exists when the question is sent, so a failed
    // upload does not drag the whole question down with it.
    expect(editor).toContain('/api/uploads/exam-image');
    expect(editor).toMatch(/async function pilih/);
  });

  it('membatasi jenis berkas pada pemilihnya', () => {
    expect(editor).toContain('accept="image/jpeg,image/png,image/webp,image/gif"');
  });

  it('mengambil ujian dan soalnya bersamaan', () => {
    // Berurutan hanya menggandakan waktu tunggunya.
    // Doing them in sequence only doubles the wait.
    expect(editor).toMatch(/await Promise\.all\(\[\s*fetch\(`\/api\/exams\/\$\{examId\}\/meta`\)/);
  });
});
