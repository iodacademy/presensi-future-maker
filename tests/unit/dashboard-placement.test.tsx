import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PlacementGroups } from '../../src/app/(admin)/admin/dashboard/placement-groups';
import { byPerformance, RankingGroups } from '../../src/app/(admin)/admin/dashboard/ranking-groups';
import type { RankedStudent } from '../../src/features/dashboard/snapshot-types';

const row = (studentName: string, city: string, placement: RankedStudent['placement'], placementReasons: string[] = []): RankedStudent => ({
  studentId: studentName, studentName, className: 'Web ' + city, city, score: 80, capstone: 80, tasks: 90, attendance: 100, quiz: 70, combined: 84, absent: 0,
  componentDetails: { attendance: '12 dari 12 pertemuan' }, placement, placementReasons,
  perfScore: 85, perfAttendance: 100, perfTasks: 90, perfQuiz: 70,
});
const jurusan = new Map([['Web Semarang', 'Web Programming'], ['Web Surabaya', 'Web Programming']]);

afterEach(cleanup);

describe('panel skema magang', () => {
  it('satu tab per kelompok; tab dibuka menampilkan seluruh nilai komponen', () => {
    render(<PlacementGroups jurusanKelas={jurusan} rows={[
      row('Roi', 'Semarang', 'full'),
      row('Vero', 'Semarang', 'project', ['Nilai TPM + capstone di bawah 70']),
      row('Andi', 'Surabaya', 'pending', ['Capstone belum dinilai']),
    ]} />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    // Tab awal adalah kelompok yang skemanya sudah ditentukan / The first tab is the decided group
    expect(screen.getByText('Roi')).toBeTruthy();
    expect(screen.queryByText('Andi')).toBeNull();
    expect(screen.getAllByText('12 dari 12 pertemuan').length).toBe(2);
    expect(screen.getByText('Nilai TPM + capstone di bawah 70')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Surabaya/ }));
    expect(screen.getByText('Andi')).toBeTruthy();
    expect(screen.getByText(/skema magangnya belum bisa ditentukan/)).toBeTruthy();
  });

  it('peserta yang tidak mengumpulkan capstone diberi tanda', () => {
    render(<PlacementGroups jurusanKelas={jurusan} rows={[{ ...row('Budi', 'Semarang', 'none', ['Tidak mengumpulkan capstone']), capstoneMissing: true }]} />);
    expect(screen.getAllByText('Tidak mengumpulkan capstone').length).toBeGreaterThanOrEqual(2);
  });

  it('tanda tidak mengumpulkan capstone juga muncul di Performance terbaik', () => {
    render(<RankingGroups jurusanKelas={jurusan} rows={[{ ...row('Budi', 'Semarang', 'none'), capstoneMissing: true }, row('Roi', 'Semarang', 'full')]} />);
    expect(screen.getAllByText('Tidak mengumpulkan capstone')).toHaveLength(1);
  });

  it('peserta bernilai kasus khusus diberi tanda beserta alasannya', () => {
    render(<PlacementGroups jurusanKelas={jurusan} rows={[{ ...row('Budi', 'Semarang', 'full'), specialCase: 'Kasus khusus: diterima mitra lewat seleksi awal' }]} />);
    const tanda = screen.getByText('Nilai kasus khusus');
    expect(tanda.getAttribute('title')).toBe('Kasus khusus: diterima mitra lewat seleksi awal');
  });

  it('kartu skema menyaring tabel', () => {
    render(<PlacementGroups jurusanKelas={jurusan} rows={[row('Roi', 'Semarang', 'full'), row('Vero', 'Semarang', 'project')]} />);
    fireEvent.click(screen.getByRole('button', { name: /Project Based/ }));
    expect(screen.queryByText('Roi')).toBeNull();
    expect(screen.getByText('Vero')).toBeTruthy();
  });
});

describe('urutan Performance Terbaik', () => {
  it('skor, kehadiran, dan TPM sama: kuis menentukan', () => {
    const a = { ...row('Zalfa', 'Semarang', 'full'), perfScore: 98.7, perfTasks: 97.5, perfQuiz: 96.9 };
    const b = { ...row('Selvi', 'Semarang', 'full'), perfScore: 98.7, perfTasks: 97.5, perfQuiz: 98.5 };
    expect([a, b].sort(byPerformance).map((r) => r.studentName)).toEqual(['Selvi', 'Zalfa']);
  });
});
