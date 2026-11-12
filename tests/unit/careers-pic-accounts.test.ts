// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { data, fakeDb, fakeStorage, reset } from './careers-fake-db';

vi.mock('../../src/features/auth/session', () => ({ getSessionActor: vi.fn() }));
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb, getAdminStorage: () => fakeStorage }));

import { createPicAccounts, listPartners, updatePartner } from '../../src/features/careers/admin-service';
import { getEmailHash, isValidRole } from '../../src/features/auth/policy';
import { getRoleRedirectPath, isAuthorizedPath } from '../../src/features/auth/paths';

const partner = {
  name: 'PT DIPSI', nameKey: 'pt dipsi', field: '', about: '', logo: null, website: '', active: true,
  socials: { instagram: '', linkedin: '', tiktok: '', youtube: '' },
  pics: [{ name: 'Rina Kusuma', phone: '0812', email: 'rina@dipsi.co.id' }, { name: 'Budi', phone: '', email: 'budi@dipsi.co.id' }],
};

beforeEach(() => { reset({ partners: { p1: partner }, users: {}, emailIndex: {}, jobs: {} }); });

describe('akun PIC mitra', () => {
  it('peran partner sah dan diarahkan ke /mitra saja', () => {
    expect(isValidRole('partner')).toBe(true);
    expect(getRoleRedirectPath('partner')).toBe('/mitra');
    expect(isAuthorizedPath('partner', '/mitra/kandidat')).toBe(true);
    expect(isAuthorizedPath('partner', '/admin')).toBe(false);
    expect(isAuthorizedPath('student', '/mitra')).toBe(false);
  });

  it('membuat akun login untuk setiap PIC dengan partnerId', async () => {
    const r = await createPicAccounts('p1');
    expect(r).toEqual({ created: ['rina@dipsi.co.id', 'budi@dipsi.co.id'], existing: [] });
    const idx = data.emailIndex[getEmailHash('rina@dipsi.co.id')];
    expect(data.users[idx.uid as string]).toMatchObject({ role: 'partner', partnerId: 'p1', name: 'Rina Kusuma', email: 'rina@dipsi.co.id', active: true, classId: null });
    expect((await listPartners())[0].picAccounts.sort()).toEqual(['budi@dipsi.co.id', 'rina@dipsi.co.id']);
  });

  it('memanggil dua kali tidak membuat akun ganda', async () => {
    await createPicAccounts('p1');
    expect(await createPicAccounts('p1')).toEqual({ created: [], existing: ['rina@dipsi.co.id', 'budi@dipsi.co.id'] });
    expect(Object.keys(data.users)).toHaveLength(2);
  });

  it('email yang sudah dipakai akun lain ditolak tanpa membuat akun apa pun', async () => {
    data.users.s1 = { role: 'student', email: 'budi@dipsi.co.id' };
    data.emailIndex[getEmailHash('budi@dipsi.co.id')] = { uid: 's1', role: 'student' };
    await expect(createPicAccounts('p1')).rejects.toThrow('Email budi@dipsi.co.id sudah dipakai akun lain. Pakai email lain untuk PIC.');
    expect(Object.keys(data.users)).toEqual(['s1']);
  });

  it('PIC yang dihapus dari daftar mitra kehilangan akses, dan aktif lagi bila ditambahkan kembali', async () => {
    await createPicAccounts('p1');
    const budi = String(data.emailIndex[getEmailHash('budi@dipsi.co.id')].uid);
    const { nameKey: _k, active: _a, ...input } = partner;
    await updatePartner('p1', { ...input, pics: [partner.pics[0]] });
    expect(data.users[budi].active).toBe(false);
    expect(data.users[String(data.emailIndex[getEmailHash('rina@dipsi.co.id')].uid)].active).toBe(true);
    await updatePartner('p1', input);
    expect(await createPicAccounts('p1')).toEqual({ created: [], existing: ['rina@dipsi.co.id', 'budi@dipsi.co.id'] });
    expect(data.users[budi].active).toBe(true);
  });

  it('email mentor dijadikan PIC: akun yang sama mendapat peran PIC, tanpa akun baru', async () => {
    data.users.m1 = { uid: 'm1', role: 'mentor', email: 'budi@dipsi.co.id', name: 'Budi', active: true };
    data.emailIndex[getEmailHash('budi@dipsi.co.id')] = { uid: 'm1', role: 'mentor' };
    expect(await createPicAccounts('p1')).toEqual({ created: ['rina@dipsi.co.id'], existing: ['budi@dipsi.co.id'] });
    expect(data.users.m1).toMatchObject({ role: 'mentor', roles: ['mentor', 'partner'], partnerId: 'p1', active: true });
    expect((await listPartners())[0].picAccounts.sort()).toEqual(['budi@dipsi.co.id', 'rina@dipsi.co.id']);
  });

  it('mentor yang dikeluarkan dari daftar PIC hanya kehilangan peran PIC, akun mentornya tetap aktif', async () => {
    data.users.m1 = { uid: 'm1', role: 'mentor', email: 'budi@dipsi.co.id', name: 'Budi', active: true };
    data.emailIndex[getEmailHash('budi@dipsi.co.id')] = { uid: 'm1', role: 'mentor' };
    await createPicAccounts('p1');
    const { nameKey: _k, active: _a, ...input } = partner;
    await updatePartner('p1', { ...input, pics: [partner.pics[0]] });
    expect(data.users.m1).toMatchObject({ active: true, role: 'mentor', roles: ['mentor'], partnerId: null });
  });

  it('PIC mitra lain bisa juga menjadi PIC mitra ini, dan tampil di kedua mitra', async () => {
    data.partners.p2 = { ...partner, name: 'PT Lain', nameKey: 'pt lain', pics: [{ name: 'Budi', phone: '', email: 'budi@dipsi.co.id' }] };
    data.users.x = { uid: 'x', role: 'partner', partnerId: 'p2', email: 'budi@dipsi.co.id', active: true };
    data.emailIndex[getEmailHash('budi@dipsi.co.id')] = { uid: 'x', role: 'partner' };
    expect((await createPicAccounts('p1')).existing).toContain('budi@dipsi.co.id');
    expect(data.users.x).toMatchObject({ role: 'partner', partnerId: 'p2', partnerIds: ['p2', 'p1'], active: true });
    const rows = await listPartners();
    expect(rows.find((r) => r.id === 'p1')!.picAccounts).toContain('budi@dipsi.co.id');
    expect(rows.find((r) => r.id === 'p2')!.picAccounts).toContain('budi@dipsi.co.id');
  });

  it('dikeluarkan dari satu mitra, akun tetap aktif untuk mitra lainnya', async () => {
    data.partners.p2 = { ...partner, name: 'PT Lain', nameKey: 'pt lain', pics: [{ name: 'Budi', phone: '', email: 'budi@dipsi.co.id' }] };
    data.users.x = { uid: 'x', role: 'partner', partnerId: 'p2', email: 'budi@dipsi.co.id', active: true };
    data.emailIndex[getEmailHash('budi@dipsi.co.id')] = { uid: 'x', role: 'partner' };
    await createPicAccounts('p1');
    const { nameKey: _k, active: _a, ...input } = partner;
    await updatePartner('p1', { ...input, pics: [partner.pics[0]] });
    expect(data.users.x).toMatchObject({ active: true, partnerId: 'p2', partnerIds: ['p2'] });
  });

  it('peserta tetap tidak bisa dijadikan PIC', async () => {
    data.users.s1 = { uid: 's1', role: 'student', email: 'budi@dipsi.co.id', active: true };
    data.emailIndex[getEmailHash('budi@dipsi.co.id')] = { uid: 's1', role: 'student' };
    await expect(createPicAccounts('p1')).rejects.toThrow('sudah dipakai akun lain');
  });

  it('mentor nonaktif yang dikeluarkan dari daftar PIC tetap kehilangan peran PIC', async () => {
    data.users.m1 = { uid: 'm1', role: 'mentor', email: 'budi@dipsi.co.id', name: 'Budi', active: true };
    data.emailIndex[getEmailHash('budi@dipsi.co.id')] = { uid: 'm1', role: 'mentor' };
    await createPicAccounts('p1');
    data.users.m1.active = false;
    const { nameKey: _k, active: _a, ...input } = partner;
    await updatePartner('p1', { ...input, pics: [partner.pics[0]] });
    expect(data.users.m1).toMatchObject({ roles: ['mentor'], partnerId: null });
  });
});

