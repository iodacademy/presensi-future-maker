import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ProfileMenu } from '../../src/components/ui/profile-menu';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProfileMenu', () => {
  it('menyembunyikan menu sampai tombolnya ditekan', () => {
    render(<ProfileMenu userName="Rohmat" roleLabel="Administrator" />);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Menu akun Rohmat/i }));
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('memanggil endpoint logout lalu berpindah ke halaman masuk', async () => {
    render(<ProfileMenu userName="Rohmat" roleLabel="Administrator" />);
    fireEvent.click(screen.getByRole('button', { name: /Menu akun/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Keluar/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  });

  it('tetap berpindah ke halaman masuk meski permintaan logout gagal', async () => {
    // Kegagalan jaringan tidak boleh menahan pengguna di dalam aplikasi.
    // A network failure must not trap the user inside the app.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<ProfileMenu userName="Rohmat" roleLabel="Administrator" />);
    fireEvent.click(screen.getByRole('button', { name: /Menu akun/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Keluar/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });

  it('menutup menu ketika Escape ditekan', () => {
    // Pengguna papan ketik harus punya cara membatalkan tanpa memakai tetikus.
    // Keyboard users need a way to dismiss it without reaching for a mouse.
    render(<ProfileMenu userName="Rohmat" roleLabel="Administrator" />);
    fireEvent.click(screen.getByRole('button', { name: /Menu akun/i }));
    expect(screen.getByRole('menu')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('menutup menu ketika area di luarnya ditekan', () => {
    render(<ProfileMenu userName="Rohmat" roleLabel="Administrator" />);
    fireEvent.click(screen.getByRole('button', { name: /Menu akun/i }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('menampilkan nama dan peran di dalam menu', () => {
    render(<ProfileMenu userName="Rohmat" roleLabel="Administrator" />);
    fireEvent.click(screen.getByRole('button', { name: /Menu akun/i }));
    const menu = screen.getByRole('menu');
    expect(menu.textContent).toContain('Rohmat');
    expect(menu.textContent).toContain('Administrator');
  });

  it('menyatakan status terbuka lewat aria-expanded', () => {
    render(<ProfileMenu userName="Rohmat" roleLabel="Administrator" />);
    const button = screen.getByRole('button', { name: /Menu akun/i });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });
});
