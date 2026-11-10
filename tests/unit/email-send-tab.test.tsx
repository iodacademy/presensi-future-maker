import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SendTab } from '../../src/app/(admin)/admin/email/send-tab';
import { DEFAULT_TEMPLATES } from '../../src/features/email/model';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const templates = DEFAULT_TEMPLATES.map((t) => ({ ...t, updatedAt: '2026-11-10T00:00:00Z' }));
const r = (id: string, category: string | null, sent: Record<string, string> = {}, className = 'Web Programming - Semarang') => ({
  studentId: id, studentName: `Peserta ${id}`, email: `${id}@x.id`, className, city: 'Semarang', score: 80, placement: 'full',
  placementReasons: [], category, label: String(category), sent,
}) as never;

describe('tab Kirim email', () => {
  it('mencentang peserta sesuai kategori template, kecuali yang sudah menerima, lalu mengirim id terpilih', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ sent: 1, failed: 0, skipped: 0, quota: 99 }), { status: 200 }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onSent = vi.fn();
    render(<SendTab templates={templates} onSent={onSent} onError={vi.fn()} recipients={[
      r('a', 'lulus-magang'), r('b', 'lulus-magang', { 'lulus-magang': '2026-11-10T03:00:00Z' }), r('c', 'tidak-lulus'), r('d', 'lulus-magang', {}, 'Web Programming - Surakarta'),
    ]} />);

    expect((screen.getByLabelText('Pilih Peserta a') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Pilih Peserta b') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Pilih Peserta c') as HTMLInputElement).checked).toBe(false);
    // Peserta kelas lain tidak tampil / Participants from another class are not shown
    expect(screen.queryByText('Peserta d')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Kirim ke 1 peserta' }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual({ templateId: 'lulus-magang', studentIds: ['a'], resend: false });
    expect(screen.getByRole('status').textContent).toContain('1 terkirim');
  });

  it('pilih semua di kelas mencentang seluruh peserta kelas itu', () => {
    render(<SendTab templates={templates} onSent={vi.fn()} onError={vi.fn()} recipients={[r('a', 'lulus-magang'), r('c', 'tidak-lulus')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pilih semua di kelas' }));
    expect((screen.getByLabelText('Pilih Peserta c') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('2 dari 2 peserta dipilih')).toBeTruthy();
  });
});
