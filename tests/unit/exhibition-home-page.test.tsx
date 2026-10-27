import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import HomePage from '../../src/app/(public)/home-page';
import { TESTI_P, TESTI_PLAN, TESTI_T, VIDEOS } from '../../src/features/exhibition/content';
import { homeTesti, type SiteContent } from '../../src/features/exhibition/model';

const site = (o: Partial<SiteContent> = {}): SiteContent => ({
  photos: {}, captions: {}, videos: VIDEOS, testiPeserta: TESTI_P, testiAuthors: {}, testiTrainer: TESTI_T, testiPlan: TESTI_PLAN, ...o,
});
const people = [{ uid: 'u1', nickname: 'Adinda' }, { uid: 'u2', nickname: 'Bayu' }];
const best = [{ cohort: 'web-smg', title: 'Karya X', nickname: 'Adinda', type: 'Landing Page', href: '/karya/w1', thumb: 'https://img/work-thumb.webp' }];

afterEach(cleanup);

describe('beranda pameran', () => {
  it('tanpa penulis testimoni tidak ada blok testimoni peserta', () => {
    render(<HomePage people={2} works={3} best={[]} testi={homeTesti(people, {})} site={site()} />);
    expect(screen.queryByText('Testimoni peserta')).toBeNull();
  });
  it('penulis terpilih tampil dengan nickname; yang tidak ada di katalog diabaikan', () => {
    const testi = homeTesti(people, { 'web-smg': 'u2', 'da-jkt': 'tak-tampil' });
    expect(testi).toEqual([{ cohort: 'web-smg', uid: 'u2', nickname: 'Bayu' }]);
    render(<HomePage people={2} works={3} best={[]} testi={testi} site={site()} />);
    expect(screen.getByText('Testimoni peserta')).toBeTruthy();
    expect(screen.getAllByText('Bayu').length).toBeGreaterThan(0);
  });
  it('keterangan slide dokumentasi tersimpan menggantikan bawaan', () => {
    render(<HomePage people={2} works={3} best={[]} testi={[]} site={site({ captions: { 'doc-1': 'Keterangan khusus slide' } })} />);
    expect(screen.getAllByText('Keterangan khusus slide').length).toBe(1);
    expect(screen.getByLabelText('Keterangan khusus slide')).toBeTruthy();
  });
  it('kartu karya terbaik memakai thumb karya meski ada foto best-<kohor>', () => {
    const { container } = render(<HomePage people={2} works={3} best={best} testi={[]} site={site({ photos: { 'best-web-smg': 'https://img/override.webp' } })} />);
    expect(container.innerHTML).toContain('work-thumb.webp');
    expect(container.innerHTML).not.toContain('override.webp');
  });
});
