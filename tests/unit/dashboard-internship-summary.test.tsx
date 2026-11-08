import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { InternshipSummary } from '../../src/app/(admin)/admin/dashboard/internship-summary';
import type { RankedStudent } from '../../src/features/dashboard/snapshot-types';

const row = (studentName: string, className: string, placement: RankedStudent['placement']): RankedStudent => ({
  studentId: studentName, studentName, className, city: 'Semarang', score: 80, capstone: 80, tasks: 90, attendance: 100, quiz: 70,
  combined: 84, absent: 0, componentDetails: {}, placement, placementReasons: [],
  perfScore: 85, perfAttendance: 100, perfTasks: 90, perfQuiz: 70,
});
const jurusan = new Map([['Web SMG', 'Web Programming'], ['SMM SBY', 'Social Media Marketing']]);
const rows = [
  row('A', 'Web SMG', 'full'), row('B', 'Web SMG', 'project'), row('C', 'Web SMG', 'none'),
  row('D', 'SMM SBY', 'project'), row('E', 'SMM SBY', 'project'), row('F', 'SMM SBY', 'pending'),
];
const kpi = (label: string) => screen.getByText(label, { selector: 'p' }).closest('div') as HTMLElement;

afterEach(cleanup);

describe('ringkasan peserta yang dapat magang', () => {
  it('total magang adalah Full Internship ditambah Project Based', () => {
    render(<InternshipSummary rows={rows} jurusanKelas={jurusan} />);
    expect(within(kpi('Total dapat magang')).getByText('4')).toBeTruthy();
    expect(within(kpi('Total dapat magang')).getByText(/dari 6 peserta/)).toBeTruthy();
    expect(within(kpi('Full Internship')).getByText('1')).toBeTruthy();
    expect(within(kpi('Project Based')).getByText('3')).toBeTruthy();
  });

  it('grafik membandingkan tiap jurusan', () => {
    render(<InternshipSummary rows={rows} jurusanKelas={jurusan} />);
    const bar = (j: string) => screen.getByRole('group', { name: j });
    expect(within(bar('Web Programming')).getByText('2 dari 3')).toBeTruthy();
    expect(within(bar('Social Media Marketing')).getByText('2 dari 3')).toBeTruthy();
  });

  it('saringan jurusan dan jenis magang', () => {
    render(<InternshipSummary rows={rows} jurusanKelas={jurusan} />);
    fireEvent.click(screen.getByRole('button', { name: 'Social Media Marketing' }));
    expect(within(kpi('Total dapat magang')).getByText('2')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Web Programming' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Semua jurusan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Full Internship' }));
    expect(within(kpi('Total dapat magang')).getByText('1')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Social Media Marketing' })).getByText('0 dari 3')).toBeTruthy();
  });
});
