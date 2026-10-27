import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/galeri',
}));

import { GalleryView } from '../../src/app/(public)/galeri/gallery-view';
import { CollectionView } from '../../src/app/(public)/koleksi/[id]/collection-view';
import { safeExternalUrl, type GalleryCard, type GalleryItem } from '../../src/features/exhibition/model';

const c = (id: string, over: Partial<GalleryCard> = {}): GalleryCard => ({
  id, title: `Karya ${id}`, type: 'Landing Page', cohort: 'web-smg', track: 'web', personUid: 'u' + id,
  nickname: 'Budi' + id, thumb: '', aiAssisted: false, collectionId: null, ...over,
});
const work = (card: GalleryCard): GalleryItem => ({ kind: 'work', card });
const counts = { 'web-smg': 3 };

afterEach(cleanup);

describe('galeri publik', () => {
  it('galeri menampilkan item sesuai urutan dari server', () => {
    render(<GalleryView items={[work(c('c')), work(c('a')), work(c('b'))]} counts={counts} />);
    const titles = screen.getAllByText(/^Karya [abc]$/).map((e) => e.textContent);
    expect(titles).toEqual(['Karya c', 'Karya a', 'Karya b']);
  });

  it('kartu tanpa sampul memakai placeholder jenis karya', () => {
    const { container } = render(<GalleryView items={[work(c('a'))]} counts={counts} />);
    expect(screen.getByText('Screenshot landing page')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('kartu dengan sampul menampilkan gambar', () => {
    const { container } = render(<GalleryView items={[work(c('a', { thumb: 'https://x/t.webp' }))]} counts={counts} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x/t.webp');
  });

  it('label AI tampil di kartu', () => {
    render(<GalleryView items={[work(c('a', { aiAssisted: true }))]} counts={counts} />);
    expect(screen.getByText('Dibuat dengan bantuan AI')).toBeTruthy();
  });

  it('mencari nama panggilan menemukan anggota koleksi', () => {
    const m1 = c('m1', { collectionId: 'k1', nickname: 'Zalfa' });
    const m2 = c('m2', { collectionId: 'k1', nickname: 'Ilma' });
    const items: GalleryItem[] = [
      { kind: 'collection', collection: { id: 'k1', title: 'Dapur Nia', cohort: 'web-smg', type: 'Aplikasi Web', coverUrls: [], count: 2, nicknames: ['Zalfa', 'Ilma'] } },
      work(c('a')),
    ];
    // anggota koleksi tidak ada di daftar item; dikirim lewat members / members are passed separately
    render(<GalleryView items={items} members={[m1, m2]} counts={counts} />);
    expect(screen.getByText('Dapur Nia: satu brief, 2 versi')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Cari judul atau nama panggilan'), { target: { value: 'zalfa' } });
    expect(screen.getByText('Karya m1')).toBeTruthy();
    expect(screen.queryByText('Karya m2')).toBeNull();
    expect(screen.queryByText('Dapur Nia: satu brief, 2 versi')).toBeNull();
  });
});

describe('halaman koleksi', () => {
  it('Coba langsung memuat iframe dengan sandbox yang ditentukan', () => {
    const data = {
      collection: { id: 'k1', title: 'Dapur Nia', brief: 'Brief katering', classId: 'x', cohort: 'web-smg', type: 'Aplikasi Web', coverUrls: [] },
      versions: [{ ...c('m1', { collectionId: 'k1', nickname: 'Alenda' }), siteUrl: 'https://dapur.netlify.app/' }],
    };
    const { container } = render(<CollectionView {...data} />);
    expect(container.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByText('Coba langsung'));
    expect(container.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin allow-forms allow-popups');
  });

  it('siteUrl javascript: tidak menampilkan tautan demo maupun Coba langsung', () => {
    const data = {
      collection: { id: 'k1', title: 'Dapur Nia', brief: '', classId: 'x', cohort: 'web-smg', type: 'Aplikasi Web', coverUrls: [] },
      versions: [{ ...c('m1', { collectionId: 'k1' }), siteUrl: 'javascript:alert(1)' }],
    };
    const { container } = render(<CollectionView {...data} />);
    expect(screen.queryByText('Coba langsung')).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    expect(screen.queryByText(/Buka demo/)).toBeNull();
  });
});

describe('safeExternalUrl', () => {
  it('hanya menerima http(s)', () => {
    expect(safeExternalUrl('https://a.id/x')).toBe('https://a.id/x');
    expect(safeExternalUrl('http://a.id')).toBe('http://a.id');
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('bukan url')).toBeNull();
  });
});
