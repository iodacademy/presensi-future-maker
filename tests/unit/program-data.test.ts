import { describe, expect, it } from 'vitest';
import {
  CURRICULUM,
  PACKAGE_ORDER,
  LOCATIONS,
  PROGRAM_STAGES,
  PROGRAM_ENDS_AT,
  PROGRAM_SOURCE_DATE,
  packageFromClassName,
} from '../../src/features/program/data';

describe('data program', () => {
  it('setiap paket punya 12 pertemuan', () => {
    for (const [key] of PACKAGE_ORDER) {
      expect(CURRICULUM[key].meetings, key).toHaveLength(12);
    }
  });

  it('nomor pertemuan luring berada dalam rentang yang ada', () => {
    // Nomor di luar 1-12 tidak akan pernah cocok dengan pertemuan mana pun,
    // sehingga penanda OFFLINE hilang diam-diam dan peserta mengira seluruh
    // sesi daring.
    //
    // A number outside 1-12 never matches any meeting, so the OFFLINE badge
    // silently disappears and participants assume every session is online.
    for (const [key] of PACKAGE_ORDER) {
      for (const n of CURRICULUM[key].offlineMeetings) {
        expect(n, `${key} pertemuan ${n}`).toBeGreaterThanOrEqual(1);
        expect(n, `${key} pertemuan ${n}`).toBeLessThanOrEqual(12);
      }
    }
  });

  it('jumlah sesi luring pada lokasi sejalan dengan kurikulumnya', () => {
    // Semarang menghitung showcase sebagai kunjungan tambahan, jadi
    // offlineCount boleh satu lebih banyak daripada pertemuan luring.
    //
    // Semarang counts the showcase as an extra visit, so offlineCount may
    // exceed the offline meetings by one.
    for (const loc of LOCATIONS) {
      const meetings = CURRICULUM[loc.packageKey].offlineMeetings.length;
      expect(loc.offlineCount, loc.city).toBeGreaterThanOrEqual(meetings);
      expect(loc.offlineCount - meetings, loc.city).toBeLessThanOrEqual(1);
    }
  });

  it('setiap tahap program punya judul dan tanggal', () => {
    expect(PROGRAM_STAGES.length).toBeGreaterThan(0);
    for (const s of PROGRAM_STAGES) {
      expect(s.title.trim()).not.toBe('');
      expect(s.date.trim()).not.toBe('');
    }
  });

  it('menebak paket dari nama kelas, dan menyerah bila tidak dikenali', () => {
    expect(packageFromClassName('Web Programming - Semarang')).toBe('web');
    expect(packageFromClassName('Data Analyst - DKI Jakarta')).toBe('data');
    expect(packageFromClassName('Social Media Marketing - Surabaya')).toBe('smm');
    expect(packageFromClassName('Kelas Baru')).toBeNull();
    expect(packageFromClassName(null)).toBeNull();
  });
});

describe('kesegaran data program', () => {
  /**
   * Data ini disalin dari projek landing page dan tidak terhubung dengannya.
   * Bila program sudah berakhir, isinya hampir pasti tidak lagi menggambarkan
   * keadaan dan tidak boleh terus disajikan kepada peserta seolah berlaku.
   *
   * This data is copied from the landing page project and is not linked to it.
   * Once the programme has ended, its contents almost certainly no longer
   * describe reality and must not keep being served to participants as current.
   */
  it('program belum berakhir', () => {
    const ended = new Date(PROGRAM_ENDS_AT) < new Date();
    expect(
      ended,
      `Program berakhir ${PROGRAM_ENDS_AT}. Data disalin ${PROGRAM_SOURCE_DATE} dari projek landing page ` +
        '(4. BOOTCAMP INNOV, src/config/program.ts). Perbarui src/features/program/data.ts atau hapus halaman Overview.'
    ).toBe(false);
  });

  it('tanggal sumber dan tanggal akhir berformat sah', () => {
    expect(PROGRAM_SOURCE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(PROGRAM_ENDS_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(new Date(PROGRAM_ENDS_AT).getTime())).toBe(false);
  });
});
