import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DocsView } from '../../src/app/(public)/dokumentasi/docs-view';

afterEach(cleanup);

describe('dokumentasi: keterangan per slot', () => {
  it('slot yang sama memakai keterangan tersimpan di tab semua dan tab kelas', () => {
    // doc-web-smg-hero-0 muncul di tab semua (posisi 0) dan di tab Semarang (posisi 0)
    render(<DocsView photos={{}} captions={{ 'doc-web-smg-hero-0': 'Keterangan khusus' }} />);
    expect(screen.getAllByText('Keterangan khusus').length).toBe(1);
    fireEvent.click(screen.getAllByText('Semarang')[0]);
    expect(screen.getAllByText('Keterangan khusus').length).toBe(1);
  });
});
