// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const service = read('src/features/exams/service.ts');
const page = read('src/app/(student)/app/ujian/[examId]/hasil/[attemptId]/page.tsx');
const route = read('src/app/api/exams/attempts/[attemptId]/review/route.ts');

const body = service.slice(
  service.indexOf('export async function getAttemptReview'),
  service.length
);

/**
 * Pembahasan memuat jawaban benarnya.
 *
 * Menampilkannya selagi peserta masih punya kesempatan mengulang berarti
 * memberikan kunci untuk percobaan berikutnya: ia tinggal mencatat lalu
 * mengulang, dan percobaan kedua kehilangan artinya sebagai pengukur.
 *
 * A review carries the correct answers.
 *
 * Showing it while attempts remain hands over the key for the next one: they
 * need only write it down and retake, and the second attempt stops measuring
 * anything.
 */
describe('pembahasan ditahan selama masih ada kesempatan', () => {
  it('menahan kunci bila peserta belum lulus dan kesempatannya masih ada', () => {
    expect(body).toMatch(/if \(!sudahLulus && !kesempatanHabis\)/);
    expect(body).toContain('questions: null');
  });

  it('membuka pembahasan setelah lulus', () => {
    // Yang sudah lulus tidak dapat mengulang, sehingga kuncinya tidak lagi
    // berguna untuk percobaan berikutnya.
    //
    // Someone who passed cannot retake, so the key is no longer useful for a
    // next attempt.
    expect(body).toMatch(/sudahLulus = semua\.some\(\(a\) => a\.passed === true\)/);
  });

  it('membuka pembahasan setelah kesempatan habis', () => {
    expect(body).toMatch(/kesempatanHabis = semua\.length >= MAX_ATTEMPTS/);
  });

  it('menyebutkan alasan penahanannya', () => {
    // Pembahasan yang hilang tanpa penjelasan terbaca sebagai kerusakan.
    // A review that vanishes unexplained reads as a fault.
    expect(body).toContain('withheldReason');
    expect(body).toContain('supaya percobaan berikutnya tetap bermakna');
  });

  it('menjaganya di layanan, bukan di tampilan', () => {
    // Menahan tombolnya saja tidak menahan siapa pun yang memanggil
    // endpointnya langsung.
    //
    // Hiding the button alone holds back nobody who calls the endpoint
    // directly.
    expect(route).toContain('getAttemptReview(actor, attemptId)');
    expect(route).not.toMatch(/sudahLulus|kesempatanHabis|MAX_ATTEMPTS/);
  });

  it('membaca kunci hanya setelah penjagaannya lolos', () => {
    // Membacanya lebih dulu akan mengirim kunci pada jalur yang seharusnya
    // menahannya.
    //
    // Reading it earlier would send the key down the path meant to withhold
    // it.
    expect(body.indexOf('if (!sudahLulus && !kesempatanHabis)')).toBeLessThan(
      body.indexOf("collection('examAnswerKeys')")
    );
  });

  it('memeriksa kepemilikan percobaannya', () => {
    expect(body).toContain('bukan milik Anda');
  });

  it('menolak percobaan yang belum dikumpulkan', () => {
    // Percobaan yang masih berjalan memiliki jawaban yang belum dinilai, dan
    // kuncinya belum boleh terlihat sama sekali.
    //
    // A running attempt holds ungraded answers, and its key must not be
    // visible at all yet.
    expect(body).toMatch(/attempt\.status !== 'selesai'/);
  });

  it('hanya untuk peserta', () => {
    expect(body).toContain("actor.role !== 'student'");
  });
});

describe('tampilan pembahasan', () => {
  it('mengikuti urutan soal percobaan itu', () => {
    // Peserta mengingat soal nomor tiga sebagaimana ia melihatnya, bukan
    // menurut urutan aslinya.
    //
    // A participant remembers question three as they saw it, not in the
    // original order.
    expect(body).toMatch(/attempt\.questionOrder\s*\n?\s*\.map/);
  });

  it('menandai jawaban peserta dan kuncinya terpisah', () => {
    expect(page).toContain('JAWABAN BENAR');
    expect(page).toContain('PILIHAN ANDA');
  });

  it('menyebut soal yang dilewatkan', () => {
    // Tanpa penanda apa pun, barisnya terlihat seperti jawaban yang hilang.
    // With no marker at all, the row looks like a lost answer.
    expect(page).toContain('Anda tidak menjawab soal ini');
  });

  it('menjelaskan nilai yang dipatok', () => {
    expect(page).toMatch(/data\.score !== data\.rawScore/);
  });

  it('menampilkan alasan bila pembahasannya ditahan', () => {
    expect(page).toMatch(/data\.questions === null/);
    expect(page).toContain('Pembahasan belum dibuka');
  });
});
