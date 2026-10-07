// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// Firestore palsu dengan satu dokumen sesi dan transaksi sederhana.
// Fake Firestore with one session document and a simple transaction.
let doc: Record<string, unknown> | null = null;
let written: Record<string, unknown> | null = null;
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    collection: () => ({ doc: () => ({}) }),
    runTransaction: async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        get: async () => ({ exists: doc !== null, data: () => doc }),
        update: (_ref: unknown, data: Record<string, unknown>) => {
          written = data;
        },
      }),
  }),
}));

import { moveSessionContent, parseMaterialCategory } from '../../src/features/attendance/service';

const admin = { uid: 'a', email: 'a@b.c', name: 'Admin', role: 'admin' as const, classId: null };
const slide = { id: 'r1', label: 'Slide PPT', url: 'https://docs.google.com/presentation/d/X/edit', addedAt: '2026-10-01T00:00:00.000Z' };

describe('pemindahan isi pertemuan', () => {
  it('memindahkan slide yang terlanjur masuk rekaman ke slide presentasi', async () => {
    doc = { recordings: [slide, { id: 'r2', label: 'Kelas Utama', url: 'https://drive.google.com/file/d/V/view', addedAt: '' }], materials: [] };
    await moveSessionContent(admin, { sessionId: 's1', itemId: 'r1', to: 'presentasi' });
    expect((written!.recordings as { id: string }[]).map((r) => r.id)).toEqual(['r2']);
    expect(written!.materials).toEqual([{ ...slide, kind: 'slide', category: 'presentasi' }]);
  });

  it('memindahkan bahan kembali menjadi rekaman', async () => {
    doc = { recordings: [], materials: [{ ...slide, kind: 'slide', category: 'presentasi' }] };
    await moveSessionContent(admin, { sessionId: 's1', itemId: 'r1', to: 'rekaman' });
    expect(written!.recordings).toEqual([slide]);
    expect(written!.materials).toEqual([]);
  });

  it('menolak golongan tak dikenal, isi yang tidak ada, dan peran selain admin', async () => {
    doc = { recordings: [slide], materials: [] };
    await expect(moveSessionContent(admin, { sessionId: 's1', itemId: 'r1', to: 'video' })).rejects.toThrow(/tidak dikenal/);
    await expect(moveSessionContent(admin, { sessionId: 's1', itemId: 'zz', to: 'praktik' })).rejects.toThrow(/tidak ditemukan/);
    await expect(moveSessionContent({ ...admin, role: 'student' }, { sessionId: 's1', itemId: 'r1', to: 'praktik' })).rejects.toThrow(/admin/);
  });
});

describe('golongan bahan', () => {
  it('menganggap kosong sebagai praktik, sama seperti bahan lama', () => {
    expect(parseMaterialCategory(undefined)).toBe('praktik');
    expect(parseMaterialCategory('')).toBe('praktik');
    expect(parseMaterialCategory('tambahan')).toBe('tambahan');
  });
});
