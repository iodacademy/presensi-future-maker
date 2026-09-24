import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import LoginPage from '../../src/app/(auth)/login/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('LoginPage', () => {
  it('renders email input and Masuk button without password field', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/email terdaftar/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Masuk/i })).toBeDefined();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });

  it('renders branding title Future Innovators Bootcamp', () => {
    render(<LoginPage />);
    expect(screen.getByText(/Future Innovators Bootcamp/i)).toBeDefined();
  });

  it('menampilkan logo Plan International saja', () => {
    render(<LoginPage />);
    expect(screen.getByAltText('Plan International')).toBeDefined();
    expect(screen.queryByAltText(/Futuremakers/i)).toBeNull();
  });
});
