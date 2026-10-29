import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PlacementGroups } from '../../src/app/(admin)/admin/dashboard/placement-groups';
import type { RankedStudent } from '../../src/features/dashboard/snapshot-types';

const row = (studentName: string, city: string, placement: RankedStudent['placement'], placementReasons: string[] = []): RankedStudent => ({
  studentId: studentName, studentName, className: 'Web ' + city, city, score: 80, capstone: 80, attendance: 100, unexcused: 0, placement, placementReasons,
});
const jurusan = new Map([['Web Semarang', 'Web Programming'], ['Web Surabaya', 'Web Programming']]);

afterEach(cleanup);

describe('panel skema magang', () => {
  it('mengelompokkan peserta per skema beserta alasan Project Based', () => {
    render(<PlacementGroups jurusanKelas={jurusan} rows={[
      row('Roi', 'Semarang', 'full'),
      row('Vero', 'Semarang', 'project', ['Capstone di bawah 75']),
      row('Aya', 'Semarang', 'none', ['SPA di bawah 65']),
    ]} />);
    expect(screen.getByText('Roi')).toBeTruthy();
    expect(screen.getByText('Capstone di bawah 75')).toBeTruthy();
    expect(screen.getAllByText('Tidak Ditempatkan').length).toBeGreaterThan(0);
  });

  it('kelas yang capstone-nya belum dinilai tidak dilabeli tidak ditempatkan', () => {
    render(<PlacementGroups jurusanKelas={jurusan} rows={[row('Andi', 'Surabaya', 'pending', ['Capstone belum dinilai'])]} />);
    expect(screen.getByText(/skema magangnya belum bisa ditentukan/)).toBeTruthy();
    expect(screen.queryByText('Andi')).toBeNull();
  });
});
