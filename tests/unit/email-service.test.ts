// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { data, fakeDb, reset, selects } from './careers-fake-db';

const sendBridgeEmails = vi.fn();
const getSnapshot = vi.fn();
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb }));
vi.mock('../../src/features/calendar/client', () => ({ sendBridgeEmails: (m: unknown) => sendBridgeEmails(m) }));
vi.mock('../../src/features/dashboard/snapshot-service', () => ({ getSnapshot: (a: unknown) => getSnapshot(a) }));

import { listLogs, listRecipients, listTemplates, saveTemplate, sendEmails, sendTestEmail } from '../../src/features/email/service';

const admin = { uid: 'adm', role: 'admin', name: 'Admin' } as never;
const rank = (studentId: string, score: number, placement: string, reasons: string[] = []) => ({
  studentId, studentName: `Peserta ${studentId}`, className: 'Social Media Marketing - Surabaya', city: 'Surabaya', score, placement, placementReasons: reasons,
});

beforeEach(() => {
  reset({
    users: {
      a: { name: 'Peserta a', email: 'a@x.id', role: 'student' },
      b: { name: 'Peserta b', email: 'b@x.id', role: 'student' },
      c: { name: 'Peserta c', email: 'c@x.id', role: 'student' },
    },
  });
  getSnapshot.mockResolvedValue({ ranking: [rank('a', 80, 'full'), rank('b', 62, 'none', ['Nilai TPM + capstone di bawah 50']), rank('c', 30, 'none', ['SPA di bawah 50'])] });
  sendBridgeEmails.mockReset();
  sendBridgeEmails.mockImplementation(async (m: { to: string }[]) => ({ results: m.map((x) => ({ to: x.to, ok: true })), quota: 90 }));
});

describe('template email', () => {
  it('membuat tiga template awal saat koleksinya masih kosong', async () => {
    const t = await listTemplates();
    expect(t.map((x) => x.category)).toEqual(['lulus-magang', 'lulus-tanpa-magang', 'tidak-lulus']);
    expect(Object.keys(data.emailTemplates)).toHaveLength(3);
  });

  it('menyimpan perubahan template yang sudah ada', async () => {
    await listTemplates();
    await saveTemplate('tidak-lulus', { name: 'Tidak lulus', category: 'tidak-lulus', subject: 'Subjek baru', body: 'Halo {nama}' });
    expect(data.emailTemplates['tidak-lulus']).toMatchObject({ subject: 'Subjek baru', body: 'Halo {nama}' });
  });
});

describe('penerima email', () => {
  it('menggabungkan status dari dashboard dengan email akun', async () => {
    const r = await listRecipients(admin);
    expect(r.map((x) => [x.studentId, x.email, x.category])).toEqual([
      ['a', 'a@x.id', 'lulus-magang'], ['b', 'b@x.id', 'lulus-tanpa-magang'], ['c', 'c@x.id', 'tidak-lulus'],
    ]);
    // Akun dibaca dengan kolom terbatas / Accounts are read with limited columns
    expect(selects.users?.[0]).toEqual(['name', 'email']);
  });
});

describe('kirim email', () => {
  it('mengirim isi yang sudah diisi per peserta dan mencatat riwayat', async () => {
    await listTemplates();
    const out = await sendEmails(admin, { templateId: 'lulus-tanpa-magang', studentIds: ['b'] });
    expect(out).toMatchObject({ sent: 1, failed: 0, skipped: 0, quota: 90 });
    const pesan = sendBridgeEmails.mock.calls[0][0][0];
    expect(pesan.to).toBe('b@x.id');
    expect(pesan.body).toContain('Halo Peserta b');
    expect(pesan.body).toContain('nilai TPM + capstone di bawah 50');
    const log = Object.values(data.emailLogs)[0];
    expect(log).toMatchObject({ studentId: 'b', templateId: 'lulus-tanpa-magang', status: 'terkirim', sentBy: 'Admin' });
  });

  it('tidak mengirim dua kali template yang sama kecuali dikirim ulang', async () => {
    await listTemplates();
    await sendEmails(admin, { templateId: 'tidak-lulus', studentIds: ['c'] });
    const lagi = await sendEmails(admin, { templateId: 'tidak-lulus', studentIds: ['c'] });
    expect(lagi).toMatchObject({ sent: 0, skipped: 1 });
    expect(sendBridgeEmails).toHaveBeenCalledTimes(1);
    const ulang = await sendEmails(admin, { templateId: 'tidak-lulus', studentIds: ['c'], resend: true });
    expect(ulang).toMatchObject({ sent: 1, skipped: 0 });
  });

  it('mencatat kegagalan per penerima tanpa menggagalkan yang lain', async () => {
    await listTemplates();
    sendBridgeEmails.mockImplementation(async (m: { to: string }[]) => ({ results: m.map((x) => ({ to: x.to, ok: x.to !== 'a@x.id', error: x.to === 'a@x.id' ? 'Kuota habis' : undefined })), quota: 0 }));
    const out = await sendEmails(admin, { templateId: 'lulus-magang', studentIds: ['a', 'b'] });
    expect(out).toMatchObject({ sent: 1, failed: 1 });
    const logs = Object.values(data.emailLogs);
    expect(logs.find((l) => l.studentId === 'a')).toMatchObject({ status: 'gagal', error: 'Kuota habis' });
    // Yang gagal boleh dikirim lagi tanpa tanda kirim ulang / A failed one may be sent again without the resend flag
    sendBridgeEmails.mockImplementation(async (m: { to: string }[]) => ({ results: m.map((x) => ({ to: x.to, ok: true })), quota: 50 }));
    expect(await sendEmails(admin, { templateId: 'lulus-magang', studentIds: ['a'] })).toMatchObject({ sent: 1, skipped: 0 });
  });

  it('menolak peserta yang tidak ada di daftar dan template yang tidak ada', async () => {
    await listTemplates();
    await expect(sendEmails(admin, { templateId: 'x', studentIds: ['a'] })).rejects.toThrow('Template');
    await expect(sendEmails(admin, { templateId: 'tidak-lulus', studentIds: ['zz'] })).rejects.toThrow('tidak ditemukan');
    await expect(sendEmails(admin, { templateId: 'tidak-lulus', studentIds: [] })).rejects.toThrow('Pilih');
  });

  it('riwayat tidak memuat isi email', async () => {
    await listTemplates();
    await sendEmails(admin, { templateId: 'tidak-lulus', studentIds: ['c'] });
    const logs = await listLogs();
    expect(logs[0]).not.toHaveProperty('body');
    expect(logs[0]).toMatchObject({ studentName: 'Peserta c', email: 'c@x.id', status: 'terkirim' });
  });

  it('kirim uji memakai data satu peserta, ke alamat uji, tanpa tercatat di riwayat', async () => {
    await listTemplates();
    await sendTestEmail(admin, { templateId: 'lulus-magang', studentId: 'a', to: 'uji@contoh.id' });
    const pesan = sendBridgeEmails.mock.calls[0][0][0];
    expect(pesan.to).toBe('uji@contoh.id');
    expect(pesan.subject.startsWith('[UJI] ')).toBe(true);
    expect(pesan.body).toContain('Halo Peserta a');
    expect(pesan.htmlBody).toContain('Future Innovators Bootcamp');
    expect(data.emailLogs).toBeUndefined();
    await expect(sendTestEmail(admin, { templateId: 'lulus-magang', studentId: 'a', to: 'bukan-email' })).rejects.toThrow('Alamat email uji');
  });
});
