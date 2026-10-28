import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { CapstoneShow, type CapstoneSlide } from '../../src/app/(layar)/capstone/capstone-show';

const slide = (id: string, title: string, isApp = true): CapstoneSlide => ({
  id, title, isApp, cover: '', tools: ['Next.js'], nickname: 'Vanya', photo: '', cohortLabel: 'Web Programming · Semarang', color: '#0072CE', fg: '#fff', qr: '<svg></svg>',
});

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('layar Karya Capstone', () => {
  it('berganti sendiri, berulang, dan berhenti saat dijeda', () => {
    vi.useFakeTimers();
    render(<CapstoneShow slides={[slide('a', 'Griya Kenanga'), slide('b', 'Lumbung POS')]} />);
    expect(screen.getByText('01 / 02')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(7000); });
    expect(screen.getByText('02 / 02')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(7000); });
    expect(screen.getByText('01 / 02')).toBeTruthy();
    fireEvent.keyDown(window, { key: ' ' });
    act(() => { vi.advanceTimersByTime(60000); });
    expect(screen.getByText('01 / 02')).toBeTruthy();
  });
  it('QR mengajak mencoba aplikasi, atau melihat karya bila alamat aplikasi kosong', () => {
    render(<CapstoneShow slides={[slide('a', 'Griya Kenanga')]} />);
    expect(screen.getByText('Pindai untuk mencoba aplikasinya')).toBeTruthy();
    cleanup();
    render(<CapstoneShow slides={[slide('b', 'Lumbung POS', false)]} />);
    expect(screen.getByText('Pindai untuk melihat karya')).toBeTruthy();
  });
  it('tanpa capstone menampilkan pesan kosong', () => {
    render(<CapstoneShow slides={[]} />);
    expect(screen.getByText('Belum ada karya capstone yang terbit.')).toBeTruthy();
  });
});
