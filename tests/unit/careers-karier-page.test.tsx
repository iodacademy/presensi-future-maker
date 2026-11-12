import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/components/student-shell', () => ({ StudentShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
import KarierPage from '../../src/app/(student)/app/karier/page';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('halaman Karier siswa', () => {
  it('kartu tier dimuat ulang setelah tawaran dijawab, karena jalur dan kuota ikut berubah', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/karier/lowongan')) return json({ access: true, jobs: [], appliedJobIds: [], bannerClosesAt: null, standing: { track: 'full', tier: 'A', locked: false, quota: 5, used: 1 } });
      if (url.includes('/tawaran')) return json({});
      return json({ applications: [{ id: 'a1', jobId: 'j1', number: 'FM-1', jobTitle: 'Video', partnerName: 'PT X', status: 'diterima', statusLabel: 'Lolos', submittedAt: '1', message: null, interview: null, picWaLink: null, scheme: 'project' }] });
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/app/karier?tab=lamaran');
    render(<KarierPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Terima tawaran' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ya, terima tawaran' }));
    const lowongan = () => fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/karier/lowongan')).length;
    await waitFor(() => expect(lowongan()).toBe(2));
  });

  it('peserta yang sudah ditempatkan melihat tempat magangnya, bukan kuota lamaran', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/api/karier/lowongan')) return json({ access: true, jobs: [], appliedJobIds: [], bannerClosesAt: null, standing: { track: 'full', tier: 'C', locked: true, quota: 2, used: 0, placedAt: { partnerName: 'PT Mayar Kernel Supernova', position: 'Digital Marketing Intern' } } });
      return json({ applications: [] });
    }));
    window.history.replaceState(null, '', '/app/karier');
    render(<KarierPage />);
    expect(await screen.findByText('Ditempatkan magang')).toBeTruthy();
    expect(screen.getByText('Digital Marketing Intern · PT Mayar Kernel Supernova')).toBeTruthy();
    expect(screen.queryByText(/Kuota/)).toBeNull();
  });
});

