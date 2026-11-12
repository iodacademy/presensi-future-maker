import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ children, href, style }: { children: React.ReactNode; href: string; style?: React.CSSProperties }) => <a href={href} style={style}>{children}</a> }));
import { HomeSummary } from '../../src/app/(student)/app/home-summary';
import { buildLearningSummary, type SummaryRow } from '../../src/features/dashboard/learning-summary';

afterEach(cleanup);

const row = (over: Partial<SummaryRow> = {}): SummaryRow => ({
  score: 82, capstone: 80, tasks: 78, attendance: 92, quiz: 86, combined: 79, absent: 1, placement: 'full', placementReasons: [], pending: false, ...over,
});
const make = (over: Partial<SummaryRow> = {}, extra: Partial<Parameters<typeof buildLearningSummary>[0]> = {}) =>
  buildLearningSummary({ row: row(over), placedAt: null, apps: [], applyUntil: null, ...extra });

describe('ringkasan belajar di beranda', () => {
  it('lulus Full Internship: tenggat lamaran, tombol Portal Karier, dan syarat', () => {
    render(<HomeSummary s={make({}, { applyUntil: '2026-11-12T16:59:00.000Z', apps: [{ status: 'interview', interview: { date: '2026-11-13', start: '10:00' } }] })} />);
    expect(screen.getByText('Selamat, kamu lulus!')).toBeTruthy();
    expect(screen.getByText(/Lamar sebelum 12 November, 23\.59 WIB/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Buka Portal Karier/ }).getAttribute('href')).toBe('/app/karier');
    expect(screen.getByText('Interview 13 Nov')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Syarat Full Internship' })).toBeTruthy();
  });

  it('sudah ditempatkan menampilkan posisi dan perusahaan, tanpa syarat', () => {
    render(<HomeSummary s={make({ score: 60 }, { placedAt: { partnerName: 'Tebby', position: 'Content Creator' } })} />);
    expect(screen.getByText('DITEMPATKAN MAGANG')).toBeTruthy();
    expect(screen.getByText('Content Creator')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Syarat/ })).toBeNull();
  });

  it('belum lulus menyebut capstone yang tidak dikumpulkan', () => {
    render(<HomeSummary s={make({ score: 52, capstone: 0, placement: 'none', placementReasons: ['Tidak mengumpulkan capstone'] })} />);
    expect(screen.getByText('SPA 52, batas lulus 60')).toBeTruthy();
    expect(screen.getByText('Tidak dikumpulkan')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('lulus tanpa skema menunjukkan syarat yang gagal', () => {
    render(<HomeSummary s={make({ score: 66, combined: 60, absent: 4, placement: 'none' })} />);
    expect(screen.getByText(/belum memenuhi syarat magang/)).toBeTruthy();
    expect(screen.getAllByText('Absen maks. 3 kali').length).toBeGreaterThan(0);
  });
});
