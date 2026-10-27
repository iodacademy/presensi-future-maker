import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const writeFile = vi.fn();
vi.mock('xlsx', async (importOriginal) => ({ ...(await importOriginal<typeof import('xlsx')>()), writeFile }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock('@/components/app-shell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import AdminTugasPage from '../../src/app/(admin)/admin/tugas/page';

const task = (id: string, title: string, kind: string, published = true) =>
  ({ id, title, kind, order: 1, dueAt: null, published, submitted: 1, graded: 0, late: 0 });

// Ekspor semua tugas memuat ketiga jenis dalam satu berkas / Exporting every task puts all three kinds in one file
describe('ekspor Excel semua tugas', () => {
  it('satu sheet per tugas terbit, berawalan jenisnya, urut hasil praktik → praktik mandiri → capstone', async () => {
    window.history.replaceState({}, '', '/admin/tugas?kelas=c1');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const body = url.startsWith('/api/classes')
        ? { classes: [{ id: 'c1', canonicalName: 'Web Programming - Semarang', studentCount: 2 }] }
        : url.startsWith('/api/tasks/summary')
          ? { studentCount: 2, tasks: [task('d1', 'Sesi 2', 'daily'), task('d2', 'Draf', 'daily', false), task('c1', 'Capstone', 'capstone'), task('w1', 'Sesi 2', 'working-paper')] }
          : { submitted: [{ studentName: 'Budi', firstSubmittedAt: '2026-10-01T00:00:00Z', url: 'https://github.com/budi', fileUrl: null, fileLost: false }], pending: [{ studentName: 'Ani' }] };
      return new Response(JSON.stringify(body), { status: 200 });
    }));

    render(<AdminTugasPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Ekspor Excel Semua Tugas/ }));
    await waitFor(() => expect(writeFile).toHaveBeenCalledTimes(1));

    const [wb, fileName] = writeFile.mock.calls[0];
    expect(fileName).toBe('Semua_Tugas_Web_Programming_-_Semarang.xlsx');
    expect(wb.SheetNames).toEqual(['HP 1. Sesi 2', 'PM 1. Sesi 2', 'CP 1. Capstone']);
    expect(wb.Sheets['HP 1. Sesi 2'].C1.v).toBe('Link Hasil Praktik');
    expect(wb.Sheets['CP 1. Capstone'].C1.v).toBe('Link Capstone');
    expect(wb.Sheets['PM 1. Sesi 2'].C2.l.Target).toBe('https://github.com/budi');
    expect(wb.Sheets['PM 1. Sesi 2'].C3.v).toBe('Belum mengumpulkan');
  });
});
