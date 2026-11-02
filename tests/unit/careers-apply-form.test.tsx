import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
import { ApplyForm } from '../../src/app/(student)/app/karier/[jobId]/lamar/apply-form';

const context = {
  job: {
    id: 'j1', title: 'UI/UX Designer Intern', partnerName: 'PT DIPSI', closesAt: '2099-01-01T00:00:00.000Z',
    documents: { portfolio: 'optional', works: 'optional', coverLetter: 'off' },
    questions: [{ id: 'q1', label: 'Kenapa kamu tertarik?', kind: 'long', options: [], required: true }],
  },
  partner: { id: 'p1', name: 'PT DIPSI' },
  personal: { fullName: 'Andi Pratama', email: 'andi@x.id', phone: '', city: '', school: 'SMK 1', major: 'RPL', linkedin: '' },
  className: 'Web Programming · Semarang',
  cvs: [{ id: 'cv1', fileName: 'CV_Andi.pdf', size: 1200000, uploadedAt: '2026-11-03T00:00:00Z' }],
  covers: [],
  works: [{ id: 'w1', title: 'Griya Kenanga', type: 'Capstone', cover: '' }],
  tasks: [{ submissionId: 't1_u1', title: 'TPM 1', kind: 'daily' }],
};

let posted: Record<string, unknown> | null = null;

beforeEach(() => {
  posted = null;
  try { localStorage.clear(); } catch { /* abaikan */ }
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url.startsWith('/api/karier/lamar') && init?.method === 'POST') {
      posted = JSON.parse(String(init.body));
      return Promise.resolve(new Response(JSON.stringify({ id: 'j1_u1', number: 'FM-JOB-0007' })));
    }
    return Promise.resolve(new Response(JSON.stringify(context)));
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('formulir lamaran', () => {
  it('tidak bisa lanjut bila No. WhatsApp kosong', async () => {
    render(<ApplyForm jobId="j1" />);
    await screen.findByDisplayValue('Andi Pratama');
    fireEvent.change(screen.getByLabelText('Domisili (kota)'), { target: { value: 'Semarang' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
    expect(await screen.findByText('Lengkapi data diri: No. WhatsApp')).toBeTruthy();
  });

  it('draf yang tersimpan dipulihkan', async () => {
    localStorage.setItem('karier-draf-j1', JSON.stringify({ personal: { city: 'Kudus' } }));
    render(<ApplyForm jobId="j1" />);
    expect(await screen.findByDisplayValue('Kudus')).toBeTruthy();
    expect(screen.getByDisplayValue('Andi Pratama')).toBeTruthy();
  });

  it('mengirim lamaran dengan CV terpilih lalu menampilkan nomornya', async () => {
    render(<ApplyForm jobId="j1" />);
    await screen.findByDisplayValue('Andi Pratama');
    fireEvent.change(screen.getByLabelText('No. WhatsApp aktif'), { target: { value: '0812' } });
    fireEvent.change(screen.getByLabelText('Domisili (kota)'), { target: { value: 'Semarang' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
    fireEvent.click(await screen.findByLabelText(/Griya Kenanga/));
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
    fireEvent.change(await screen.findByLabelText(/Kenapa kamu tertarik\?/), { target: { value: 'Suka riset pengguna' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kirim lamaran' }));
    expect(await screen.findByText('Lamaran terkirim')).toBeTruthy();
    expect(screen.getByText(/FM-JOB-0007/)).toBeTruthy();
    expect(posted).toMatchObject({ jobId: 'j1', cvId: 'cv1', workIds: ['w1'], answers: { q1: 'Suka riset pengguna' } });
    await waitFor(() => expect(localStorage.getItem('karier-draf-j1')).toBeNull());
  });
});
