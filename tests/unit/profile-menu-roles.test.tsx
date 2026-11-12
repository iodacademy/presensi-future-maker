import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
import { ProfileMenu } from '../../src/components/ui/profile-menu';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); push.mockClear(); });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('pilihan peran di header', () => {
  it('akun berperan ganda melihat peran aktif dan bisa beralih', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return json({ redirect: '/mitra' });
      return json({ role: 'mentor', roles: [{ role: 'mentor', label: 'Mentor' }, { role: 'partner', label: 'PIC Mitra' }] });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ProfileMenu userName="Rama" roleLabel="Mentor" />);
    expect(await screen.findByText('Mentor', { selector: '[data-role-badge]' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Menu akun Rama/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'PIC Mitra' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/mitra'));
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/peran', expect.objectContaining({ method: 'POST', body: JSON.stringify({ role: 'partner' }) }));
  });

  it('akun satu peran tidak melihat pilihan peran', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ role: 'student', roles: [{ role: 'student', label: 'Peserta' }] })));
    render(<ProfileMenu userName="Andi" roleLabel="Peserta" />);
    fireEvent.click(screen.getByRole('button', { name: /Menu akun Andi/ }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('menuitemradio')).toBeNull();
  });
});
