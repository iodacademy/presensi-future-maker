import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: () => void }) => <a href={href} onClick={onClick}>{children}</a> }));
import { RejectionPopup } from '../../src/app/(student)/app/rejection-popup';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const card = (id: string, title: string) => ({ id, title, partnerId: 'p1', partnerName: 'PT DIPSI', scheme: 'full', salary: 750000, durationMonths: null, closesAt: '2026-11-25T16:59:00.000Z' });

describe('pop-up lamaran tidak lolos', () => {
  it('menampilkan lamaran yang tidak lolos dan saran lowongan, lalu menandai sudah dilihat saat ditutup', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return init?.method === 'POST' ? json({ ok: true }) : json({
        rejections: [{ id: 'a1', jobTitle: 'Graphic Designer', partnerName: 'Ioda Academy' }],
        suggestions: [card('j1', 'Content Writer B2B'), card('j2', 'Sosmed')], blocked: null,
      });
    }));
    await act(async () => { render(<RejectionPopup />); });
    const dialog = await screen.findByRole('dialog', { name: 'Lamaranmu belum lolos' });
    expect(dialog.textContent).toContain('Graphic Designer · Ioda Academy');
    expect(screen.getByRole('link', { name: /Content Writer B2B/ }).getAttribute('href')).toBe('/app/karier/j1');
    fireEvent.click(screen.getByRole('button', { name: 'Tutup' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const post = calls.find((c) => c.init?.method === 'POST')!;
    expect(post.url).toBe('/api/karier/penolakan');
    expect(JSON.parse(String(post.init?.body))).toEqual({ ids: ['a1'] });
  });

  it('tidak muncul bila tidak ada lamaran tidak lolos yang baru', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ rejections: [], suggestions: [], blocked: null })));
    await act(async () => { render(<RejectionPopup />); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('jatah lamaran penuh: menampilkan alasannya, bukan saran', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ rejections: [{ id: 'a1', jobTitle: 'X', partnerName: 'Y' }], suggestions: [], blocked: 'Kuota lamaranmu sedang penuh.' })));
    await act(async () => { render(<RejectionPopup />); });
    expect((await screen.findByRole('dialog')).textContent).toContain('Kuota lamaranmu sedang penuh.');
  });
});
