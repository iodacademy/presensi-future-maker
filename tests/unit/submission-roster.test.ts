// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const service = read('src/features/tasks/submission-service.ts');
const roster = read('src/app/(admin)/admin/kelas/[classId]/submission-roster.tsx');
const classPage = read('src/app/(admin)/admin/kelas/[classId]/page.tsx');

const body = service.slice(
  service.indexOf('export async function getTaskSubmissionRoster'),
  service.indexOf('export', service.indexOf('export async function getTaskSubmissionRoster') + 10)
);

/**
 * Siapa yang belum mengumpulkan tidak berbentuk dokumen apa pun.
 *
 * Koleksi submissions hanya memuat yang sudah masuk, sehingga nama yang belum
 * hanya dapat muncul dengan membandingkan daftar peserta kelas terhadap
 * pengumpulan yang ada.
 *
 * Who has not submitted is no document at all.
 *
 * The submissions collection holds only what came in, so a pending name can
 * only surface by comparing the class roster against the submissions that
 * exist.
 */
describe('rekap pengumpulan satu tugas', () => {
  it('hanya untuk admin', () => {
    expect(body).toContain("actor.role !== 'admin'");
  });

  it('menurunkan yang belum dari daftar peserta kelas', () => {
    expect(body).toContain("where('role', '==', 'student')");
    expect(body).toContain("where('taskId', '==', taskId)");
    expect(body).toMatch(/pending\.push/);
  });

  it('membaca peserta dan pengumpulan sekaligus', () => {
    // Satu angkatan berisi puluhan orang; pembacaan berurutan menggandakan
    // waktu tunggu pada kartu yang dibuka berkali-kali.
    //
    // A cohort holds dozens; sequential reads double the wait on a card opened
    // over and over.
    expect(body).toMatch(/Promise\.all\(\[/);
  });

  it('tidak membaca satu kali per peserta', () => {
    // Pembacaan per baris mengulang perjalanan yang sama puluhan kali.
    // Per-row reads repeat the same round trip dozens of times.
    expect(body).not.toMatch(/for \([\s\S]{0,80}await db\.collection/);
  });

  it('melewatkan peserta nonaktif', () => {
    // Peserta nonaktif tidak lagi mengikuti kelas; menghitungnya membuat angka
    // itu tidak pernah lunas.
    //
    // A deactivated participant no longer attends; counting them keeps the
    // number from ever reaching zero.
    expect(body).toContain("where('active', '==', true)");
  });

  it('mengurutkan yang belum menurut nama', () => {
    // Urutan dokumen Firestore tidak berarti apa pun bagi admin yang mencari
    // satu nama.
    //
    // Firestore document order means nothing to an admin looking for one name.
    expect(body).toMatch(/pending\.sort/);
    expect(body).toContain("localeCompare(b.studentName, 'id')");
  });

  it('menolak tugas yang tidak ada', () => {
    expect(body).toContain('Tugas tidak ditemukan');
  });
});

describe('tampilan rekap', () => {
  it('menyebut jumlah yang sudah dan totalnya', () => {
    // "12 sudah" tanpa total tidak memberi tahu berapa yang kurang.
    // "12 submitted" with no total does not say how many are missing.
    expect(roster).toContain('dari {total} sudah mengumpulkan');
  });

  it('menyembunyikan daftar yang belum sampai diminta', () => {
    // Sembilan belas nama di tiap kartu mengubur isi kartunya sendiri.
    // Nineteen names on every card bury the card's own content.
    expect(roster).toMatch(/showPending/);
    expect(roster).toContain('aria-expanded={showPending}');
  });

  it('menandai yang terlambat', () => {
    expect(roster).toMatch(/\.filter\(\(s\) => s\.late\)/);
  });

  it('mengambil rekap saat kartunya dibuka, bukan di muka', () => {
    // Tiap rekap membaca seluruh peserta kelas; memuat semuanya di muka berarti
    // puluhan pembacaan untuk kartu yang mungkin tidak pernah dibuka.
    //
    // Each roster reads the whole class; loading them all up front means dozens
    // of reads for cards that may never be opened.
    expect(roster).toMatch(/useEffect\(\(\) => \{[\s\S]{0,200}fetch\(`\/api\/tasks\/\$\{taskId\}\/roster`\)/);
  });

  it('membatalkan permintaan saat komponennya dilepas', () => {
    // Menyetel state pada komponen yang sudah dilepas memicu peringatan React.
    // Setting state on an unmounted component triggers a React warning.
    expect(roster).toContain('cancelled = true');
  });
});

describe('rekap tampil pada setiap jenis tugas', () => {
  it('ada pada tugas harian dan capstone', () => {
    expect(classPage.match(/<SubmissionRoster/g)?.length).toBe(2);
  });

  it('ada pada working paper', () => {
    expect(read('src/app/(admin)/admin/kelas/[classId]/session-working-paper.tsx'))
      .toContain('<SubmissionRoster');
  });

  it('disembunyikan untuk tugas yang belum terbit', () => {
    // Tugas yang belum terbit belum tampak oleh peserta, sehingga "0 dari 19"
    // hanya menyesatkan.
    //
    // An unpublished task is not visible to participants, so "0 of 19" only
    // misleads.
    expect(classPage).toMatch(/t\.published && \(/);
    expect(classPage).toMatch(/capstoneTask\.published && \(/);
  });

  it('menampilkan batas capstone dalam WIB, bukan ISO mentah', () => {
    // dueAt adalah ISO UTC; mentah ia memberi "2026-09-28T16:59:00.000Z".
    // dueAt is ISO UTC; raw it hands over "2026-09-28T16:59:00.000Z".
    expect(classPage).not.toMatch(/Deadline: \{capstoneTask\.dueAt\}/);
    expect(classPage).toContain('formatDateTimeWib(capstoneTask.dueAt)');
  });
});
