import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PlacementGroups } from '../../src/app/(admin)/admin/dashboard/placement-groups';
import { byPerformance } from '../../src/app/(admin)/admin/dashboard/ranking-groups';
import type { RankedStudent } from '../../src/features/dashboard/snapshot-types';

const row = (studentName: string, city: string, placement: RankedStudent['placement'], placementReasons: string[] = []): RankedStudent => ({
  studentId: studentName, studentName, className: 'Web ' + city, city, score: 80, capstone: 80, tasks: 90, attendance: 100, quiz: 70, unexcused: 0,
  componentDetails: { attendance: '12 dari 12 pertemuan' }, placement, placementReasons,
  perfScore: 85, perfQuiz: 70,
});
const jurusan = new Map([['Web Semarang', 'Web Programming'], ['Web Surabaya', 'Web Programming']]);

afterEach(cleanup);

describe('panel skema magang', () => {
  it('satu tab per kelompok; tab dibuka menampilkan seluruh nilai komponen', () => {
    render(<PlacementGroups jurusanKelas={jurusan} rows={[
      row('Roi', 'Semarang', 'full'),
      row('Vero', 'Semarang', 'project', ['Capstone di bawah 75']),
      row('Andi', 'Surabaya', 'pending', ['Capstone belum dinilai']),
    ]} />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    // Tab awal adalah kelompok yang skemanya sudah ditentukan / The first tab is the decided group
    expect(screen.getByText('Roi')).toBeTruthy();
    expect(screen.queryByText('Andi')).toBeNull();
    expect(screen.getAllByText('12 dari 12 pertemuan').length).toBe(2);
    expect(screen.getByText('Capstone di bawah 75')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Surabaya/ }));
    expect(screen.getByText('Andi')).toBeTruthy();
    expect(screen.getByText(/skema magangnya belum bisa ditentukan/)).toBeTruthy();
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
    const a = { ...row('Zalfa', 'Semarang', 'full'), perfScore: 99, tasks: 98, perfQuiz: 97 };
    const b = { ...row('Selvi', 'Semarang', 'full'), perfScore: 99, tasks: 98, perfQuiz: 98 };
    expect([a, b].sort(byPerformance).map((r) => r.studentName)).toEqual(['Selvi', 'Zalfa']);
  });
});
