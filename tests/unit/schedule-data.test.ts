import { describe, expect, it } from 'vitest';
import { SCHEDULE, VENUES, toIsoDate } from '../../scripts/schedule-data';

describe('toIsoDate', () => {
  it('membaca tanggal sebagai hari/bulan, bukan bulan/hari', () => {
    // Rencana program menulis 2/10/2026 untuk 2 Oktober. Date.parse membacanya
    // sebagai 10 Februari dalam tatanan Amerika, yang akan menggeser hampir
    // seluruh jadwal ke bulan yang keliru.
    //
    // The programme plan writes 2/10/2026 for 2 October. Date.parse reads that
    // as 10 February under US ordering, which would shift nearly the whole
    // schedule into the wrong month.
    expect(toIsoDate('2/10/2026')).toBe('2026-10-02');
    expect(toIsoDate('25/9/2026')).toBe('2026-09-25');
    expect(toIsoDate('12/11/2026')).toBe('2026-11-12');
  });

  it('menolak tanggal yang tidak dapat diurai', () => {
    expect(() => toIsoDate('bukan tanggal')).toThrow();
    expect(() => toIsoDate('32/13/2026')).toThrow();
  });
});

describe('data jadwal', () => {
  it('memuat 55 pertemuan pada empat kelas', () => {
    expect(SCHEDULE).toHaveLength(55);
    const kelas = new Set(SCHEDULE.map((r) => `${r.kota}|${r.jurusan}`));
    expect(kelas.size).toBe(4);
  });

  it('setiap tanggal dapat diurai menjadi ISO', () => {
    for (const row of SCHEDULE) {
      expect(() => toIsoDate(row.tanggal), `${row.kota} ${row.tanggal}`).not.toThrow();
      expect(toIsoDate(row.tanggal)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('nama hari cocok dengan tanggalnya', () => {
    // Salah ketik satu tanggal menggeser pertemuan ke hari yang salah tanpa
    // gejala apa pun; nama hari pada rencana adalah pemeriksa silangnya.
    //
    // A single mistyped date moves a meeting to the wrong day with no symptom;
    // the day name in the plan is the cross-check for it.
    const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    for (const row of SCHEDULE) {
      const aktual = namaHari[new Date(`${toIsoDate(row.tanggal)}T00:00:00Z`).getUTCDay()];
      expect(aktual, `${row.kota} ${row.tanggal} ${row.kegiatan}`).toBe(row.hari);
    }
  });

  it('setiap kelas punya urutan tanggal menaik', () => {
    const byClass = new Map<string, string[]>();
    for (const row of SCHEDULE) {
      const key = `${row.kota}|${row.jurusan}`;
      if (!byClass.has(key)) byClass.set(key, []);
      byClass.get(key)!.push(toIsoDate(row.tanggal));
    }
    for (const [key, dates] of byClass) {
      const sorted = [...dates].sort();
      expect(dates, key).toEqual(sorted);
    }
  });

  it('tidak ada tanggal ganda dalam satu kelas', () => {
    const seen = new Map<string, Set<string>>();
    for (const row of SCHEDULE) {
      const key = `${row.kota}|${row.jurusan}`;
      if (!seen.has(key)) seen.set(key, new Set());
      const iso = toIsoDate(row.tanggal);
      expect(seen.get(key)!.has(iso), `${key} ${iso} muncul dua kali`).toBe(false);
      seen.get(key)!.add(iso);
    }
  });

  it('jumlah pertemuan luring cocok dengan rencana lokasi', () => {
    // Semarang 6, tiga kota lain 4 -- angka yang dijanjikan kepada peserta
    // pada halaman program.
    //
    // Semarang 6, the other three 4 -- the figures promised to participants on
    // the programme page.
    const harapan: Record<string, number> = {
      Semarang: 6,
      Surabaya: 4,
      Yogyakarta: 4,
      'DKI Jakarta': 4,
    };
    for (const [kota, jumlah] of Object.entries(harapan)) {
      const luring = SCHEDULE.filter((r) => r.kota === kota && r.moda === 'Luring').length;
      expect(luring, kota).toBe(jumlah);
    }
  });

  it('setiap kota pada jadwal punya lokasi luring', () => {
    for (const row of SCHEDULE.filter((r) => r.moda === 'Luring')) {
      expect(VENUES[row.kota], row.kota).toBeDefined();
    }
  });
});

describe('lokasi luring', () => {
  it('setiap tautan Maps berupa HTTPS', () => {
    for (const [kota, venue] of Object.entries(VENUES)) {
      expect(venue.mapsUrl, kota).toMatch(/^https:\/\/www\.google\.com\/maps\//);
    }
  });

  it('tautan memuat nama tempat yang ter-encode', () => {
    // Tautan pencarian dipakai alih-alih koordinat yang dipasang sendiri: pin
    // yang meleset mengirim peserta ke gedung yang salah.
    //
    // A search link is used rather than hand-placed coordinates: a pin that
    // misses sends participants to the wrong building.
    for (const [kota, venue] of Object.entries(VENUES)) {
      expect(venue.mapsUrl, kota).toContain('query=');
      expect(venue.name.length, kota).toBeGreaterThan(0);
      expect(venue.address.length, kota).toBeGreaterThan(20);
    }
  });
});
