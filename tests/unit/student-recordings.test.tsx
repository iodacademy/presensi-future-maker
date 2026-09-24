// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page = readFileSync(resolve(process.cwd(), 'src/app/(student)/app/jadwal/page.tsx'), 'utf-8');

describe('halaman jadwal peserta', () => {
  it('menampilkan rekaman pada kartu sesi berlangsung maupun selesai', () => {
    // Sesi panjang dapat sudah memiliki rekaman sebagian sebelum berakhir.
    // Sebelumnya rekaman hanya muncul pada kartu sesi selesai, sehingga peserta
    // yang mencarinya di tengah sesi tidak menemukan apa pun.
    //
    // A long session may already have partial recordings before it ends.
    // Previously recordings appeared only on the finished-session card, so a
    // participant looking mid-session found nothing.
    const uses = page.match(/<RecordingLinks session=\{session\} \/>/g) ?? [];
    expect(uses.length).toBe(2);
  });

  it('menyediakan filter khusus rekaman', () => {
    // Tanpa filter, rekaman terkubur di dalam kartu masing-masing pertemuan dan
    // peserta harus menggulir seluruh jadwal.
    //
    // Without the filter, recordings sit buried inside each meeting's card and
    // participants must scroll the whole schedule.
    expect(page).toContain("filterMode === 'rekaman'");
    expect(page).toMatch(/recordedCount/);
  });

  it('menyembunyikan chip rekaman bila belum ada rekaman', () => {
    // Chip yang selalu tampil lalu menghasilkan daftar kosong hanya
    // membingungkan.
    //
    // A chip that always shows and then yields an empty list only confuses.
    expect(page).toMatch(/recordedCount > 0 && filterChip\('rekaman'/);
  });

  it('memberi pesan kosong yang sesuai konteks filternya', () => {
    expect(page).toContain('Belum ada rekaman yang diunggah');
  });

  it('memakai judul halaman yang menyebut rekaman', () => {
    // Label menu tetap "Jadwal": lima menu pada layar 360px menyisakan sekitar
    // 69px per tombol, sedangkan "Jadwal dan Rekaman" menuntut sekitar 94px.
    // Judul di dalam halaman punya ruang jauh lebih lega.
    //
    // The menu label stays "Jadwal": five items on a 360px screen leave about
    // 69px per button, while "Jadwal dan Rekaman" needs roughly 94px. The
    // in-page heading has far more room.
    expect(page).toContain('Jadwal dan Rekaman');
  });

  it('membuka tautan rekaman di tab baru dengan rel aman', () => {
    // target=_blank tanpa rel="noopener" memberi halaman tujuan akses ke
    // window.opener milik aplikasi.
    //
    // target=_blank without rel="noopener" hands the destination page access to
    // the application's window.opener.
    const block = page.slice(page.indexOf('function RecordingLinks'), page.indexOf('export default'));
    expect(block).toContain('target="_blank"');
    expect(block).toContain('rel="noopener noreferrer"');
  });
});

describe('label menu peserta', () => {
  it('tetap pendek agar tidak terpotong di layar sempit', () => {
    const shell = readFileSync(resolve(process.cwd(), 'src/components/student-shell.tsx'), 'utf-8');
    const labels = [...shell.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
    expect(labels.length).toBe(5);
    for (const label of labels) {
      // Sekitar 69px tersedia per tombol pada 360px dengan font 9px, kira-kira
      // 13 huruf.
      //
      // About 69px per button at 360px with a 9px font, roughly 13 characters.
      expect(label.length, label).toBeLessThanOrEqual(13);
    }
  });
});
