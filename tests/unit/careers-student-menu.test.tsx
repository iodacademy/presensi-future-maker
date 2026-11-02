import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/app', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
import { StudentContextProvider, StudentShell } from '../../src/components/student-shell';

afterEach(cleanup);
const reminders = { surveys: [], exams: [] };

describe('menu Karier siswa', () => {
  it('disembunyikan bagi siswa tanpa skema magang', () => {
    render(<StudentContextProvider value={{ name: 'Andi', reminders, careerAccess: false }}><StudentShell><p>isi</p></StudentShell></StudentContextProvider>);
    expect(screen.queryAllByRole('link', { name: /Karier/ })).toHaveLength(0);
  });

  it('tampil bagi siswa Full Internship atau Project Based', () => {
    render(<StudentContextProvider value={{ name: 'Andi', reminders, careerAccess: true }}><StudentShell><p>isi</p></StudentShell></StudentContextProvider>);
    expect(screen.getAllByRole('link', { name: /Karier/ }).length).toBeGreaterThan(0);
  });
});
