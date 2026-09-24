// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Penghapusan berantai tidak dapat diuji tanpa emulator Firestore, sedangkan
 * kesalahannya justru yang paling mahal: sekali dijalankan di produksi, hasil
 * kerja peserta lenyap tanpa salinan.
 *
 * Pemeriksaan di bawah membaca sumbernya dan memastikan setiap pembersihan yang
 * diwajibkan peta ketergantungan benar-benar ada. Ini bukan pengganti uji
 * integrasi, melainkan penjaga agar satu baris yang terhapus saat penyuntingan
 * tidak lolos diam-diam.
 *
 * Cascading deletion cannot be exercised without a Firestore emulator, yet its
 * mistakes are the costliest: run once in production, participant work is gone
 * with no copy.
 *
 * The checks below read the source and confirm every cleanup the dependency map
 * requires is actually present. This is no substitute for integration tests,
 * but it guards against a line quietly disappearing during an edit.
 */
const source = readFileSync(resolve(process.cwd(), 'src/features/admin/delete-service.ts'), 'utf-8');

function block(fnName: string): string {
  const start = source.indexOf(`export async function ${fnName}`);
  if (start === -1) throw new Error(`fungsi ${fnName} tidak ditemukan`);
  const next = source.indexOf('\nexport ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

describe('deleteTask', () => {
  const body = block('deleteTask');

  it('membersihkan requiredDailyTaskIds', () => {
    // Capstone terbuka hanya bila setiap tugas dalam daftar itu sudah
    // dikumpulkan. Tugas yang dihapus tidak akan pernah bisa dikumpulkan, jadi
    // ID yang tertinggal mengunci Capstone selamanya bagi seluruh kelas.
    //
    // The Capstone unlocks only when every task in that list has been
    // submitted. A deleted task can never be submitted, so a leftover ID locks
    // the Capstone forever for the whole class.
    expect(body).toContain('requiredDailyTaskIds');
    expect(body).toMatch(/filter\(\(id\) => id !== taskId\)/);
  });

  it('mengosongkan capstoneTaskId bila capstone yang dihapus', () => {
    // capstoneTaskCount yang tertinggal menolak penambahan Capstone pengganti.
    // A leftover capstoneTaskCount refuses any replacement Capstone.
    expect(body).toContain('capstoneTaskId');
  });

  it('mengurangi penghitung tugas di kelas', () => {
    expect(body).toMatch(/Math\.max\(0, \(cls\[field\] \|\| 0\) - 1\)/);
  });

  it('menghapus taskDetails, submissions, dan submissionFeedback', () => {
    expect(body).toContain('taskDetails');
    expect(body).toContain('submissionFeedback');
    expect(body).toMatch(/subsSnap\.docs\.map/);
  });
});

describe('deleteSession', () => {
  const body = block('deleteSession');

  it('menghapus seluruh catatan kehadirannya', () => {
    expect(body).toContain("collection('attendance')");
    expect(body).toMatch(/where\('sessionId', '==', sessionId\)/);
  });
});

describe('deleteMentoringSlot', () => {
  const body = block('deleteMentoringSlot');

  it('mengembalikan kuota peserta', () => {
    // Tanpa pengembalian, peserta kehilangan satu dari dua jatah sesinya tanpa
    // pernah memakainya.
    //
    // Without a refund the participant loses one of their two session
    // allowances without ever using it.
    expect(body).toContain('mentoringQuotas');
    expect(body).toMatch(/Math\.max\(0,/);
  });

  it('memakai set-merge, bukan update, untuk kuota', () => {
    // update melempar galat bila dokumen kuota belum pernah dibuat, dan itu
    // membatalkan seluruh penghapusan.
    //
    // update throws when the quota document was never created, which aborts the
    // whole deletion.
    expect(body).toMatch(/tx\.set\(\s*quotaRef/);
    expect(body).not.toMatch(/tx\.update\(\s*quotaRef/);
  });

  it('membatalkan undangan Google Calendar', () => {
    expect(body).toContain('cancelCalendarEvent');
  });

  it('menghapus dokumen booking yang menempatinya', () => {
    expect(body).toContain('bookingRef.delete()');
  });
});

describe('deleteClass', () => {
  const body = block('deleteClass');

  it('menghapus classKeys', () => {
    // classKeys adalah penjaga keunikan Kota+Program. Bila tertinggal,
    // kombinasi yang sama tidak akan pernah dapat dibuat lagi.
    //
    // classKeys is the City+Program uniqueness guard. Left behind, the same
    // combination could never be created again.
    expect(body).toContain("collection('classKeys')");
  });

  it('melepaskan peserta dari kelas, bukan menghapus akunnya', () => {
    // Akun memuat riwayat dan identitas login yang tidak terikat satu kelas.
    // An account carries history and a login identity not tied to one class.
    expect(body).toMatch(/classId: null/);
    expect(body).not.toMatch(/students\.docs\.map\(\(d\) => d\.ref\)/);
  });

  it('menghapus seluruh koleksi anak', () => {
    for (const col of ['tasks', 'taskDetails', 'sessions', 'attendance', 'submissions', 'submissionFeedback', 'mentoringSlots', 'bookings', 'assignments']) {
      expect(body, col).toContain(col);
    }
  });

  it('membatalkan undangan Google Calendar milik booking', () => {
    expect(body).toContain('cancelCalendarEvent');
  });
});

describe('penjagaan peran', () => {
  it('setiap fungsi publik memeriksa peran admin', () => {
    const exported = [...source.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    expect(exported.length).toBeGreaterThan(0);
    for (const fn of exported) {
      expect(block(fn), fn).toContain('requireAdmin(actor)');
    }
  });
});

describe('batas batch Firestore', () => {
  it('memecah penghapusan agar tidak melampaui 500 operasi', () => {
    // Satu batch Firestore dibatasi 500 operasi; kelas dengan puluhan peserta
    // melampauinya, dan batch yang kelebihan gagal seluruhnya.
    //
    // A Firestore batch caps at 500 operations; a class with dozens of
    // participants exceeds it, and an oversized batch fails entirely.
    expect(source).toMatch(/BATCH_LIMIT\s*=\s*4\d\d/);
    expect(source).toMatch(/i \+= BATCH_LIMIT/);
  });
});
