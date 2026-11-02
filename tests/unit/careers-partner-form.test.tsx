import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PartnerForm } from '../../src/app/(admin)/admin/job-portal/partner-form';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const fail = (error: string) => Promise.resolve(new Response(JSON.stringify({ error }), { status: 400 }));

describe('formulir mitra', () => {
  it('setelah logo gagal diunggah, simpan ulang memperbarui mitra yang sudah dibuat, bukan membuat baru', async () => {
    const calls: string[] = [];
    let uploads = 0;
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url === '/api/pameran/upload') return ++uploads === 1 ? fail('Ukuran image maksimal 15 MB') : ok({ thumb: 'https://x/t.webp', full: 'https://x/f.webp' });
      if (url === '/api/karier/partners' && init?.method === 'POST') return ok({ id: 'p9' });
      return ok({ ok: true });
    }));
    const onDone = vi.fn();
    render(<PartnerForm id={null} onDone={onDone} />);
    fireEvent.change(screen.getByPlaceholderText('mis. PT DIPSI'), { target: { value: 'PT Baru' } });
    fireEvent.change(screen.getByLabelText('Nama PIC'), { target: { value: 'Rina' } });
    fireEvent.change(screen.getByLabelText('Email PIC'), { target: { value: 'rina@baru.id' } });
    fireEvent.change(screen.getByLabelText(/^Logo/), { target: { files: [new File(['x'], 'logo.png', { type: 'image/png' })] } });

    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await screen.findByText('Ukuran image maksimal 15 MB');
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(calls.filter((c) => c === 'POST /api/karier/partners')).toHaveLength(1);
    expect(calls).toContain('PATCH /api/karier/partners/p9');
  });
});
