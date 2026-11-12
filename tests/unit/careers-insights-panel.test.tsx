import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { InsightsPanel } from '../../src/app/(admin)/admin/job-portal/insights-panel';

const insights = {
  programs: ['Digital Marketing', 'Web Programming'],
  jobs: [
    { id: 'j1', title: 'Web Dev', partnerId: 'p1', partnerName: 'PT A', picName: 'Rina', scheme: 'full', quota: 3, programs: ['Web Programming'] },
    { id: 'j2', title: 'KOL Specialist', partnerId: 'p2', partnerName: 'Ioda Academy', picName: 'Budi', scheme: 'project', quota: 5, programs: ['Digital Marketing'] },
  ],
  students: [
    { studentId: 's1', name: 'Andi', className: 'Web Programming - Semarang', program: 'Web Programming', placement: 'full', apps: [
      { id: 'a1', jobId: 'j1', status: 'interview', submittedAt: '2026-11-10T00:00:00Z', completedAt: null,
        interview: { date: '2026-11-13', start: '10:00', durationMin: 30, confirmation: 'hadir', interviewer: 'Rina' } },
    ] },
    { studentId: 's2', name: 'Bela', className: 'Digital Marketing - Surabaya', program: 'Digital Marketing', placement: 'project', apps: [] },
  ],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ insights }) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('panel ringkasan Job Portal', () => {
  it('menampilkan posisi, peserta yang melamar, dan filter jurusan', async () => {
    render(<InsightsPanel reloadKey={1} onError={vi.fn()} />);
    const posisi = (await screen.findByText('Total posisi (kuota)')).parentElement!;
    expect(within(posisi).getByText('8')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Jurusan' }), { target: { value: 'Web Programming' } });
    expect(within(posisi).getByText('3')).toBeTruthy();
    expect(screen.getByText('1/1')).toBeTruthy();
  });

  it('klik kartu membuka detail peserta beserta lamaran dan jadwal interview', async () => {
    render(<InsightsPanel reloadKey={1} onError={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Sudah melamar/ }));
    expect(screen.getByText('Andi')).toBeTruthy();
    expect(screen.getByText(/Interview Jumat, 13 November 2026/)).toBeTruthy();
    expect(screen.getByText(/kandidat konfirmasi hadir/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Belum melamar/ }));
    expect(screen.getByText('Bela')).toBeTruthy();
    expect(screen.queryByText('Andi')).toBeNull();
  });
});
