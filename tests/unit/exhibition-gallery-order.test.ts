import { describe, expect, it } from 'vitest';
import { orderGallery } from '@/features/exhibition/gallery-order';
import type { CollectionCard, GalleryCard } from '@/features/exhibition/model';

const card = (id: string, personUid: string, type: string, cohort: string, collectionId: string | null = null): GalleryCard => ({
  id, title: id, type, cohort, track: 'web', personUid, nickname: personUid, thumb: '', aiAssisted: false, collectionId,
});
const col = (id: string): CollectionCard => ({ id, title: id, cohort: 'a', type: 'Landing Page', coverUrls: [], count: 2, nicknames: [] });

// 8 peserta: 4 kelas x 2 jenis / 8 people: 4 cohorts x 2 types
const people = Array.from({ length: 8 }, (_, i) => ({ uid: `p${i}`, mainWorkId: null }));
const cards = people.map((p, i) => card(`w${i}`, p.uid, i % 2 ? 'Landing Page' : 'Dashboard', `c${i % 4}`));
const fixture = { people, cards, collections: [col('k1'), col('k2')] };

describe('orderGallery', () => {
  it('setiap peserta muncul di putaran pertama', () => {
    const items = orderGallery(fixture, '2026-10-27');
    const first = items.slice(0, people.length).map((i) => i.kind === 'work' && i.card.personUid);
    expect(new Set(first)).toEqual(new Set(people.map((p) => p.uid)));
  });
  it('kartu bersebelahan beda jenis dan beda kelas bila memungkinkan', () => {
    const ps = Array.from({ length: 9 }, (_, i) => ({ uid: `q${i}`, mainWorkId: null }));
    const cs = ps.map((p, i) => card(`x${i}`, p.uid, ['Dashboard', 'Reels', 'Konten Feed'][i % 3], `k${Math.floor(i / 3)}`));
    const items = orderGallery({ people: ps, cards: cs, collections: [] }, '2026-10-27');
    for (let i = 1; i < items.length; i++) {
      const a = items[i - 1], b = items[i];
      if (a.kind !== 'work' || b.kind !== 'work') throw new Error('bukan karya');
      expect(a.card.type !== b.card.type && a.card.cohort !== b.card.cohort).toBe(true);
    }
  });
  it('urutan sama untuk tanggal sama, berbeda untuk tanggal lain', () => {
    expect(orderGallery(fixture, '2026-10-27')).toEqual(orderGallery(fixture, '2026-10-27'));
    expect(orderGallery(fixture, '2026-10-28')).not.toEqual(orderGallery(fixture, '2026-10-27'));
  });
  it('anggota koleksi hanya tampil sendiri bila jadi karya pertama pesertanya', () => {
    const input = {
      people: [{ uid: 'A', mainWorkId: null }, { uid: 'B', mainWorkId: null }],
      cards: [card('a1', 'A', 'Landing Page', 'c', 'dapur-nia'), card('b1', 'B', 'Landing Page', 'c'), card('b2', 'B', 'Landing Page', 'c', 'dapur-nia')],
      collections: [],
    };
    const ids = orderGallery(input, '2026-10-27').map((i) => i.kind === 'work' && i.card.id);
    expect(ids).toContain('a1');
    expect(ids).toContain('b1');
    expect(ids).not.toContain('b2');
  });
  it('kartu koleksi muncul tepat setelah putaran pertama', () => {
    const items = orderGallery(fixture, '2026-10-27');
    expect(items.findIndex((i) => i.kind === 'collection')).toBe(people.length);
    expect(items.filter((i) => i.kind === 'collection').map((i) => i.kind === 'collection' && i.collection.id)).toEqual(['k1', 'k2']);
  });
  it('karya utama pilihan admin dipakai lebih dulu di antara karya selain capstone', () => {
    const input = {
      people: [{ uid: 'A', mainWorkId: 'reels' }],
      cards: [card('cap', 'A', 'Capstone', 'c'), card('feed', 'A', 'Konten Feed', 'c'), card('reels', 'A', 'Reels', 'c')],
      collections: [],
    };
    expect(orderGallery(input, '2026-10-27').map((i) => i.kind === 'work' && i.card.id)).toEqual(['cap', 'reels', 'feed']);
  });
  it('seluruh capstone tampil sebelum karya lain dan koleksi', () => {
    const input = {
      people: [{ uid: 'A', mainWorkId: null }, { uid: 'B', mainWorkId: null }, { uid: 'C', mainWorkId: null }],
      cards: [card('a1', 'A', 'Landing Page', 'c1'), card('a2', 'A', 'Capstone', 'c1'), card('b1', 'B', 'Dashboard', 'c2'), card('c1', 'C', 'Capstone', 'c3')],
      collections: [col('k1')],
    };
    const items = orderGallery(input, '2026-10-27');
    const types = items.map((i) => (i.kind === 'work' ? i.card.type : 'koleksi'));
    expect(types.slice(0, 2)).toEqual(['Capstone', 'Capstone']);
    expect(types.slice(2)).not.toContain('Capstone');
  });
});
