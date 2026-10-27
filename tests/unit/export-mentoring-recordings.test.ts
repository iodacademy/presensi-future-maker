// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

const lalu = '2026-10-20T08:00:00.000Z';
const nanti = '2999-01-01T00:00:00.000Z';
const data: Record<string, object[]> = {
  bookings: [
    { id: 'b2', classId: 'k1', date: '2026-10-21', startTime: '10:00', endTime: '11:00', endsAt: lalu, mentorName: 'Mentor B', studentName: 'Peserta 2', recordingUrl: 'https://drive.google.com/file/d/R2/view', status: 'confirmed' },
    { id: 'b1', classId: 'k1', date: '2026-10-20', startTime: '14:00', endTime: '15:00', endsAt: lalu, mentorName: 'Mentor A', studentName: 'Peserta 1', recordingUrl: 'https://drive.google.com/file/d/R1/view', status: 'confirmed' },
    // Belum selesai dan dibatalkan tidak ikut / Not finished and cancelled are left out
    { id: 'b3', classId: 'k1', date: '2999-01-01', startTime: '10:00', endTime: '11:00', endsAt: nanti, mentorName: 'M', studentName: 'P', recordingUrl: 'https://drive.google.com/x', status: 'confirmed' },
    { id: 'b4', classId: 'k1', date: '2026-10-19', startTime: '10:00', endTime: '11:00', endsAt: lalu, mentorName: 'M', studentName: 'P', recordingUrl: 'https://drive.google.com/y', status: 'cancelled' },
  ],
  classes: [{ id: 'k1', canonicalName: 'Data Analyst - DKI Jakarta' }],
};
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    collection: (name: string) => {
      const q = {
        where: () => q,
        select: () => q,
        get: async () => ({ docs: (data[name] ?? []).map((d) => ({ id: (d as { id: string }).id, data: () => d })) }),
      };
      return q;
    },
  }),
}));
const actor = { current: { uid: 'a', role: 'admin' } as { uid: string; role: string } | null };
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: async () => actor.current }));

import { GET } from '../../src/app/api/exports/mentoring-recordings/route';

describe('ekspor rekaman mentoring', () => {
  it('hanya sesi selesai yang punya rekaman, urut tanggal, satu sheet per kelas', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()));
    expect(wb.SheetNames).toEqual(['Data Analyst - DKI Jakarta']);
    const ws = wb.Sheets[wb.SheetNames[0]];
    expect(XLSX.utils.sheet_to_json(ws, { header: 1 })).toEqual([
      ['Tanggal', 'Nama Mentor', 'Nama Mentee', 'Link Rekaman'],
      ['Selasa, 20 Oktober 2026, 14:00–15:00 WIB', 'Mentor A', 'Peserta 1', 'https://drive.google.com/file/d/R1/view'],
      ['Rabu, 21 Oktober 2026, 10:00–11:00 WIB', 'Mentor B', 'Peserta 2', 'https://drive.google.com/file/d/R2/view'],
    ]);
    expect(ws.D2.l.Target).toBe('https://drive.google.com/file/d/R1/view');
  });

  it('hanya untuk admin', async () => {
    actor.current = { uid: 's', role: 'student' };
    expect((await GET()).status).toBe(403);
    actor.current = { uid: 'a', role: 'admin' };
  });
});
