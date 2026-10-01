// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const service = read('src/features/survey/service.ts');
const attendance = read('src/features/attendance/service.ts');
const jadwal = read('src/app/(student)/app/jadwal/page.tsx');
const settings = read('src/app/(admin)/admin/pengaturan/page.tsx');
const shell = read('src/components/app-shell.tsx');

function fungsi(nama: string): string {
  const mulai = service.indexOf(`export async function ${nama}`);
  if (mulai === -1) throw new Error(`fungsi ${nama} tidak ditemukan`);
  const berikut = service.indexOf('\nexport ', mulai + 1);
  return service.slice(mulai, berikut === -1 ? service.length : berikut);
}

/**
 * Satu formulir dipakai seluruh kelas dan seluruh pertemuan.
 *
 * Menyalinnya ke tiap sesi berarti menyunting lima puluh lima salinan setiap
 * kali satu kata berubah. Sesi mana yang dinilai dicatat pada jawabannya.
 *
 * One form serves every class and every meeting.
 *
 * Copying it into each session would mean editing fifty-five copies each time
 * one word changes. Which session is being rated is recorded on the response.
 */
describe('satu formulir untuk semua pertemuan', () => {
  it('memakai satu dokumen berid tetap', () => {
    expect(service).toMatch(/const FORM_ID = 'default'/);
  });

  it('mencatat sesi pada jawabannya, bukan pada formulirnya', () => {
    const blok = fungsi('submitSurveyResponse');
    expect(blok).toContain('sessionId,');
    expect(blok).toContain('sessionTitle: session.title');
    expect(read('src/features/survey/types.ts')).not.toMatch(/SurveyFormDocument[\s\S]{0,400}sessionId/);
  });

  it('mengembalikan formulir kosong alih-alih null', () => {
    // Halaman pengaturan menampilkan formulir yang sama baik sudah ada maupun
    // belum; null akan memaksa setiap pemanggil menanganinya sendiri.
    //
    // The settings page renders the same form whether or not it exists; null
    // would force every caller to handle that case.
    expect(fungsi('getSurveyForm')).toContain('return KOSONG');
  });
});

describe('syarat kehadiran', () => {
  it('menolak pengisian tanpa presensi tercatat', () => {
    // Peserta yang tidak hadir tidak punya pengalaman pertemuan itu untuk
    // dinilai, dan jawabannya mencemari rekap.
    //
    // Someone who did not attend has no experience of that meeting to rate,
    // and their answers pollute the report.
    const blok = fungsi('submitSurveyResponse');
    expect(blok).toMatch(/attendance'\)\.doc\(`\$\{sessionId\}_\$\{actor\.uid\}`\)/);
    expect(blok).toContain('setelah kehadiran Anda');
  });

  it('menyembunyikan barisnya bagi yang belum presensi', () => {
    // Menagihnya meninggalkan tagihan yang tidak pernah dapat ia selesaikan.
    // Asking them leaves a demand they can never satisfy.
    const blok = attendance.slice(
      attendance.indexOf('export async function listStudentSessionsWithAttendance'),
      attendance.indexOf('export', attendance.indexOf('export async function listStudentSessionsWithAttendance') + 10)
    );
    expect(blok).toMatch(/surveyForm\?\.published && attendMap\.has\(s\.id\)/);
  });

  it('menjaganya di layanan, bukan hanya di tampilan', () => {
    // Baris yang disembunyikan tidak menahan siapa pun yang memanggil
    // endpointnya langsung.
    //
    // A hidden row holds back nobody who calls the endpoint directly.
    expect(fungsi('submitSurveyResponse')).toContain('attendanceSnap.exists');
  });
});

describe('perubahan formulir tidak merusak rekap lama', () => {
  it('menaikkan versi hanya bila pertanyaannya berubah', () => {
    // Mengubah judul saja tidak membuat jawaban lama menjadi versi berbeda.
    // Changing only the title must not make old answers a different version.
    const blok = fungsi('updateSurveyForm');
    expect(blok).toMatch(/const berubah = patch\.questions !== undefined/);
    expect(blok).toMatch(/version: berubah \? current\.version \+ 1 : current\.version/);
  });

  it('mencatat versinya pada tiap jawaban', () => {
    expect(fungsi('submitSurveyResponse')).toContain('formVersion: form.version');
  });

  it('menurunkan penerbitan bila pertanyaan terakhirnya dihapus', () => {
    // Formulir kosong yang terbit menagih peserta mengisi layar kosong.
    // A published empty form asks participants to fill in an empty screen.
    expect(fungsi('removeSurveyQuestion')).toMatch(/questions\.length === 0 \? \{ published: false \}/);
  });
});

describe('satu jawaban per peserta per pertemuan', () => {
  it('memakai id gabungan sesi dan peserta', () => {
    // Ketukan ganda tidak boleh menggandakan rekapnya.
    // A double tap must not double the report.
    expect(fungsi('submitSurveyResponse')).toMatch(/const id = `\$\{sessionId\}_\$\{actor\.uid\}`/);
  });
});

describe('tempat survei pada antarmuka', () => {
  it('berdampingan dengan kuis pada kartu pertemuan', () => {
    expect(jadwal).toMatch(/survey && \(/);
    expect(jadwal).toContain('/app/survei/');
  });

  it('membedakan yang sudah terisi dari yang belum', () => {
    expect(jadwal).toContain("survey.submitted ? 'Terisi' : 'Wajib diisi'");
  });

  it('pengaturan bertab sejak awal', () => {
    // Menambah tab kedua kelak tidak menuntut membongkar halaman yang
    // terlanjur berbentuk satu kolom tunggal.
    //
    // Adding a second tab later then does not require tearing apart a page
    // already shaped as a single column.
    expect(settings).toMatch(/const TABS: \[SettingsTab, string\]\[\]/);
    expect(settings).toContain("aria-current={active ? 'page' : undefined}");
  });

  it('pengaturan tercantum pada menu admin', () => {
    expect(shell).toContain("href: '/admin/pengaturan'");
  });

  it('menyebut jumlah pertanyaan wajib yang belum dijawab', () => {
    // Tombol yang tidak merespons tanpa keterangan tidak memberi tahu apa yang
    // kurang.
    //
    // A button that does nothing without explanation does not say what is
    // missing.
    const halaman = read('src/app/(student)/app/survei/[sessionId]/page.tsx');
    expect(halaman).toContain('pertanyaan wajib belum dijawab');
  });
});
