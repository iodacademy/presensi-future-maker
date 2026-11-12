import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

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
});
