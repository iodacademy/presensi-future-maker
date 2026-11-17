import React, { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock('../../src/app/(mitra)/mitra/shell', async (orig) => ({ ...(await orig<object>()), MitraShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
import CandidatePage from '../../src/app/(mitra)/mitra/kandidat/[id]/page';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const candidate = (status: string) => ({
  id: 'a1', jobId: 'j1', number: 'FM-JOB-0001', status, scheme: 'full', cvId: 'cv1', cvFileName: 'cv.pdf', coverLetterId: null, portfolioUrl: '',
  personal: { fullName: 'Andi', email: 'a@x.id', phone: '', city: '', school: '', major: '', linkedin: '' },
  className: 'SMM', finalScore: 80, finalScorePending: false, works: [], tasks: [], questions: [], answers: {}, interviewWaLink: null, offerWaLink: null,
});

async function open(status: string) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return url.includes('/candidates/') ? json({ candidate: candidate(status) }) : json({ picName: 'Rina' });
  }));
  await act(async () => { render(<Suspense fallback={null}><CandidatePage params={Promise.resolve({ id: 'a1' })} /></Suspense>); });
  return calls;
}

describe('keputusan seleksi PIC', () => {
  it('PIC bisa langsung meloloskan kandidat tanpa interview; kandidat lalu diminta menerima tawaran', async () => {
    const calls = await open('shortlist');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Lolos, terima kandidat' }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'PATCH')).toBe(true));
    const patch = calls.find((c) => c.init?.method === 'PATCH')!;
    expect(patch.url).toBe('/api/mitra/candidates/a1');
    expect(JSON.parse(String(patch.init?.body))).toMatchObject({ status: 'diterima' });
  });

  it('batal di dialog konfirmasi tidak mengubah status', async () => {
    const calls = await open('ditinjau');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Lolos, terima kandidat' }));
    expect(calls.some((c) => c.init?.method === 'PATCH')).toBe(false);
  });
});
