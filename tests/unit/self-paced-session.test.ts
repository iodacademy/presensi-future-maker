// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isSessionAttendanceActive, takesAttendance } from '../../src/features/attendance/policy';
import type { SessionDocument } from '../../src/features/attendance/types';
import { countAbsent, gradedMeetings } from '../../src/features/grading/policy';
import { buildStudentPerformance } from '../../src/features/dashboard/performance';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');

function session(overrides: Partial<SessionDocument> = {}): SessionDocument {
  return {
    id: 's1', classId: 'c1', title: 'Pertemuan 2 (Mandiri): Ekosistem', date: '2026-12-01', startTime: '19:00', endTime: '22:00',
    startsAt: '2026-12-01T12:00:00.000Z', endsAt: '2026-12-01T15:00:00.000Z', mode: 'online', zoomUrl: null, address: null, mapsUrl: null,
    attendanceOverride: 'auto', qrRevision: 1, attendeeCount: 0, createdAt: '2026-11-27T00:00:00.000Z', updatedAt: '2026-11-27T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Sesi mandiri (self paced) tampil di jadwal bersama materinya, tetapi tidak
 * memakai presensi. Bila ikut dihitung, setiap sesi mandiri yang lewat tercatat
 * sebagai absen bagi semua peserta dan menurunkan nilai kehadirannya.
 *
 * Self-paced sessions show on the schedule with their materials but take no
 * attendance. If counted, every past self-paced session is recorded as absent
 * for every participant and drags their attendance score down.
 */
describe('sesi mandiri tanpa presensi', () => {
  it('QR presensinya tidak pernah aktif, termasuk saat dibuka manual', () => {
    const during = '2026-12-01T13:00:00.000Z';
    expect(isSessionAttendanceActive(session(), during)).toBe(true);
    expect(isSessionAttendanceActive(session({ selfPaced: true }), during)).toBe(false);
    expect(isSessionAttendanceActive(session({ selfPaced: true, attendanceOverride: 'open' }), during)).toBe(false);
    expect(takesAttendance({ selfPaced: true })).toBe(false);
    expect(takesAttendance({})).toBe(true);
  });

  it('tidak termasuk pertemuan yang dinilai maupun hitungan absen', () => {
    const sessions = [
      { id: 'live', title: 'Pertemuan 1: Fondasi', endsAt: '2026-11-30T15:00:00.000Z' },
      { id: 'mandiri', title: 'Pertemuan 2 (Mandiri): Ekosistem', endsAt: '2026-12-01T15:00:00.000Z', selfPaced: true },
    ];
    expect(gradedMeetings(sessions, '', () => false).map((s) => s.id)).toEqual(['live']);
    expect(countAbsent({ sessions, joinIso: '', nowIso: '2026-12-05T00:00:00.000Z', status: () => undefined })).toBe(1);
  });

  it('tidak muncul di daftar presensi kartu performa peserta', () => {
    const { attendance } = buildStudentPerformance({
      sessions: [
        { id: 'live', title: 'Pertemuan 1', startsAt: '2026-11-30T12:00:00.000Z', endsAt: '2026-11-30T15:00:00.000Z' },
        { id: 'mandiri', title: 'Pertemuan 2 (Mandiri)', startsAt: '2026-12-01T12:00:00.000Z', endsAt: '2026-12-01T15:00:00.000Z', selfPaced: true },
      ],
      attendance: [], exams: [], attempts: [], tasks: [], submissions: [], nowIso: '2026-12-05T00:00:00.000Z',
    });
    expect(attendance.map((a) => a.sessionId)).toEqual(['live']);
  });

  it('disimpan saat pertemuan dibuat atau diubah, dan presensi manualnya ditolak', () => {
    const service = read('src/features/attendance/service.ts');
    const create = service.slice(service.indexOf('export async function createSession'), service.indexOf('export async function listSessionsForClass'));
    expect(create).toMatch(/selfPaced: input\.selfPaced === true/);
    const update = service.slice(service.indexOf('export async function updateSession'), service.indexOf('\nexport ', service.indexOf('export async function updateSession') + 1));
    expect(update).toMatch(/selfPaced/);
    const manual = service.slice(service.indexOf('export async function setAttendanceStatus'), service.indexOf('\nexport ', service.indexOf('export async function setAttendanceStatus') + 1));
    expect(manual).toMatch(/selfPaced/);
  });

  it('dashboard dan beranda peserta hanya menghitung pertemuan berpresensi', () => {
    const snapshot = read('src/features/dashboard/snapshot-service.ts');
    expect(snapshot).toMatch(/const sesiPresensi = sessions\.filter\(takesAttendance\)/);
    expect(snapshot).toMatch(/for \(const s of sesiPresensi\)/);
    expect(snapshot).toMatch(/for \(const x of sesiPresensi\)/);
    expect(snapshot).toMatch(/for \(const sesi of sesiPresensi\)/);
    const home = read('src/features/dashboard/service.ts');
    expect(home).toMatch(/takesAttendance\(s\) && s\.endsAt <= nowIso/);
    // Bacaan berkolom terpilih harus ikut membawa penandanya / Narrow reads must carry the flag too
    expect(read('src/features/grading/service.ts')).toMatch(/select\('endsAt', 'title', 'selfPaced'\)/);
    expect(read('src/features/dashboard/student-detail-service.ts')).toMatch(/select\('id', 'title', 'startsAt', 'endsAt', 'selfPaced'\)/);
  });
});
