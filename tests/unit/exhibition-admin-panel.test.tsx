import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/pameran',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/components/ui/profile-menu', () => ({ ProfileMenu: () => null }));
vi.mock('@/components/app-shell', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/app-shell')>();
  return { AppShell: (p: { children: React.ReactNode; role: 'admin' }) => (globalThis as { __realShell?: boolean }).__realShell ? <real.AppShell {...p} /> : <div>{p.children}</div> };
});

import AdminPameranPage from '../../src/app/(admin)/admin/pameran/page';

const w = (id: string, cohort: string, over: Record<string, unknown> = {}) => ({
  id, title: `Karya ${id}`, type: 'Landing Page', cohort, personUid: 'u1', nickname: 'Budi',
  status: 'draft', aiAssisted: false, collectionId: null, thumb: '', ...over,
});
const rows = [w('w1', 'web-smg'), w('w2', 'web-smg'), w('w3', 'web-smg'), w('s1', 'smm-yk', { type: 'Reels' }), w('s2', 'smm-yk', { type: 'Reels' })];

function mockFetch(bulk: (body: unknown) => void) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/pameran/works/bulk') { bulk(JSON.parse(String(init?.body))); return new Response(JSON.stringify({ updated: 1 })); }
    const body = url === '/api/pameran/works' ? { works: rows }
      : url === '/api/pameran/people' ? { people: [] }
      : url === '/api/pameran/collections' ? { collections: [] } : {};
    return new Response(JSON.stringify(body));
  }));
}

afterEach(() => { cleanup(); (globalThis as { __realShell?: boolean }).__realShell = false; vi.unstubAllGlobals(); });

describe('panel admin Pameran, tab Karya', () => {
  it('Terbitkan semua yang tampil mengirim id hasil saringan saja', async () => {
    const bulk = vi.fn(); mockFetch(bulk);
    const confirm = vi.fn((_m: string) => true); vi.stubGlobal('confirm', confirm);
    render(<AdminPameranPage />);
    await screen.findByText('Karya w1');
    fireEvent.change(screen.getByLabelText('Kelas'), { target: { value: 'web-smg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Terbitkan semua yang tampil' }));
    await waitFor(() => expect(bulk).toHaveBeenCalled());
    expect(confirm.mock.calls[0][0]).toContain('3');
    expect(bulk).toHaveBeenCalledWith({ ids: ['w1', 'w2', 'w3'], patch: { status: 'published' } });
  });

  it('aksi massal label AI memakai baris yang dicentang', async () => {
    const bulk = vi.fn(); mockFetch(bulk);
    render(<AdminPameranPage />);
    await screen.findByText('Karya s2');
    fireEvent.click(screen.getByLabelText('Pilih Karya s2'));
    fireEvent.click(screen.getByRole('button', { name: 'Nyalakan label AI' }));
    await waitFor(() => expect(bulk).toHaveBeenCalled());
    expect(bulk).toHaveBeenCalledWith({ ids: ['s2'], patch: { aiAssisted: true } });
  });

  it('menu Pameran ada di sidebar admin', async () => {
    (globalThis as { __realShell?: boolean }).__realShell = true;
    mockFetch(vi.fn());
    render(<AdminPameranPage />);
    // Sidebar dan navigasi seluler sama-sama memuatnya / Sidebar and mobile nav both carry it
    const links = await screen.findAllByRole('link', { name: /Pameran/ });
    expect(links.every((l) => l.getAttribute('href') === '/admin/pameran')).toBe(true);
  });
});
