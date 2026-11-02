import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { JobCard } from '../../src/features/careers/job-card';

const job = {
  title: 'UI/UX Designer Intern', partnerName: 'PT DIPSI', employment: 'magang-3' as const,
  location: 'Jakarta Selatan', workMode: 'hybrid' as const, quota: 2, closesAt: '2026-11-05T05:20:31Z',
};
const now = new Date('2026-11-03T00:00:00Z');

afterEach(cleanup);

describe('kartu lowongan', () => {
  it('menampilkan jenis, lokasi, kuota, dan hitung mundur', () => {
    render(<JobCard job={job} logo={null} now={now} />);
    expect(screen.getByText('Tutup dalam 2 hari 05:20:31')).toBeTruthy();
    expect(screen.getByText('Magang 3 bulan')).toBeTruthy();
    expect(screen.getByText('Jakarta Selatan · Hybrid')).toBeTruthy();
    expect(screen.getByText('Kuota 2')).toBeTruthy();
  });

  it('menampilkan inisial bila belum ada logo', () => {
    render(<JobCard job={job} logo={null} now={now} />);
    expect(screen.getByText('P')).toBeTruthy();
  });

  it('pita hitung mundur menjadi mendesak bila sisa kurang dari sehari', () => {
    render(<JobCard job={{ ...job, closesAt: '2026-11-03T11:14:02Z' }} logo={null} now={now} />);
    const pita = screen.getByText('Tutup dalam 11:14:02').closest('[data-urgent]');
    expect(pita?.getAttribute('data-urgent')).toBe('true');
  });
});
