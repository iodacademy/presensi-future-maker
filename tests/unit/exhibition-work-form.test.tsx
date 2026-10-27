import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkForm } from '../../src/app/(admin)/admin/pameran/work-form';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('formulir karya', () => {
  it('gagal memuat karya: pesan tampil dan Batal menutup formulir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Karya tidak ditemukan' }), { status: 500 })));
    const onClose = vi.fn();
    render(<WorkForm workId="w1" people={[]} collections={[]} onClose={onClose} />);
    expect(await screen.findByText('Karya tidak ditemukan')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(onClose).toHaveBeenCalledWith(false);
  });
});
