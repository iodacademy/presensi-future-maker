import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const writeFile = vi.hoisted(() => vi.fn());
const jsonToSheet = vi.hoisted(() => vi.fn((rows: unknown) => ({ rows })));
vi.mock('xlsx', () => ({ utils: { book_new: () => ({}), json_to_sheet: jsonToSheet, book_append_sheet: vi.fn() }, writeFile }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
import { JobsTab } from '../../src/app/(admin)/admin/job-portal/jobs-tab';

afterEach(cleanup);

const row = (id: string, quota: number, demo = false) => ({
  id, title: `Posisi ${id}`, employment: 'magang-3', category: 'teknologi', scheme: 'full', location: 'Remote', workMode: 'remote', quota,
  partnerId: 'p', partnerName: 'PT X', picName: 'Rina', opensAt: '2026-11-10T01:00:00.000Z', closesAt: '2026-11-12T16:59:00.000Z',
  status: 'published', applicantCount: 0, demo,
}) as never;

describe('tabel lowongan admin', () => {
  it('menampilkan kuota tiap lowongan dan total kuota tanpa lowongan demo', () => {
    render(<JobsTab rows={[row('a', 4), row('b', 2), row('c', 2, true)]} onEdit={vi.fn()} onChanged={vi.fn()} onError={vi.fn()} />);
    expect(screen.getByRole('columnheader', { name: 'Kuota' })).toBeTruthy();
    expect(screen.getByText('Total kuota: 6 kursi dari 2 lowongan')).toBeTruthy();
  });

  it('pencarian menyaring lowongan menurut posisi, perusahaan, atau PIC', () => {
    const rows = [row('a', 4), { ...(row('b', 2) as object), title: 'KOL Specialist', partnerName: 'Ioda Academy', picName: 'Budi' } as never];
    render(<JobsTab rows={rows} onEdit={vi.fn()} onChanged={vi.fn()} onError={vi.fn()} />);
    const search = screen.getByRole('searchbox', { name: 'Cari lowongan' });
    fireEvent.change(search, { target: { value: 'ioda' } });
    expect(screen.queryByText('Posisi a')).toBeNull();
    expect(screen.getByText('KOL Specialist')).toBeTruthy();
    fireEvent.change(search, { target: { value: 'budi' } });
    expect(screen.getByText('KOL Specialist')).toBeTruthy();
    fireEvent.change(search, { target: { value: 'tidak ada' } });
    expect(screen.getByText('Tidak ada lowongan yang cocok.')).toBeTruthy();
  });

  it('ekspor pelamar dari lowongan yang dicentang, bisa disaring per perusahaan, ke satu tabel', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ rows: [
      { name: 'Andi', email: 'a@x.id', capstone: 85, cvId: 'cv1', role: 'Posisi a', company: 'PT X', interview: { date: '2026-11-13', start: '10:00', durationMin: 45 } },
      { name: 'Bela', email: 'b@x.id', capstone: null, cvId: 'cv2', role: 'KOL', company: 'Ioda', interview: null },
    ] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const rows = [row('a', 4), { ...(row('b', 2) as object), title: 'KOL', partnerName: 'Ioda' } as never, row('c', 1)];
    render(<JobsTab rows={rows} onEdit={vi.fn()} onChanged={vi.fn()} onError={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Perusahaan' }), { target: { value: 'PT X' } });
    expect(screen.queryByText('KOL')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pilih Posisi a' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Perusahaan' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pilih KOL' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ekspor pelamar (2 lowongan)' }));
    await waitFor(() => expect(writeFile).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe('/api/karier/export?jobs=a,b');
    const sheet = jsonToSheet.mock.calls[0][0] as Record<string, unknown>[];
    expect(Object.keys(sheet[0])).toEqual(['Nama', 'Email', 'Nilai capstone', 'CV', 'Role', 'Perusahaan', 'Tanggal interview']);
    expect(sheet[0]).toMatchObject({ Nama: 'Andi', 'Nilai capstone': 85, Role: 'Posisi a', Perusahaan: 'PT X' });
    expect(String(sheet[0]['Tanggal interview'])).toMatch(/13 November 2026, 10\.00–10\.45 WIB/);
    expect(String(sheet[0].CV)).toMatch(/\/api\/karier\/cv\/cv1$/);
    expect(sheet[1]).toMatchObject({ 'Nilai capstone': 'Belum dinilai', 'Tanggal interview': '' });
    vi.unstubAllGlobals();
  });
});

