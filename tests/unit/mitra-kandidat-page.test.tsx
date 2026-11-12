import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock('../../src/app/(mitra)/mitra/shell', async (orig) => ({ ...(await orig<object>()), MitraShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
import KandidatPage from '../../src/app/(mitra)/mitra/kandidat/page';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const row = (id: string, status: string) => ({ id, number: id, fullName: id, className: '', finalScore: 80, finalScorePending: false, submittedAt: '2026-11-10T00:00:00Z', status });

describe('halaman kandidat PIC', () => {
  it('menampilkan kuota lowongan, kursi terisi, jumlah pelamar, dan skemanya', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/candidates')
      ? json({ candidates: [row('a', 'baru'), row('b', 'diterima'), row('c', 'bergabung'), row('d', 'tidak-lolos')] })
      : json({ jobs: [{ id: 'j1', title: 'Web Developer', quota: 4, scheme: 'full', applicantCount: 4, state: 'aktif', closesAt: '2026-11-12T16:59:00Z' }] })));
    window.history.replaceState(null, '', '/mitra/kandidat');
    render(<KandidatPage />);
    expect(await screen.findByText('Kuota 4 kursi')).toBeTruthy();
    expect(await screen.findByText('Terisi 2 dari 4')).toBeTruthy();
    expect(screen.getByText('4 pelamar')).toBeTruthy();
    expect(screen.getByText('Full Internship')).toBeTruthy();
  });
});
