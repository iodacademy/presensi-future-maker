import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
import { OfferCard } from '../../src/app/(student)/app/karier/offer-card';
import { InterviewCard } from '../../src/app/(student)/app/karier/interview-card';

afterEach(() => { cleanup(); refresh.mockClear(); vi.unstubAllGlobals(); });
const ok = () => vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })));

describe('jawaban siswa memperbarui notifikasi', () => {
  it('menerima tawaran memuat ulang data halaman agar lonceng dan angka menu ikut berubah', async () => {
    ok();
    const onAnswered = vi.fn();
    render(<OfferCard appId="a1" jobTitle="Data Analyst" partnerName="PT DIPSI" onAnswered={onAnswered} />);
    fireEvent.click(screen.getByRole('button', { name: 'Terima tawaran' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ya, terima tawaran' }));
    await waitFor(() => expect(onAnswered).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();
  });

  it('konfirmasi hadir juga memuat ulang data halaman', async () => {
    ok();
    render(<InterviewCard appId="a1" partnerName="PT DIPSI" interview={{
      date: '2026-11-12', start: '10:00', durationMin: 45, mode: 'online', linkSource: 'manual', url: 'https://zoom.us/j/1', address: '',
      interviewer: 'Rina', note: '', confirmation: 'pending', rescheduleNote: '', invitedAt: '2026-11-09T00:00:00Z',
    }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi hadir' }));
    await waitFor(() => expect(screen.getByText(/sudah konfirmasi hadir/)).toBeTruthy());
    expect(refresh).toHaveBeenCalled();
  });
});
