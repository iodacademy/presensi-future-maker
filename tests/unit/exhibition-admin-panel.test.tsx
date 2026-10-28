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

  it('aksi massal tidak mengirim baris terpilih yang tersembunyi oleh saringan', async () => {
    const bulk = vi.fn(); mockFetch(bulk);
    render(<AdminPameranPage />);
    await screen.findByText('Karya s2');
    fireEvent.click(screen.getByLabelText('Pilih Karya s2'));
    fireEvent.click(screen.getByLabelText('Pilih Karya w1'));
    fireEvent.change(screen.getByLabelText('Kelas'), { target: { value: 'web-smg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Nyalakan label AI' }));
    await waitFor(() => expect(bulk).toHaveBeenCalled());
    expect(bulk).toHaveBeenCalledWith({ ids: ['w1'], patch: { aiAssisted: true } });
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

const person = { uid: 'u1', fullName: 'Budi Santoso', nickname: 'Budi', cohort: 'web-smg', visible: true, photoUrl: '', mainWorkId: null, workCount: 2 };
function mockContent(patch: (url: string, body: unknown) => void, collections: unknown[] = []) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method) { patch(url, JSON.parse(String(init.body))); return new Response(JSON.stringify({ ok: true, id: 'c9' })); }
    const body = url === '/api/pameran/people/u1' ? { person: { ...person, bio: 'Bio tersimpan', skills: ['HTML', 'CSS'], linkedinUrl: 'https://li/x', portfolioUrl: '', mainWorkId: null } }
      : url === '/api/pameran/people' ? { people: [person] }
      : url === '/api/pameran/works' ? { works: [w('w1', 'web-smg'), w('x1', 'web-smg', { personUid: 'u2' })] }
      : url === '/api/pameran/collections' ? { collections }
      : url === '/api/pameran/site' ? { content: { photos: {}, videos: { afterMovie: '', trainer: {}, plan: '' }, testiPeserta: [], testiTrainer: [], testiPlan: { name: '', role: '', quote: '' } } } : {};
    return new Response(JSON.stringify(body));
  }));
}
const openTab = (key: string) => window.history.replaceState(null, '', `/admin/pameran?tab=${key}`);

describe('panel admin Pameran, tab Peserta, Koleksi, Konten Situs', () => {
  it('form peserta mengirim patch nama panggilan dan tampil', async () => {
    const patch = vi.fn(); mockContent(patch); openTab('peserta');
    render(<AdminPameranPage />);
    await screen.findByText('Budi Santoso');
    fireEvent.click(screen.getByRole('button', { name: 'Ubah' }));
    fireEvent.change(await screen.findByLabelText('Nama panggilan'), { target: { value: 'Dinda' } });
    fireEvent.click(screen.getByLabelText('Tampil di pameran'));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch).toHaveBeenCalledWith('/api/pameran/people/u1', { nickname: 'Dinda', visible: false });
  });

  it('karya utama hanya menawarkan karya milik peserta itu', async () => {
    mockContent(vi.fn()); openTab('peserta');
    render(<AdminPameranPage />);
    await screen.findByText('Budi Santoso');
    fireEvent.click(screen.getByRole('button', { name: 'Ubah' }));
    const select = await screen.findByLabelText('Karya utama');
    await waitFor(() => expect(select.querySelectorAll('option').length).toBe(2));
    expect(screen.getByRole('option', { name: 'Karya w1' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Karya x1' })).toBeNull();
  });

  it('koleksi baru dikirim dengan judul, kelas, dan jenis', async () => {
    const patch = vi.fn(); mockContent(patch); openTab('koleksi');
    render(<AdminPameranPage />);
    fireEvent.change(await screen.findByLabelText('Judul koleksi'), { target: { value: 'Konten Mei' } });
    fireEvent.change(screen.getByLabelText('Kelas koleksi'), { target: { value: 'smm-yk' } });
    fireEvent.change(screen.getByLabelText('Jenis koleksi'), { target: { value: 'Reels' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buat koleksi' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch).toHaveBeenCalledWith('/api/pameran/collections', { title: 'Konten Mei', brief: '', cohort: 'smm-yk', type: 'Reels', classId: '', coverUrls: [] });
  });

  it('konten situs menyimpan tautan video after movie', async () => {
    const patch = vi.fn(); mockContent(patch); openTab('situs');
    render(<AdminPameranPage />);
    fireEvent.change(await screen.findByLabelText('Video after movie'), { target: { value: 'https://youtu.be/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan konten situs' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [url, body] = patch.mock.calls[0];
    expect(url).toBe('/api/pameran/site');
    expect((body as { videos: { afterMovie: string } }).videos.afterMovie).toBe('https://youtu.be/x');
  });

  it('formulir peserta menampilkan bio dan keahlian yang sudah tersimpan', async () => {
    mockContent(vi.fn()); openTab('peserta');
    render(<AdminPameranPage />);
    await screen.findByText('Budi Santoso');
    fireEvent.click(screen.getByRole('button', { name: 'Ubah' }));
    await waitFor(() => expect((screen.getByLabelText(/^Bio/) as HTMLTextAreaElement).value).toBe('Bio tersimpan'));
    expect((screen.getByLabelText(/^Keahlian/) as HTMLInputElement).value).toBe('HTML, CSS');
  });
});

describe('slot foto admin', () => {
  it('memuat slot kenangan, momen, dan kelas yang dirender halaman dokumentasi', async () => {
    const { buildSlots } = await import('../../src/app/(admin)/admin/pameran/site-tab');
    const ids = new Set(buildSlots().map((s) => s.id));
    for (const k of ['web-smg', 'da-jkt', 'smm-yk', 'smm-sby']) {
      for (const sec of ['kenangan', 'momen', 'hero', 'film', 'bento']) expect(ids.has(`doc-${k}-${sec}-0`), `${k}-${sec}`).toBe(true);
      expect(ids.has(`doc-${k}-kelas-2`)).toBe(true);
    }
    expect(ids.has('doc-web-smg-kenangan-5')).toBe(true);
  });
});
