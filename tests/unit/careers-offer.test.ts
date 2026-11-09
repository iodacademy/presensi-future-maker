// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { data, fakeDb, fakeStorage, reset } from './careers-fake-db';

const calendar = vi.hoisted(() => ({
  create: vi.fn(async () => ({ eventId: 'ev-baru', meetUrl: 'https://meet.google.com/abc-defg-hij', conferenceStatus: 'success' })),
  cancel: vi.fn(async () => undefined),
}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn, revalidateTag: vi.fn() }));
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: vi.fn() }));
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb, getAdminStorage: () => fakeStorage }));
vi.mock('../../src/features/calendar/client', () => ({
  isCalendarConfigured: () => true, createCalendarEvent: calendar.create, cancelCalendarEvent: calendar.cancel,
}));

import { studentStatusLabel } from '../../src/features/careers/model';
import { careerReminders, markContacted, markProjectDone, respondOffer } from '../../src/features/careers/offer-service';
import { decideCandidate, partnerDashboard } from '../../src/features/careers/partner-service';
import { inviteToInterview, listInterviews } from '../../src/features/careers/interview-service';
import { latestPlacement } from '../../src/features/careers/student-service';

const now = new Date('2026-11-09T00:00:00Z');
const andi = { uid: 'u1', role: 'student', classId: 'k1' } as never;
const budi = { uid: 'u2', role: 'student', classId: 'k1' } as never;
const rina = { uid: 'r1', role: 'partner', partnerId: 'p1', email: 'rina@dipsi.co.id', name: 'Rina' } as never;
const personal = { fullName: 'Andi Pratama', email: 'andi@x.id', phone: '081234567890' };
const interview = { date: '2026-11-12', start: '10:00', durationMin: 45, mode: 'online', linkSource: 'meet-auto', url: 'https://meet.google.com/xyz', address: '', interviewer: 'Rina', note: '', confirmation: 'hadir', rescheduleNote: '', calendarEventId: 'ev-b', invitedAt: '2026-11-08T00:00:00Z' };
const app = (jobId: string, partnerId: string, status: string, extra: Record<string, unknown> = {}) =>
  ({ jobId, partnerId, studentId: 'u1', number: `FM-${jobId}`, status, rejectReason: '', submittedAt: '2026-11-04T00:00:00Z', personal, ...extra });

beforeEach(() => {
  calendar.create.mockClear(); calendar.cancel.mockClear();
  reset({
    partners: { p1: { name: 'PT DIPSI' }, p2: { name: 'PT Lain' }, p3: { name: 'PT Ketiga' } },
    jobs: {
      j1: { partnerId: 'p1', partnerName: 'PT DIPSI', title: 'Data Analyst Intern', status: 'published', closesAt: '2026-11-20T00:00:00Z' },
      j2: { partnerId: 'p2', partnerName: 'PT Lain', title: 'Web Developer Intern', status: 'published', closesAt: '2026-11-20T00:00:00Z' },
      j3: { partnerId: 'p3', partnerName: 'PT Ketiga', title: 'Social Media Intern', status: 'published', closesAt: '2026-11-20T00:00:00Z' },
      j4: { partnerId: 'p3', partnerName: 'PT Ketiga', title: 'Admin', status: 'published', closesAt: '2026-11-20T00:00:00Z' },
    },
    jobApplications: {
      a1: app('j1', 'p1', 'diterima'),
      a2: app('j2', 'p2', 'interview', { interview }),
      a3: app('j3', 'p3', 'tidak-lolos'),
      a4: app('j4', 'p3', 'baru'),
      b1: { ...app('j2', 'p2', 'diterima'), studentId: 'u2' },
    },
  });
});

describe('jawaban siswa atas tawaran', () => {
  it('menerima tawaran menutup lamaran lain yang masih berjalan, termasuk yang sudah dijadwalkan interview', async () => {
    await respondOffer(andi, 'a1', 'terima', now);
    expect(data.jobApplications.a1.status).toBe('bergabung');
    expect(data.jobApplications.a2.status).toBe('ditutup');
    expect(data.jobApplications.a4.status).toBe('ditutup');
    expect(data.jobApplications.a3.status).toBe('tidak-lolos');
    expect(data.jobApplications.b1.status).toBe('diterima');
    // Undangan Calendar interview yang ditutup ikut dibatalkan / The closed interview's Calendar invite is cancelled too
    expect(calendar.cancel).toHaveBeenCalledWith('ev-b');
    expect((data.jobApplications.a2.interview as { calendarEventId: unknown }).calendarEventId).toBeNull();
  });

  it('menolak tawaran tidak menyentuh lamaran lain', async () => {
    await respondOffer(andi, 'a1', 'tolak', now);
    expect(data.jobApplications.a1.status).toBe('menolak');
    expect(data.jobApplications.a2.status).toBe('interview');
  });

  it('hanya tawaran milik sendiri yang berstatus lolos yang bisa dijawab', async () => {
    await expect(respondOffer(budi, 'a1', 'terima', now)).rejects.toThrow('Lamaran tidak ditemukan');
    await expect(respondOffer(andi, 'a4', 'terima', now)).rejects.toThrow('Belum ada tawaran');
    await expect(respondOffer(andi, 'a1', 'mungkin', now)).rejects.toThrow('Jawaban tidak dikenal');
  });

  it('lamaran yang ditutup tidak bisa diproses PIC lagi', async () => {
    await respondOffer(andi, 'a1', 'terima', now);
    const pic2 = { uid: 'r2', role: 'partner', partnerId: 'p2', email: 'x@lain.id', name: 'X' } as never;
    await expect(decideCandidate(pic2, 'a2', 'diterima')).rejects.toThrow('Lamaran ini sudah final');
    await expect(inviteToInterview(pic2, 'a2', { ...interview, linkSource: 'manual', url: 'https://zoom.us/j/1' }, now)).rejects.toThrow('Lamaran ini sudah final');
    expect(calendar.create).not.toHaveBeenCalled();
  });

  it('lamaran tidak lolos tidak bisa dihidupkan lagi setelah kandidat menerima tawaran lain', async () => {
    await respondOffer(andi, 'a1', 'terima', now);
    const pic3 = { uid: 'r3', role: 'partner', partnerId: 'p3', email: 'p@k.id', name: 'Putri' } as never;
    await expect(decideCandidate(pic3, 'a3', 'diterima')).rejects.toThrow('Kandidat sudah menerima tawaran magang di tempat lain');
    expect(data.jobApplications.a3.status).toBe('tidak-lolos');
  });

  it('siswa tidak bisa memegang dua tawaran yang diterima', async () => {
    data.jobApplications.a3.status = 'bergabung';
    await expect(respondOffer(andi, 'a1', 'terima', now)).rejects.toThrow('Kamu sudah menerima tawaran magang lain');
    expect(data.jobApplications.a1.status).toBe('diterima');
  });
});

describe('PIC menghubungi kandidat', () => {
  it('meloloskan kandidat memberi tautan WhatsApp ucapan selamat dan masuk daftar segera hubungi', async () => {
    data.jobApplications.a4.status = 'interview';
    const pic3 = { uid: 'r3', role: 'partner', partnerId: 'p3', email: 'p@k.id', name: 'Putri' } as never;
    const r = await decideCandidate(pic3, 'a4', 'diterima');
    expect(r.waLink).toContain('https://wa.me/6281234567890?text=');
    expect(decodeURIComponent(r.waLink!)).toContain('lolos seleksi posisi Admin di PT Ketiga');
    const d = await partnerDashboard(pic3, now);
    expect(d.toContact.map((x: { id: string }) => x.id)).toEqual(['a4']);
    await markContacted(pic3, 'a4', now);
    expect((await partnerDashboard(pic3, now)).toContact).toEqual([]);
  });

  it('jadwal interview membawa tautan WhatsApp berisi waktu dan link', async () => {
    const pic2 = { uid: 'r2', role: 'partner', partnerId: 'p2', email: 'x@lain.id', name: 'X' } as never;
    const [row] = await listInterviews(pic2);
    const text = decodeURIComponent(row.waLink!);
    expect(text).toContain('Kamu diundang interview pada');
    expect(text).toContain('https://meet.google.com/xyz');
  });
});

describe('notifikasi siswa', () => {
  it('label status: lolos ke interview, lalu lolos', () => {
    expect(studentStatusLabel('interview')).toBe('Lolos ke tahap interview');
    expect(studentStatusLabel('diterima')).toBe('Lolos');
    expect(studentStatusLabel('ditutup')).toBe('Ditutup');
  });

  it('undangan interview yang belum dikonfirmasi dan tawaran yang belum dijawab muncul sebagai notifikasi', async () => {
    (data.jobApplications.a2.interview as { confirmation: string }).confirmation = 'pending';
    const rows = await careerReminders('u1');
    expect(rows).toEqual([
      { appId: 'a1', kind: 'tawaran', jobTitle: 'Data Analyst Intern', partnerName: 'PT DIPSI' },
      { appId: 'a2', kind: 'interview', jobTitle: 'Web Developer Intern', partnerName: 'PT Lain' },
    ]);
    (data.jobApplications.a2.interview as { confirmation: string }).confirmation = 'hadir';
    expect((await careerReminders('u1')).map((r) => r.kind)).toEqual(['tawaran']);
  });
});

describe('akun demo', () => {
  it('peserta kelas demo selalu berskema Full Internship', async () => {
    expect(await latestPlacement('siapa-saja', 'demo')).toBe('full');
    expect(await latestPlacement('siapa-saja', 'k1')).toBeNull();
  });
});

describe('Project Based: beberapa proyek sekaligus', () => {
  // Andi SPA 80 (tier B, jatah proyek 2) / Andi SPA 80 (tier B, two project slots)
  beforeEach(() => {
    data.dashboardSnapshots = { s: { generatedAt: '2026-11-08T00:00:00Z', version: 19, ranking: [{ studentId: 'u1', score: 80, pending: [], placement: 'full' }] } };
    Object.assign(data.jobApplications.a1, { scheme: 'project' });
    Object.assign(data.jobApplications.a2, { scheme: 'full' });
    Object.assign(data.jobApplications.a4, { scheme: 'project' });
  });

  it('menerima proyek hanya menutup lamaran Full Internship; lamaran proyek lain tetap berjalan', async () => {
    await respondOffer(andi, 'a1', 'terima', now);
    expect(data.jobApplications.a1.status).toBe('bergabung');
    expect(data.jobApplications.a2.status).toBe('ditutup');
    expect(data.jobApplications.a4.status).toBe('baru');
    expect(calendar.cancel).toHaveBeenCalledWith('ev-b');
  });

  it('proyek kedua bisa diterima selama jatah masih ada, lalu penuh', async () => {
    data.jobApplications.a3 = app('j3', 'p3', 'bergabung', { scheme: 'project' });
    await respondOffer(andi, 'a1', 'terima', now);
    expect(data.jobApplications.a1.status).toBe('bergabung');
    data.jobApplications.a4.status = 'diterima';
    await expect(respondOffer(andi, 'a4', 'terima', now)).rejects.toThrow('Jatah proyekmu sedang penuh');
    expect(data.jobApplications.a4.status).toBe('diterima');
  });

  it('peserta yang sudah menerima Full Internship tidak bisa menerima proyek', async () => {
    data.jobApplications.a3 = app('j3', 'p3', 'bergabung', { scheme: 'full' });
    await expect(respondOffer(andi, 'a1', 'terima', now)).rejects.toThrow('Kamu sudah menerima tawaran magang lain');
  });

  it('PIC tetap bisa meloloskan lamaran proyek lain dari kandidat yang sedang mengerjakan proyek', async () => {
    await respondOffer(andi, 'a1', 'terima', now);
    const pic3 = { uid: 'r3', role: 'partner', partnerId: 'p3', email: 'p@k.id', name: 'Putri' } as never;
    await decideCandidate(pic3, 'a4', 'diterima');
    expect(data.jobApplications.a4.status).toBe('diterima');
  });

  it('PIC mitranya sendiri dan admin menandai proyek selesai', async () => {
    await respondOffer(andi, 'a1', 'terima', now);
    const pic2 = { uid: 'r2', role: 'partner', partnerId: 'p2', email: 'x@lain.id', name: 'X' } as never;
    await expect(markProjectDone('a1', now, pic2)).rejects.toThrow('Lamaran tidak ditemukan');
    await expect(markProjectDone('a4', now)).rejects.toThrow('Hanya proyek yang sedang berjalan');
    await markProjectDone('a1', now, rina);
    expect(data.jobApplications.a1.completedAt).toBe(now.toISOString());
    await expect(markProjectDone('a1', now)).rejects.toThrow('Hanya proyek yang sedang berjalan');
  });
});
