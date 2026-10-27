import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/karya/w1',
}));

import { WorkView } from '../../src/app/(public)/karya/[id]/work-view';
import { PersonView } from '../../src/app/(public)/peserta/[id]/person-view';
import { PeopleView } from '../../src/app/(public)/peserta/people-view';
import { SLIDE_INTERVAL_SECONDS } from '../../src/features/exhibition/content';
import type { WorkDetail, PersonDetail } from '../../src/features/exhibition/read';
import type { GalleryCard } from '../../src/features/exhibition/model';

const work = (over: Partial<WorkDetail> = {}): WorkDetail => ({
  id: 'w1', title: 'Kedai Kopi', type: 'Landing Page', cohort: 'web-smg', track: 'web', personUid: 'u1',
  nickname: 'Ani', thumb: '', aiAssisted: false, collectionId: null,
  description: 'Deskripsi karya', tools: ['HTML', 'CSS'],
  media: { kind: 'site', url: 'https://kopi.example.com', slides: [] }, coverFull: 'https://x/full.webp', collection: null,
  ...over,
});
const person = (over: Partial<PersonDetail> = {}): PersonDetail => ({
  uid: 'u1', nickname: 'Ani', cohort: 'web-smg', track: 'web', photoUrl: '', mainWorkId: null, workCount: 0,
  bio: 'Suka membangun situs', skills: ['React'], linkedinUrl: '', portfolioUrl: '', works: [], ...over,
});
const card = (id: string): GalleryCard => ({
  id, title: 'Karya ' + id, type: 'Landing Page', cohort: 'web-smg', track: 'web', personUid: 'u1', nickname: 'Ani', thumb: '', aiAssisted: false, collectionId: null,
});

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('halaman karya', () => {
  it('situs mati tetap menampilkan tautan Buka demo', () => {
    render(<WorkView work={work({ coverFull: '' })} related={[]} />);
    const a = screen.getByText('Buka demo').closest('a')!;
    expect(a.getAttribute('href')).toBe('https://kopi.example.com');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noreferrer');
  });

  it('iframe baru dimuat setelah Coba langsung, dengan sandbox tetap', () => {
    const { container } = render(<WorkView work={work()} related={[]} />);
    expect(container.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByText('Coba langsung'));
    const f = container.querySelector('iframe')!;
    expect(f.getAttribute('src')).toBe('https://kopi.example.com');
    expect(f.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin allow-forms allow-popups');
  });

  it('javascript: tidak menjadi tautan atau iframe', () => {
    const { container } = render(<WorkView work={work({ media: { kind: 'site', url: 'javascript:alert(1)', slides: [] } })} related={[]} />);
    expect(screen.queryByText('Buka demo')).toBeNull();
    expect(screen.queryByText('Coba langsung')).toBeNull();
    expect(container.innerHTML).not.toContain('javascript:');
  });

  it('carousel bergeser otomatis dan berhenti saat kursor di atasnya', () => {
    vi.useFakeTimers();
    const slides = ['https://x/1.webp', 'https://x/2.webp', 'https://x/3.webp'];
    const { container } = render(<WorkView work={work({ media: { kind: 'carousel', url: '', slides } })} related={[]} />);
    const cur = () => container.querySelector('[aria-current="true"]')?.getAttribute('src');
    expect(cur()).toBe(slides[0]);
    act(() => { vi.advanceTimersByTime(SLIDE_INTERVAL_SECONDS * 1000); });
    expect(cur()).toBe(slides[1]);
    fireEvent.mouseEnter(screen.getByLabelText('Slide karya'));
    act(() => { vi.advanceTimersByTime(SLIDE_INTERVAL_SECONDS * 3000); });
    expect(cur()).toBe(slides[1]);
    fireEvent.click(screen.getByLabelText('Berikutnya'));
    expect(cur()).toBe(slides[2]);
  });

  it('pdf memuat iframe dan tautan Buka PDF', () => {
    const { container } = render(<WorkView work={work({ type: 'Capstone', media: { kind: 'pdf', url: 'https://x/a.pdf', slides: [] } })} related={[]} />);
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('https://x/a.pdf');
    expect(screen.getByText('Buka PDF').closest('a')?.getAttribute('href')).toBe('https://x/a.pdf');
  });

  it('video YouTube memakai embed dan tautan tidak aman dibuang', () => {
    const { container, rerender } = render(<WorkView work={work({ media: { kind: 'video', url: 'https://youtu.be/abcdefghijk', slides: [] } })} related={[]} />);
    expect(container.querySelector('iframe')?.getAttribute('src')).toContain('youtube.com/embed/abcdefghijk');
    rerender(<WorkView work={work({ media: { kind: 'video', url: 'javascript:alert(1)', slides: [] } })} related={[]} />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
  });

  it('label AI, tautan koleksi, dan karya serupa', () => {
    render(<WorkView work={work({ aiAssisted: true, collection: { id: 'k1', title: 'Dapur Nia' } })} related={[card('r1')]} />);
    expect(screen.getByText('Dibuat dengan bantuan AI')).toBeTruthy();
    expect(screen.getByText(/Dapur Nia/).closest('a')?.getAttribute('href')).toBe('/koleksi/k1');
    expect(screen.getByText('Karya r1')).toBeTruthy();
  });
});

describe('halaman peserta', () => {
  it('profil tanpa karya tidak menampilkan bagian karya', () => {
    render(<PersonView person={person()} mates={[]} />);
    expect(screen.getByText('Ani')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /^Karya/ })).toBeNull();
  });

  it('profil dengan karya menampilkan kartunya', () => {
    render(<PersonView person={person({ works: [card('a')], workCount: 1 })} mates={[]} />);
    expect(screen.getByRole('heading', { name: /^Karya/ })).toBeTruthy();
    expect(screen.getByText('Karya a')).toBeTruthy();
  });

  it('tautan LinkedIn berbahaya tidak dirender, yang aman dirender', () => {
    const { container, rerender } = render(<PersonView person={person({ linkedinUrl: 'javascript:alert(1)', portfolioUrl: 'https://github.com/ani' })} mates={[]} />);
    expect(screen.queryByText('LinkedIn')).toBeNull();
    expect(screen.getByText('GitHub').closest('a')?.getAttribute('href')).toBe('https://github.com/ani');
    expect(container.innerHTML).not.toContain('javascript:');
    rerender(<PersonView person={person({ linkedinUrl: 'https://linkedin.com/in/ani' })} mates={[]} />);
    expect(screen.getByText('LinkedIn').closest('a')?.getAttribute('href')).toBe('https://linkedin.com/in/ani');
  });
});

describe('daftar peserta', () => {
  it('menampilkan nama panggilan dan mencari berdasarkan nama itu', () => {
    const people = [
      { uid: 'a', nickname: 'Ani', cohort: 'web-smg', track: 'web' as const, photoUrl: '', mainWorkId: null, workCount: 2 },
      { uid: 'b', nickname: 'Budi', cohort: 'da-jkt', track: 'da' as const, photoUrl: '', mainWorkId: null, workCount: 1 },
    ];
    render(<PeopleView people={people} />);
    expect(screen.getByText('2 karya')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Cari nama peserta'), { target: { value: 'bud' } });
    expect(screen.queryByText('Ani')).toBeNull();
    expect(screen.getByText('Budi')).toBeTruthy();
  });
});

describe('data contoh sudah hilang', () => {
  it('tidak ada impor DATA tersisa', () => {
    const roots = ['src/app/(public)', 'src/features/exhibition'];
    const files: string[] = [];
    const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) files.push(p);
    });
    roots.forEach(walk);
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) expect(fs.readFileSync(f, 'utf8'), f).not.toMatch(/\bDATA\./);
    expect(fs.existsSync('src/features/exhibition/photos.json')).toBe(false);
  });
});
