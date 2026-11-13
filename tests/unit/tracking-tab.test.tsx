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
    { studentId: 'e', name: 'Eka', className: 'Social Media Marketing - Surabaya', program: 'Social Media Marketing', placement: 'project', apps: [] },
  ],
};

describe('tracking peserta per kelas', () => {
  it('menghitung belum melamar, sudah melamar, dan ditempatkan per kelas, beserta dokumennya', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ insights }), { status: 200 })));
    render(<TrackingTab onError={vi.fn()} />);
    fireEvent.change(await screen.findByRole('combobox', { name: 'Kelas' }), { target: { value: 'Web Programming - Semarang' } });
    expect(screen.getByRole('button', { name: 'Belum melamar (1)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sudah melamar (1)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ditempatkan (2)' })).toBeTruthy();
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
});
