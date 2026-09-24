import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { DeleteDialog } from '../../src/components/ui/delete-dialog';

const impact = {
  label: 'Tugas 1 - Intro React',
  cascade: [
    { collection: 'Pengumpulan tugas peserta', count: 12, destroysWork: true },
    { collection: 'Nilai dan umpan balik', count: 8, destroysWork: true },
  ],
};

function mockFetch(overrides: Partial<Record<string, unknown>> = {}) {
  return vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: async () => ({ deleted: true }) } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({ ...impact, ...overrides }) } as Response);
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DeleteDialog', () => {
  it('menampilkan jumlah hasil kerja peserta yang ikut terhapus', async () => {
    render(<DeleteDialog endpoint="/api/tasks/t1" entityLabel="Tugas" onClose={() => {}} onDeleted={() => {}} />);
    expect(await screen.findByText(/Hasil kerja peserta ikut terhapus/i)).toBeDefined();
    expect(screen.getByText(/12 pengumpulan tugas peserta/i)).toBeDefined();
  });

  it('menahan tombol hapus sampai nama diketik persis', async () => {
    // Satu klik keliru tidak dapat dibatalkan, jadi tombol tidak boleh aktif
    // sebelum admin membaca dan mengetik ulang nama yang dihapus.
    //
    // One wrong click cannot be undone, so the button must stay inert until the
    // admin has read and retyped the name being deleted.
    render(<DeleteDialog endpoint="/api/tasks/t1" entityLabel="Tugas" onClose={() => {}} onDeleted={() => {}} />);
    await screen.findByText(/Hasil kerja peserta/i);

    const button = screen.getByRole('button', { name: /Hapus permanen/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Tugas 1' } });
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Tugas 1 - Intro React' } });
    expect(button.disabled).toBe(false);
  });

  it('memanggil onDeleted setelah penghapusan berhasil', async () => {
    const onDeleted = vi.fn();
    render(<DeleteDialog endpoint="/api/tasks/t1" entityLabel="Tugas" onClose={() => {}} onDeleted={onDeleted} />);
    await screen.findByText(/Hasil kerja peserta/i);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Tugas 1 - Intro React' } });
    fireEvent.click(screen.getByRole('button', { name: /Hapus permanen/i }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it('menyatakan tidak ada data terkait bila hitungannya nol', async () => {
    vi.stubGlobal('fetch', mockFetch({ cascade: [{ collection: 'Pengumpulan tugas peserta', count: 0, destroysWork: true }] }));
    render(<DeleteDialog endpoint="/api/tasks/t1" entityLabel="Tugas" onClose={() => {}} onDeleted={() => {}} />);
    expect(await screen.findByText(/Belum ada data lain yang terkait/i)).toBeDefined();
  });

  it('tidak menghapus apa pun sebelum ringkasan dampak termuat', () => {
    // Tanpa ringkasan, admin tidak tahu apa yang hilang; tombol harus mati.
    // Without the summary the admin cannot know what is lost; the button stays dead.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<DeleteDialog endpoint="/api/tasks/t1" entityLabel="Tugas" onClose={() => {}} onDeleted={() => {}} />);
    const button = screen.getByRole('button', { name: /Hapus permanen/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
