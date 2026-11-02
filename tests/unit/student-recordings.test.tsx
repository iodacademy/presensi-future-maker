// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page = readFileSync(resolve(process.cwd(), 'src/app/(student)/app/jadwal/page.tsx'), 'utf-8');

describe('halaman jadwal peserta (course player)', () => {
  it('menampilkan rekaman setiap pertemuan, termasuk yang sedang berlangsung', () => {
    // Sesi panjang dapat sudah memiliki rekaman sebagian sebelum berakhir.
    // Daftar rekaman tidak boleh digantungkan pada status sesi.
    //
    // A long session may already have partial recordings before it ends. The
    // recording list must not depend on the session's status.
    const builder = page.slice(page.indexOf('function buildGroups'), page.indexOf('function pickInitial'));
    expect(builder).toMatch(/recordings\.map/);
    expect(builder).not.toMatch(/isActive/);
  });

  it('memutar rekaman di tempat lewat penyedia yang dikenal saja', () => {
    // Situs lain umumnya menolak dibingkai; iframe kosong lebih membingungkan
    // daripada tombol buka di tab baru.
    //
    // Other sites usually refuse framing; a blank iframe confuses more than an
    // open-in-new-tab button.
    expect(page).toContain('toEmbedUrl(entry.url)');
    expect(page).toContain('Rekaman ini tidak dapat diputar langsung di sini.');
  });

  it('memuat seluruh tugas, termasuk yang tidak melekat pada pertemuan', () => {
    expect(page).toContain("fetch('/api/tasks/student/outline')");
    // Tugas tanpa pertemuan dibagi dua: Tugas Mandiri dan Capstone Project.
    // Tasks without a meeting split in two: Tugas Mandiri and Capstone Project.
    expect(page).toContain("title: 'Tugas Mandiri'");
    expect(page).toContain("title: 'Capstone Project'");
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

  it('membuka tautan di tab baru dengan rel aman', () => {
    // target=_blank tanpa rel="noopener" memberi halaman tujuan akses ke
    // window.opener milik aplikasi.
    //
    // target=_blank without rel="noopener" hands the destination page access to
    // the application's window.opener.
    const blank = page.match(/target="_blank"/g) ?? [];
    expect(blank.length).toBeGreaterThan(0);
    expect((page.match(/rel="noopener noreferrer"/g) ?? []).length).toBe(blank.length);
  });
});

describe('label menu peserta', () => {
  it('tetap pendek agar tidak terpotong di layar sempit', () => {
    const shell = readFileSync(resolve(process.cwd(), 'src/components/student-shell.tsx'), 'utf-8');
    const labels = [...shell.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
    expect(labels.length).toBe(6);
    for (const label of labels) {
      // Enam menu (Karier ditambahkan) menyisakan sekitar 57px per tombol pada
      // 360px dengan font 9px, kira-kira 11 huruf.
      //
      // Six items (Karier added) leave about 57px per button at 360px with a
      // 9px font, roughly 11 characters.
      expect(label.length, label).toBeLessThanOrEqual(11);
    }
  });
});
