import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const writeFile = vi.hoisted(() => vi.fn());
const jsonToSheet = vi.hoisted(() => vi.fn((rows: unknown) => ({ rows })));
vi.mock('xlsx', () => ({ utils: { book_new: () => ({}), json_to_sheet: jsonToSheet, book_append_sheet: vi.fn() }, writeFile }));
import { PassedExportButton } from '../../src/app/(admin)/admin/job-portal/passed-export';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('ekspor peserta lolos', () => {
  it('satu tabel dengan kolom yang diminta admin', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ rows: [
      { name: 'Andi', email: 'a@x.id', phone: '0812', status: 'Menerima tawaran', company: 'Ioda', address: 'Jakarta Selatan', role: 'Web Developer', salary: 'Rp 1.000.000 / bulan', tasks: 'Membangun web' },
    ] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PassedExportButton onError={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ekspor peserta lolos' }));
    await waitFor(() => expect(writeFile).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe('/api/karier/export/lolos');
    const sheet = jsonToSheet.mock.calls[0][0] as Record<string, unknown>[];
    expect(Object.keys(sheet[0])).toEqual(['Nama peserta', 'Email', 'WA', 'LOLOS', 'PT', 'Alamat perusahaan', 'Role', 'Gaji', 'Tugas']);
    expect(sheet[0]).toMatchObject({ 'Nama peserta': 'Andi', WA: '0812', LOLOS: 'Menerima tawaran', PT: 'Ioda', Gaji: 'Rp 1.000.000 / bulan', Tugas: 'Membangun web' });
  });
});
