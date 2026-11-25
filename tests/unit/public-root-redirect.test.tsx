import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionActor = vi.fn();
vi.mock('@/features/auth/session', () => ({
  getSessionActor: () => getSessionActor(),
  getRoleRedirectPath: (role: string) => ({ admin: '/admin', mentor: '/mentor', student: '/app' })[role],
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error('REDIRECT ' + url); },
}));
const card = (id: string) => ({ id, title: 'Karya ' + id, nickname: 'N', type: 'Capstone', cohort: 'da-jkt', thumb: '' });
vi.mock('../../src/app/(public)/home-page', () => ({ default: () => null }));
vi.mock('../../src/features/exhibition/read', () => ({
  getCatalog: async () => ({ people: [], cards: [card('lain'), card('aa8c70625951abe95672'), card('c0b5fb7e58e668bd8e6f')], collections: [] }),
  getSiteContent: async () => ({ photos: {}, testiPeserta: [] }),
  todayWib: () => '2026-10-28',
}));

import IndexPage from '../../src/app/(public)/page';

describe('halaman utama publik', () => {
  beforeEach(() => getSessionActor.mockReset());

  it('mengarahkan pengguna yang sudah login ke dashboard perannya', async () => {
    getSessionActor.mockResolvedValue({ role: 'student' });
    await expect(IndexPage()).rejects.toThrow('REDIRECT /app');
    getSessionActor.mockResolvedValue({ role: 'admin' });
    await expect(IndexPage()).rejects.toThrow('REDIRECT /admin');
  });

  it('menampilkan pameran untuk pengunjung tanpa sesi', async () => {
    getSessionActor.mockResolvedValue(null);
    await expect(IndexPage()).resolves.toBeTruthy();
  });

  it('karya terbaik hanya capstone pilihan, urut sesuai daftar, karya lain tidak ikut', async () => {
    getSessionActor.mockResolvedValue(null);
    const el = (await IndexPage()) as { props: { best: { href: string }[] } };
    expect(el.props.best.map((b) => b.href)).toEqual(['/karya/c0b5fb7e58e668bd8e6f', '/karya/aa8c70625951abe95672']);
  });
});
