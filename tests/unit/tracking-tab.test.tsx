import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { TrackingTab } from '../../src/app/(admin)/admin/job-portal/tracking-tab';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const app = (id: string, jobId: string, status: string) => ({ id, jobId, status, submittedAt: '2026-11-10T00:00:00Z', completedAt: null, interview: null });
const insights = {
  programs: ['Social Media Marketing', 'Web Programming'],
  jobs: [
    { id: 'j1', title: 'Web Developer', partnerId: 'p1', partnerName: 'Ioda', picName: 'Rama', scheme: 'full', quota: 6, programs: [] },
    { id: 'j2', title: 'QA Tester', partnerId: 'p1', partnerName: 'Ioda', picName: 'Rama', scheme: 'full', quota: 2, programs: [] },
  ],
  students: [
    { studentId: 'a', name: 'Andi', className: 'Web Programming - Semarang', program: 'Web Programming', placement: 'full', apps: [app('x1', 'j1', 'interview'), app('x2', 'j2', 'baru')] },
    { studentId: 'b', name: 'Bela', className: 'Web Programming - Semarang', program: 'Web Programming', placement: 'full', apps: [] },
    { studentId: 'c', name: 'Caca', className: 'Web Programming - Semarang', program: 'Web Programming', placement: 'full', apps: [], placedAt: { partnerName: 'Mayar', position: 'DM Intern' }, acceptanceDoc: null },
    { studentId: 'd', name: 'Dodi', className: 'Web Programming - Semarang', program: 'Web Programming', placement: 'full', apps: [app('x3', 'j1', 'bergabung')], acceptanceDoc: { id: 'doc1', fileName: 'LoA.pdf', uploadedAt: '2026-11-13T00:00:00Z' } },
    { studentId: 'f', name: 'Fani', className: 'Web Programming - Semarang', program: 'Web Programming', placement: 'project', apps: [app('x4', 'j2', 'diterima'), app('x5', 'j1', 'tidak-lolos')] },
    { studentId: 'e', name: 'Eka', className: 'Social Media Marketing - Surabaya', program: 'Social Media Marketing', placement: 'project', apps: [] },
  ],
};

describe('tracking peserta per kelas', () => {
  it('menghitung belum melamar, sudah melamar, dan ditempatkan per kelas, beserta dokumennya', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ insights }), { status: 200 })));
    render(<TrackingTab onError={vi.fn()} />);
    fireEvent.change(await screen.findByRole('combobox', { name: 'Kelas' }), { target: { value: 'Web Programming - Semarang' } });
    expect(screen.getByRole('button', { name: 'Belum melamar (1)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Melamar, belum keterima (1)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sudah keterima (3)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Belum unggah dokumen (1)' })).toBeTruthy();
    const andi = screen.getByText('Andi').closest('tr')!;
    expect(within(andi).getByText('2 lamaran')).toBeTruthy();
    expect(within(andi).getByText('QA Tester')).toBeTruthy();
    const dodi = screen.getByText('Dodi').closest('tr')!;
    expect(within(dodi).getByRole('link', { name: 'Lihat dokumen' }).getAttribute('href')).toBe('/api/karier/cv/doc1');
    fireEvent.click(screen.getByRole('button', { name: 'Belum unggah dokumen (1)' }));
    expect(screen.getByText('Caca')).toBeTruthy();
    expect(screen.queryByText('Andi')).toBeNull();
  });

  it('bawaannya semua kelas; diterima yang belum konfirmasi dihitung keterima beserta tempatnya', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ insights }), { status: 200 })));
    render(<TrackingTab onError={vi.fn()} />);
    expect(((await screen.findByRole('combobox', { name: 'Kelas' })) as HTMLSelectElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'Belum melamar (2)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sudah keterima (3)' }));
    const fani = screen.getByText('Fani').closest('tr')!;
    expect(within(fani).getByText('QA Tester · Ioda')).toBeTruthy();
    expect(within(fani).getByText('Menunggu konfirmasi peserta')).toBeTruthy();
    expect(screen.queryByText('Andi')).toBeNull();
  });

  it('saring per perusahaan dan skema magang', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ insights }), { status: 200 })));
    render(<TrackingTab onError={vi.fn()} />);
    fireEvent.change(await screen.findByRole('combobox', { name: 'Perusahaan' }), { target: { value: 'Mayar' } });
    expect(screen.getByText('Caca')).toBeTruthy();
    expect(screen.queryByText('Andi')).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Perusahaan' }), { target: { value: 'Ioda' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Skema' }), { target: { value: 'project' } });
    expect(screen.getByText('Fani')).toBeTruthy();
    expect(screen.queryByText('Andi')).toBeNull();
    expect(screen.queryByText('Caca')).toBeNull();
  });
});
