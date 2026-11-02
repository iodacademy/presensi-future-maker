import { describe, expect, it } from 'vitest';
import { cohortOf, nicknameOf, WORK_PRIORITY } from '../../src/features/exhibition/model';
import { TRACKS, TYPE } from '../../src/features/exhibition/content';

describe('model pameran', () => {
  it('memetakan program dan kota ke angkatan / maps program and city to a cohort', () => {
    expect(cohortOf({ programName: 'Web Programming', city: 'Semarang' })?.key).toBe('web-smg');
    expect(cohortOf({ programName: 'Data Analyst', city: 'DKI Jakarta' })?.key).toBe('da-jkt');
    expect(cohortOf({ programName: 'Social Media Marketing', city: 'Yogyakarta' })?.key).toBe('smm-yk');
    expect(cohortOf({ programName: 'Social Media Marketing', city: 'Surabaya' })?.key).toBe('smm-sby');
    expect(cohortOf({ programName: 'Web Programming', city: 'Bandung' })).toBeNull();
    expect(cohortOf({ programName: 'Web Programming', city: 'semarang' })?.key).toBe('web-smg');
  });

  it('nama panggilan adalah kata pertama / nickname is the first word', () => {
    expect(nicknameOf('  Adinda Puan Maharani ')).toBe('Adinda');
    expect(nicknameOf('Velssy')).toBe('Velssy');
  });

  it('jenis karya per jurusan / work types per track', () => {
    expect(TRACKS.web.types).toEqual(['Landing Page', 'Aplikasi Web', 'Capstone']);
    expect(TRACKS.da.types).toEqual(['Dashboard', 'Data Cleaning', 'Analisis Data']);
    expect(TRACKS.smm.types).toEqual(['Capstone', 'Konten Feed', 'Reels', 'Brand Identity', 'Laporan Campaign']);
    expect(Object.keys(TYPE)).not.toContain('REST API');
    expect(TYPE['Dashboard'].tools).toEqual(['Python', 'HTML']);
    expect(WORK_PRIORITY.slice(0, 3)).toEqual(['Capstone', 'Landing Page', 'Aplikasi Web']);
  });
});
