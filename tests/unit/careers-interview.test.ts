// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { data, fakeDb, fakeStorage, reset } from './careers-fake-db';

const calendar = vi.hoisted(() => ({
  configured: true,
  create: vi.fn(async () => ({ eventId: 'ev-baru', meetUrl: 'https://meet.google.com/abc-defg-hij', conferenceStatus: 'success' })),
  cancel: vi.fn(async () => undefined),
}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn, revalidateTag: vi.fn() }));
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: vi.fn() }));
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb, getAdminStorage: () => fakeStorage }));
vi.mock('../../src/features/calendar/client', () => ({
  isCalendarConfigured: () => calendar.configured,
  createCalendarEvent: calendar.create,
  cancelCalendarEvent: calendar.cancel,
}));

import { interviewMessage, validateInterviewInput } from '../../src/features/careers/model';
import { inviteToInterview, listInterviews, respondInterview } from '../../src/features/careers/interview-service';
import { listMyApplications } from '../../src/features/careers/student-service';

const now = new Date('2026-11-05T00:00:00Z');
const rina = { uid: 'r1', role: 'partner', partnerId: 'p1', email: 'rina@dipsi.co.id', name: 'Rina' } as never;
const lain = { uid: 'r2', role: 'partner', partnerId: 'p2', email: 'x@lain.id', name: 'X' } as never;
const manual = { date: '2026-11-12', start: '10:00', durationMin: 45, mode: 'online', linkSource: 'manual', url: 'https://zoom.us/j/123', address: '', interviewer: 'Rina Kusuma', note: 'Siapkan portofolio' };

beforeEach(() => {
  calendar.configured = true; calendar.create.mockClear(); calendar.cancel.mockClear();
  reset({
    partners: { p1: { name: 'PT DIPSI' } },
    jobs: { j1: { partnerId: 'p1', partnerName: 'PT DIPSI', title: 'UI/UX Intern' } },
    jobApplications: {
      a1: { jobId: 'j1', partnerId: 'p1', studentId: 'u1', number: 'FM-JOB-0001', status: 'shortlist', rejectReason: '', submittedAt: '2026-11-04T00:00:00Z',
        personal: { fullName: 'Andi Pratama', email: 'andi@x.id', phone: '081234567890' } },
    },
  });
});

describe('model interview', () => {
  it('tanggal yang mustahil ditolak sebelum disimpan', () => {
    expect(() => validateInterviewInput({ ...manual, date: '2026-13-01' })).toThrow('Tanggal interview tidak sah');
  });

  it('durasi hanya 30, 45, atau 60 menit', () => {
    expect(() => validateInterviewInput({ ...manual, durationMin: 20 })).toThrow('Durasi interview tidak dikenal');
  });
  it('link sendiri wajib http(s), offline wajib alamat', () => {
    expect(() => validateInterviewInput({ ...manual, url: 'zoom.us/j/1' })).toThrow('Tautan harus diawali http:// atau https://');
    expect(() => validateInterviewInput({ ...manual, url: '' })).toThrow('Tempel link meeting');
    expect(() => validateInterviewInput({ ...manual, mode: 'offline', address: ' ' })).toThrow('Alamat kantor wajib diisi');
    expect(() => validateInterviewInput({ ...manual, interviewer: '' })).toThrow('Nama pewawancara wajib diisi');
  });
  it('pesan WhatsApp memuat posisi, perusahaan, jadwal, dan link', () => {
    const msg = interviewMessage({ studentName: 'Andi', jobTitle: 'UI/UX Intern', partnerName: 'PT DIPSI', interview: { ...validateInterviewInput(manual) } });
    for (const s of ['Andi', 'UI/UX Intern', 'PT DIPSI', '12 November 2026', '10.00–10.45 WIB', 'https://zoom.us/j/123', 'Rina Kusuma', 'Siapkan portofolio']) expect(msg).toContain(s);
  });
});

describe('undangan interview', () => {
  it('undangan link sendiri mengubah status dan memberi tautan WhatsApp', async () => {
    const r = await inviteToInterview(rina, 'a1', manual, now);
    expect(r.waLink).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    expect(data.jobApplications.a1).toMatchObject({ status: 'interview', interview: { mode: 'online', url: 'https://zoom.us/j/123', confirmation: 'pending', calendarEventId: null } });
    expect(calendar.create).not.toHaveBeenCalled();
  });

  it('Meet otomatis membuat acara kalender dengan PIC sebagai co-host', async () => {
    const r = await inviteToInterview(rina, 'a1', { ...manual, linkSource: 'meet-auto', url: '' }, now);
    expect(calendar.create).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: 'interview-a1', studentEmail: 'andi@x.id', mentorEmail: 'rina@dipsi.co.id', record: false,
      startsAt: '2026-11-12T03:00:00.000Z', endsAt: '2026-11-12T03:45:00.000Z',
    }));
    expect(r.meetUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(data.jobApplications.a1.interview).toMatchObject({ url: 'https://meet.google.com/abc-defg-hij', calendarEventId: 'ev-baru' });
  });

  it('Meet otomatis tanpa jembatan kalender ditolak dan status tetap', async () => {
    calendar.configured = false;
    await expect(inviteToInterview(rina, 'a1', { ...manual, linkSource: 'meet-auto', url: '' }, now)).rejects.toThrow('Link Meet otomatis belum tersedia. Tempel link meeting sendiri.');
    expect(data.jobApplications.a1.status).toBe('shortlist');
  });

  it('jadwal ulang membatalkan acara lama dan mengembalikan konfirmasi ke pending', async () => {
    await inviteToInterview(rina, 'a1', { ...manual, linkSource: 'meet-auto', url: '' }, now);
    await respondInterview({ uid: 'u1', role: 'student' } as never, 'a1', 'hadir', '');
    await inviteToInterview(rina, 'a1', { ...manual, date: '2026-11-13' }, now);
    expect(calendar.cancel).toHaveBeenCalledWith('ev-baru');
    expect(data.jobApplications.a1.interview).toMatchObject({ date: '2026-11-13', confirmation: 'pending', calendarEventId: null });
  });

  it('jadwal ulang yang gagal membuat acara baru tidak membatalkan undangan lama', async () => {
    await inviteToInterview(rina, 'a1', { ...manual, linkSource: 'meet-auto', url: '' }, now);
    calendar.create.mockRejectedValueOnce(new Error('Google Calendar HTTP 500'));
    await expect(inviteToInterview(rina, 'a1', { ...manual, linkSource: 'meet-auto', url: '', date: '2026-11-13' }, now)).rejects.toThrow('Google Calendar HTTP 500');
    expect(calendar.cancel).not.toHaveBeenCalled();
    expect(data.jobApplications.a1.interview).toMatchObject({ date: '2026-11-12', calendarEventId: 'ev-baru' });
  });

  it('acara baru tanpa link Meet dibatalkan lagi agar tidak menjadi undangan yatim', async () => {
    calendar.create.mockResolvedValueOnce({ eventId: 'ev-kosong', meetUrl: null, conferenceStatus: 'pending' } as never);
    await expect(inviteToInterview(rina, 'a1', { ...manual, linkSource: 'meet-auto', url: '' }, now)).rejects.toThrow('Link Meet belum terbentuk');
    expect(calendar.cancel).toHaveBeenCalledWith('ev-kosong');
    expect(data.jobApplications.a1.status).toBe('shortlist');
  });

  it('PIC perusahaan lain tidak bisa mengundang', async () => {
    await expect(inviteToInterview(lain, 'a1', manual, now)).rejects.toThrow('Lamaran tidak ditemukan');
  });
});

describe('konfirmasi siswa', () => {
  it('hanya pemilik lamaran berstatus interview yang bisa menjawab', async () => {
    await expect(respondInterview({ uid: 'u1', role: 'student' } as never, 'a1', 'hadir', '')).rejects.toThrow('Belum ada undangan interview');
    await inviteToInterview(rina, 'a1', manual, now);
    await expect(respondInterview({ uid: 'u2', role: 'student' } as never, 'a1', 'hadir', '')).rejects.toThrow('Lamaran tidak ditemukan');
    await expect(respondInterview({ uid: 'u1', role: 'student' } as never, 'a1', 'jadwal-ulang', ' ')).rejects.toThrow('Tulis alasan dan usulan waktu lain');
    await respondInterview({ uid: 'u1', role: 'student' } as never, 'a1', 'jadwal-ulang', 'Ada ujian, bisa Jumat?');
    expect(data.jobApplications.a1.interview).toMatchObject({ confirmation: 'jadwal-ulang', rescheduleNote: 'Ada ujian, bisa Jumat?' });
  });

  it('Lamaran Saya membawa undangan tanpa id acara kalender, dan PIC melihat daftar interview', async () => {
    await inviteToInterview(rina, 'a1', { ...manual, linkSource: 'meet-auto', url: '' }, now);
    const [a] = await listMyApplications('u1');
    expect(a.interview).toMatchObject({ date: '2026-11-12', url: 'https://meet.google.com/abc-defg-hij', confirmation: 'pending' });
    expect(a.interview).not.toHaveProperty('calendarEventId');
    expect((await listInterviews(rina)).map((i) => i.id)).toEqual(['a1']);
    expect(await listInterviews(lain)).toEqual([]);
  });
});
