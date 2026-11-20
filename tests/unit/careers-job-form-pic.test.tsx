import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/features/careers/job-card', () => ({ JobCard: () => null }));
import { JobForm } from '../../src/app/(admin)/admin/job-portal/job-form';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const job = {
  partnerId: 'p1', title: 'Social Media Specialist', employment: 'magang-3', category: 'pemasaran', scheme: 'full', location: 'Remote', workMode: 'remote',
  quota: 1, description: '', qualifications: [], salary: null, durationMonths: null, eligibility: { mode: 'all' },
  opensAt: '2026-11-10T01:00:00.000Z', closesAt: '2026-11-22T16:59:00.000Z', documents: { portfolio: 'optional', works: 'optional', coverLetter: 'off' },
  questions: [], status: 'published',
  // PIC lama yang sudah dihapus dari mitra / An old PIC already removed from the partner
  picEmails: ['admn.dynamic@gmail.com'],
};

describe('PIC di formulir lowongan', () => {
  it('PIC lama yang sudah tidak terdaftar di mitra tidak ikut terkirim saat disimpan', async () => {
    let sent: Record<string, unknown> | null = null;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') { sent = JSON.parse(String(init.body)); return json({ ok: true }); }
      if (url === '/api/karier/partners') return json({ partners: [{ id: 'p1', name: 'Dynamic Buzz', pics: [{ name: 'Kal', email: 'dayang.dynamic@gmail.com' }] }] });
      if (url === '/api/classes') return json({ classes: [] });
      return json({ job });
    }));
    await act(async () => { render(<JobForm id="j1" onDone={vi.fn()} />); });
    const kal = await screen.findByRole('checkbox', { name: /Kal/ }) as HTMLInputElement;
    // PIC yang tersisa di mitra langsung terpilih / The partner's remaining PIC is selected right away
    expect(kal.checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Simpan draf' }));
    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent!.picEmails).toEqual(['dayang.dynamic@gmail.com']);
  });
});
