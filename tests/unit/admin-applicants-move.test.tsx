import React, { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock('@/components/app-shell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
import ApplicantsPage from '../../src/app/(admin)/admin/job-portal/[jobId]/page';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const row = { id: 'a1', number: 'FM-JOB-0001', fullName: 'Andi', email: 'a@x.id', phone: '', city: 'Semarang', school: '', major: '', className: 'SMM', finalScore: 80, finalScorePending: false, finalScoreAt: null, status: 'shortlist', submittedAt: '2026-11-10T00:00:00Z', statusChangedAt: '', cvId: 'cv1', portfolioUrl: '', scheme: 'full', completedAt: null };
const jobRow = (id: string, title: string, partnerName: string, extra: object = {}) => ({ id, title, partnerName, partnerId: partnerName, scheme: 'full', status: 'published', demo: false, ...extra });
const detail = { ...row, jobId: 'j1', personal: { fullName: 'Andi', email: 'a@x.id', phone: '', city: '', school: '', major: '', linkedin: '' }, cvFileName: 'cv.pdf', coverLetterId: null, works: [], tasks: [], questions: [], answers: {} };

async function open() {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url === '/api/karier/jobs') return json({ jobs: [jobRow('j1', 'Data Analyst', 'PT A'), jobRow('j2', 'Social Media', 'PT B'), jobRow('j3', 'Draf', 'PT B', { status: 'draft' }), jobRow('j4', 'Demo', 'PT B', { demo: true })] });
    if (url === '/api/karier/jobs/j1') return json({ job: { title: 'Data Analyst', partnerName: 'PT A' } });
    if (url === '/api/karier/jobs/j1/applications') return json({ applicants: [row] });
    if (url === '/api/karier/applications/a1') return json({ application: detail });
    return json({ ok: true });
  }));
  await act(async () => { render(<Suspense fallback={null}><ApplicantsPage params={Promise.resolve({ jobId: 'j1' })} /></Suspense>); });
  fireEvent.click(await screen.findByRole('button', { name: 'Detail' }));
  return calls;
}

describe('admin memindahkan dan meloloskan pelamar', () => {
  it('memindahkan ke lowongan perusahaan lain sekaligus meloloskan', async () => {
    const calls = await open();
    const select = await screen.findByRole('combobox', { name: 'Lowongan tujuan' });
    const options = [...select.querySelectorAll('option')].map((o) => o.textContent);
    expect(options).toEqual(['Pilih lowongan', 'Social Media']);
    fireEvent.change(select, { target: { value: 'j2' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Langsung loloskan/ }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Pindahkan' }));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/karier/applications/a1/pindah')).toBe(true));
    const post = calls.find((c) => c.url === '/api/karier/applications/a1/pindah')!;
    expect(post.init?.method).toBe('POST');
    expect(JSON.parse(String(post.init?.body))).toEqual({ jobId: 'j2', pass: true });
  });

  it('memilih Lolos di kolom status meminta konfirmasi lebih dulu', async () => {
    const calls = await open();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.change(screen.getByRole('combobox', { name: 'Status Andi' }), { target: { value: 'diterima' } });
    expect(calls.some((c) => c.init?.method === 'PATCH')).toBe(false);
  });
});
