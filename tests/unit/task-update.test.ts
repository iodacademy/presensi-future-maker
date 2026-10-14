// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateTaskUpdate } from '@/features/tasks/policy';

/**
 * Perubahan tugas bersifat sebagian: admin yang memperbaiki judul tidak boleh
 * kehilangan batas waktu atau tautannya hanya karena keduanya tidak ikut
 * dikirim.
 *
 * A task update is partial: an admin fixing a title must not lose the deadline
 * or the link merely because neither was sent along.
 */
describe('validasi perubahan tugas', () => {
  it('hanya mengembalikan field yang dikirim', () => {
    const patch = validateTaskUpdate({ title: 'Judul Baru' });
    expect(patch).toEqual({ title: 'Judul Baru' });
    expect('dueAt' in patch).toBe(false);
    expect('briefUrl' in patch).toBe(false);
  });

  it('membedakan batas dikosongkan dari batas tidak diubah', () => {
    // Tanpa pembedaan ini admin tidak dapat mencabut batas yang salah.
    // Without this an admin cannot lift a wrong deadline.
    expect(validateTaskUpdate({ dueDate: null }).dueAt).toBe(null);
    expect('dueAt' in validateTaskUpdate({ title: 'X' })).toBe(false);
  });

  it('mengurai batas WIB menjadi ISO UTC', () => {
    // 23.59 WIB adalah 16.59 UTC di hari yang sama.
    // 23:59 WIB is 16:59 UTC on the same day.
    expect(validateTaskUpdate({ dueDate: '2026-09-28', dueTime: '23:59' }).dueAt)
      .toBe('2026-09-28T16:59:00.000Z');
  });

  it('memakai akhir hari bila jamnya tidak disebut', () => {
    expect(validateTaskUpdate({ dueDate: '2026-09-28' }).dueAt)
      .toBe('2026-09-28T16:59:00.000Z');
  });

  it('menolak judul kosong', () => {
    expect(() => validateTaskUpdate({ title: '   ' })).toThrow(/Judul tugas wajib/);
  });

  it('menolak tautan bukan HTTPS', () => {
    // Tautan dibuka peserta dari halaman aplikasi: http memicu peringatan
    // konten tidak aman dan javascript: dieksekusi di peramban mereka.
    //
    // Participants open the link from an application page: http triggers an
    // insecure-content warning and javascript: executes in their browser.
    expect(() => validateTaskUpdate({ briefUrl: 'http://contoh.id/a' })).toThrow(/HTTPS/);
    expect(() => validateTaskUpdate({ briefUrl: 'javascript:alert(1)' })).toThrow(/HTTPS/);
  });

  it('menerima tautan HTTPS dan membuang spasi', () => {
    expect(validateTaskUpdate({ briefUrl: '  https://docs.google.com/x  ' }).briefUrl)
      .toBe('https://docs.google.com/x');
  });

  it('mengosongkan tautan bila dikirim kosong', () => {
    expect(validateTaskUpdate({ briefUrl: '' }).briefUrl).toBe(null);
  });
});

describe('layanan perubahan tugas', () => {
  const service = readFileSync(resolve(process.cwd(), 'src/features/tasks/service.ts'), 'utf-8');
  const body = service.slice(
    service.indexOf('export async function updateTask'),
    service.indexOf('export', service.indexOf('export async function updateTask') + 10)
  );

  it('hanya mengizinkan admin', () => {
    expect(body).toContain("actor.role !== 'admin'");
  });

  it('menulis judul dan instruksi dalam satu batch', () => {
    // Judul tersimpan pada dokumen tugas, instruksinya pada dokumen detail
    // terpisah; dua penulisan terpisah dapat menampilkan judul baru dengan
    // instruksi lama.
    //
    // The title lives on the task document, the instructions on a separate
    // detail document; two separate writes could show a new title with old
    // instructions.
    expect(body).toContain('db.batch()');
    expect(body).toContain("collection('taskDetails')");
    expect(body).toMatch(/batch\.commit\(\)/);
  });

  it('menaikkan version agar peserta tahu isinya berubah', () => {
    expect(body).toMatch(/version: \(doc\.data\(\)\?\.version \|\| 1\) \+ 1/);
  });

  it('menolak tugas yang tidak ada', () => {
    expect(body).toContain('Tugas tidak ditemukan');
  });
});

describe('tampilan working paper admin', () => {
  const ui = readFileSync(
    resolve(process.cwd(), 'src/app/(admin)/admin/kelas/[classId]/session-working-paper.tsx'),
    'utf-8'
  );

  it('menyediakan kolom instruksi dan tautan', () => {
    expect(ui).toContain('INSTRUKSI PENGERJAAN');
    expect(ui).toContain('TAUTAN TEMPLATE ATAU BAHAN');
  });

  it('memakai satu formulir untuk tambah dan ubah', () => {
    // Dua formulir berarti dua tempat memperbaiki setiap kali fieldnya
    // berubah.
    //
    // Two forms would mean two places to fix whenever a field changes.
    const pemakaian = ui.match(/<PaperForm/g) ?? [];
    expect(pemakaian.length).toBe(2);
    expect(ui.match(/function PaperForm/g)?.length).toBe(1);
  });

  it('mengubah batas UTC ke WIB untuk formulir', () => {
    // Memotong ISO dengan slice menampilkan jam UTC, sehingga menyimpan ulang
    // menggeser batasnya tujuh jam setiap kali disunting.
    //
    // Slicing the ISO string shows UTC, so saving it back shifts the deadline
    // seven hours on every edit.
    // Konversinya kini di lib/time dan diuji langsung di task-edit.test.ts.
    // The conversion now lives in lib/time and is tested directly in task-edit.test.ts.
    expect(ui).toContain('toWibParts');
    expect(readFileSync(resolve(process.cwd(), 'src/lib/time.ts'), 'utf-8')).toMatch(/export function toWibParts[\s\S]*timeZone: 'Asia\/Jakarta'/);
  });

  it('mempertahankan baris baru pada instruksi', () => {
    // Tanpa ini instruksi berlangkah-langkah menyatu jadi satu paragraf.
    // Without this a step-by-step instruction collapses into one paragraph.
    expect(ui).toContain("whiteSpace: 'pre-wrap'");
  });

  it('membuka tautan di tab baru dengan rel aman', () => {
    expect(ui).toContain('rel="noopener noreferrer"');
  });

  it('memberi label aksesibel pada tombol ikon', () => {
    // Tombol berisi ikon saja tidak punya teks yang dapat dibacakan pembaca
    // layar.
    //
    // An icon-only button has no text for a screen reader to announce.
    for (const label of ['Ubah hasil praktik', 'Hapus hasil praktik', 'detail']) {
      expect(ui).toContain(label);
    }
  });
});

describe('endpoint perubahan tugas', () => {
  const route = readFileSync(
    resolve(process.cwd(), 'src/app/api/tasks/[taskId]/route.ts'),
    'utf-8'
  );

  it('menyediakan PATCH khusus admin', () => {
    expect(route).toContain('export async function PATCH');
    const body = route.slice(route.indexOf('export async function PATCH'));
    expect(body).toContain("actor.role !== 'admin'");
  });
});
