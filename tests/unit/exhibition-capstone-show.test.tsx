import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace }) }));
import { CapstoneShow, type CapstoneSlide } from '../../src/app/(layar)/capstone/capstone-show';

const slide = (id: string, title: string, isApp = true): CapstoneSlide => ({
  id, title, isApp, images: [''], tools: ['Next.js'], nickname: 'Vanya', photo: '', cohortLabel: 'Web Programming · Semarang', color: '#0072CE', fg: '#fff', qr: '<svg></svg>',
});

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('layar Karya Capstone', () => {
  it('berganti sendiri, berulang, dan berhenti saat dijeda', () => {
    vi.useFakeTimers();
    render(<CapstoneShow slides={[slide('a', 'Griya Kenanga'), slide('b', 'Lumbung POS')]} cohorts={[]} kelas="" />);
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
    render(<CapstoneShow slides={[slide('a', 'Griya Kenanga')]} cohorts={[]} kelas="" />);
    expect(screen.getByText('Pindai untuk mencoba aplikasinya')).toBeTruthy();
    cleanup();
    render(<CapstoneShow slides={[slide('b', 'Lumbung POS', false)]} cohorts={[]} kelas="" />);
    expect(screen.getByText('Pindai untuk melihat karya')).toBeTruthy();
  });
  it('tanpa capstone menampilkan pesan kosong', () => {
    render(<CapstoneShow slides={[]} cohorts={[]} kelas="" />);
    expect(screen.getByText('Belum ada karya capstone yang terbit.')).toBeTruthy();
  });
});

describe('layar Karya Capstone: sorotan dan pilihan kelas', () => {
  it('karya bergambar banyak menggilir gambarnya dan tampil lebih lama', () => {
    vi.useFakeTimers();
    const smm = { ...slide('a', 'Lentur Studio', false), images: ['/1.png', '/2.png', '/3.png'] };
    const { container } = render(<CapstoneShow slides={[smm, slide('b', 'Lumbung POS')]} cohorts={[]} kelas="" />);
    const aktif = () => container.querySelector('.cap-slide.in .cap-img img.on')?.getAttribute('src');
    expect(aktif()).toBe('/1.png');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(aktif()).toBe('/2.png');
    // 3 gambar × 4 detik = 12 detik, bukan 7 / 3 images × 4 s = 12 s, not 7
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText('01 / 02')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText('02 / 02')).toBeTruthy();
  });
  it('reels diputar sebagai video dan tayangan menunggu videonya selesai', () => {
    vi.useFakeTimers();
    const smm = { ...slide('a', 'Lentur Studio', false), images: ['/1.png', '/reels.mp4?alt=media', '/3.png'] };
    const { container } = render(<CapstoneShow slides={[smm, slide('b', 'Lumbung POS')]} cohorts={[]} kelas="" />);
    act(() => { vi.advanceTimersByTime(4000); });
    const video = container.querySelector('.cap-slide.in video') as HTMLVideoElement;
    expect(video?.getAttribute('src')).toBe('/reels.mp4?alt=media');
    expect(video.muted).toBe(true);
    act(() => { vi.advanceTimersByTime(20000); });
    expect(container.querySelector('.cap-slide.in video')).toBeTruthy();
    fireEvent.ended(video);
    expect(container.querySelector('.cap-slide.in .cap-img img.on')?.getAttribute('src')).toBe('/3.png');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText('02 / 02')).toBeTruthy();
  });
  it('video yang panjang dipotong agar layar tidak tertahan', () => {
    vi.useFakeTimers();
    const smm = { ...slide('a', 'Lentur Studio', false), images: ['/reels.mp4?alt=media', '/2.png'] };
    const { container } = render(<CapstoneShow slides={[smm, slide('b', 'Lumbung POS')]} cohorts={[]} kelas="" />);
    act(() => { vi.advanceTimersByTime(30000); });
    expect(container.querySelector('.cap-slide.in .cap-img img.on')?.getAttribute('src')).toBe('/2.png');
  });
  it('pilihan kelas mengganti alamat halaman', () => {
    render(<CapstoneShow slides={[slide('a', 'Griya Kenanga')]} cohorts={[{ key: 'web-smg', label: 'Web Programming · Semarang' }, { key: 'smm-yk', label: 'Social Media Marketing · Yogyakarta' }]} kelas="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Yogyakarta' }));
    expect(replace).toHaveBeenCalledWith('/capstone?kelas=smm-yk');
  });
});
