import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionActor = vi.fn();
vi.mock('@/features/auth/session', () => ({
  getSessionActor: () => getSessionActor(),
  getRoleRedirectPath: (role: string) => ({ admin: '/admin', mentor: '/mentor', student: '/app' })[role],
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error('REDIRECT ' + url); },
}));
vi.mock('../../src/app/(public)/home-page', () => ({ default: () => null }));

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
});
