import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InviteForm } from '../../src/app/(mitra)/mitra/kandidat/[id]/invite-form';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('formulir undangan interview', () => {
  it('link sendiri memunculkan isian link, lalu tombol WhatsApp tampil setelah terkirim', async () => {
    let sent: Record<string, unknown> | null = null;
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      sent = { url, ...JSON.parse(String(init?.body)) };
      return Promise.resolve(new Response(JSON.stringify({ waLink: 'https://wa.me/6281234567890?text=halo', meetUrl: 'https://zoom.us/j/1' })));
    }));
    const onSent = vi.fn();
    render(<InviteForm appId="a1" defaultInterviewer="Rina Kusuma" onSent={onSent} />);
    expect(screen.queryByLabelText(/Link meeting/)).toBeNull();
    fireEvent.click(screen.getByLabelText('Pakai link sendiri'));
    fireEvent.change(screen.getByLabelText(/Link meeting/), { target: { value: 'https://zoom.us/j/1' } });
    fireEvent.change(screen.getByLabelText('Tanggal'), { target: { value: '2026-11-12' } });
    fireEvent.change(screen.getByLabelText('Jam mulai (WIB)'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim undangan' }));
    const wa = await screen.findByRole('link', { name: /Kirim lewat WhatsApp/ });
    expect(wa.getAttribute('href')).toBe('https://wa.me/6281234567890?text=halo');
    expect(sent).toMatchObject({ url: 'https://zoom.us/j/1', linkSource: 'manual', mode: 'online', date: '2026-11-12', start: '10:00', durationMin: 45, interviewer: 'Rina Kusuma' });
    expect(onSent).toHaveBeenCalled();
  });

  it('hanya wawancara daring: tidak ada pilihan offline maupun isian alamat kantor', () => {
    render(<InviteForm appId="a1" defaultInterviewer="Rina Kusuma" />);
    expect(screen.queryByText(/Offline/)).toBeNull();
    expect(screen.queryByLabelText(/Alamat kantor/)).toBeNull();
  });
});
