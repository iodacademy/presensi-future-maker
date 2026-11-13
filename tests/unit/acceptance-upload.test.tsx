import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AcceptanceUpload } from '../../src/app/(student)/app/acceptance-upload';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('unggah dokumen penerimaan', () => {
  it('belum ada dokumen: tampil wajib, lalu mengunggah PDF dengan jenis penerimaan', async () => {
    let uploaded = false;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') { uploaded = true; return json({ cv: { id: 'd1' } }); }
      return json({ cvs: [], covers: [], acceptance: uploaded ? [{ id: 'd1', fileName: 'LoA.pdf', uploadedAt: '2026-11-13T03:00:00Z' }] : [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<AcceptanceUpload />);
    expect(await screen.findByText(/Wajib unggah letter of acceptance atau kontrak/)).toBeTruthy();
    const input = screen.getByLabelText('Pilih dokumen penerimaan (PDF)') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['%PDF-1.7'], 'LoA.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Unggah dokumen' }));
    await waitFor(() => expect(screen.getByText('LoA.pdf')).toBeTruthy());
    const post = fetchMock.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === 'POST')!;
    expect(((post[1] as RequestInit).body as FormData).get('kind')).toBe('penerimaan');
    expect(screen.getByRole('link', { name: 'Lihat' }).getAttribute('href')).toBe('/api/karier/cv/d1');
  });
});
