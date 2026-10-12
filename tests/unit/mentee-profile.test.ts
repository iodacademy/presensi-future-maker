// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { toWhatsAppNumber, whatsAppLink } from '../../src/lib/whatsapp';

const data: Record<string, Record<string, Record<string, unknown>>> = {
  users: { s1: { uid: 's1', name: 'Ani', email: 'ani@x.id', role: 'student', classId: 'k1' } },
  classes: { k1: { canonicalName: 'Semarang - Data' } },
  studentProfiles: { s1: { birthDate: '2000-01-01', gender: 'perempuan', disability: 'tidak-ada', disabilityNote: '', entryStatus: 'mahasiswa', phone: '081234567890' } },
  mentoringSlots: { x: { mentorId: 'm1', studentId: 's1' } },
};
function query(name: string, filters: [string, unknown][] = []) {
  const q = {
    where: (f: string, _op: string, v: unknown) => query(name, [...filters, [f, v]]),
    limit: () => q,
    select: () => q,
    get: async () => {
      const docs = Object.values(data[name] ?? {}).filter((d) => filters.every(([f, v]) => d[f] === v));
      return { empty: docs.length === 0, docs };
    },
  };
  return q;
}
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    collection: (name: string) => ({
      ...query(name),
      doc: (id: string) => ({ get: async () => ({ exists: !!data[name]?.[id], data: () => data[name]?.[id] }) }),
    }),
  }),
}));

import { getMenteeProfile } from '../../src/features/mentoring/service';

const mentor = (uid: string) => ({ uid, email: `${uid}@x.id`, name: 'Mentor', role: 'mentor' as const, classId: null });

describe('nomor WhatsApp', () => {
  it('menyeragamkan 08, +62, dan 62 ke bentuk wa.me', () => {
    expect(toWhatsAppNumber('0812-3456-7890')).toBe('6281234567890');
    expect(toWhatsAppNumber('+62 812 3456 7890')).toBe('6281234567890');
    expect(toWhatsAppNumber('6281234567890')).toBe('6281234567890');
    expect(toWhatsAppNumber('')).toBeNull();
    expect(toWhatsAppNumber('123')).toBeNull();
    expect(whatsAppLink('0812345678901', 'Halo & sampai jumpa')).toBe('https://wa.me/62812345678901?text=Halo%20%26%20sampai%20jumpa');
  });
});

describe('profil peserta untuk mentor', () => {
  it('terbuka bagi mentor yang dibooking peserta itu', async () => {
    const p = await getMenteeProfile(mentor('m1'), 's1');
    expect(p).toMatchObject({ name: 'Ani', className: 'Semarang - Data', phone: '081234567890', gender: 'Perempuan' });
  });

  it('tertutup bagi mentor lain, karena memuat nomor WhatsApp dan disabilitas', async () => {
    await expect(getMenteeProfile(mentor('m2'), 's1')).rejects.toThrow(/tidak membooking/);
  });

  it('tertutup bagi peserta', async () => {
    await expect(getMenteeProfile({ ...mentor('s2'), role: 'student' }, 's1')).rejects.toThrow(/mentor atau admin/);
  });
});
