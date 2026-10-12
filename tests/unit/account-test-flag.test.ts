// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');

// Firestore palsu: hanya mencatat dokumen yang ada dan yang ditulis.
// Fake Firestore: only tracks which documents exist and what was written.
const store = new Map<string, Record<string, unknown>>();
const deleted: string[] = [];
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    collection: (c: string) => ({
      doc: (id: string) => ({
        get: async () => ({ exists: store.has(`${c}/${id}`), data: () => store.get(`${c}/${id}`) }),
        set: async (d: Record<string, unknown>) => void store.set(`${c}/${id}`, d),
        update: async (d: Record<string, unknown>) => void store.set(`${c}/${id}`, { ...store.get(`${c}/${id}`), ...d }),
        delete: async () => void deleted.push(`${c}/${id}`),
      }),
    }),
  }),
}));

import { setUserTest } from '../../src/features/users/list-service';
import { updateProfileByAdmin } from '../../src/features/users/profile-service';

const admin = { uid: 'ad', email: 'a@x.id', name: 'Admin', role: 'admin' as const, classId: null };
const mentor = { ...admin, role: 'mentor' as const };

describe('tanda akun test', () => {
  it('menandai akun dan membuang ringkasan dashboard hari ini agar dihitung ulang', async () => {
    store.set('users/s1', { uid: 's1' });
    await setUserTest(admin, 's1', true);
    expect(store.get('users/s1')?.isTest).toBe(true);
    expect(deleted.some((p) => p.startsWith('dashboardSnapshots/'))).toBe(true);
  });

  it('hanya admin yang dapat menandai', async () => {
    await expect(setUserTest(mentor, 's1', true)).rejects.toThrow(/admin/);
  });

  it('akun test dibuang sebelum angka dashboard dihitung', () => {
    const snapshot = read('src/features/dashboard/snapshot-service.ts');
    expect(snapshot).toContain('.filter((s) => !s.isTest)');
  });
});

describe('admin mengubah profil peserta', () => {
  const valid = { birthDate: '2000-05-01', gender: 'perempuan', disability: 'tidak-ada', disabilityNote: '', entryStatus: 'mahasiswa', phone: '08123456789' } as const;

  it('menyimpan perubahan pada profil yang sudah diisi', async () => {
    store.set('studentProfiles/s1', { id: 's1', ...valid, phone: '0811111111' });
    await updateProfileByAdmin(admin, 's1', valid);
    expect(store.get('studentProfiles/s1')?.phone).toBe('08123456789');
  });

  it('menolak profil yang belum diisi peserta', async () => {
    // Mengisikannya akan meloloskan peserta dari formulir profil.
    // Filling it in would let the participant skip the profile form.
    await expect(updateProfileByAdmin(admin, 'belum', valid)).rejects.toThrow(/belum mengisi/);
  });

  it('tetap memvalidasi isinya dan hanya untuk admin', async () => {
    await expect(updateProfileByAdmin(admin, 's1', { ...valid, phone: '123' })).rejects.toThrow(/WhatsApp/);
    await expect(updateProfileByAdmin(mentor, 's1', valid)).rejects.toThrow(/admin/);
  });
});
