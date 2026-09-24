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

  it('renders branding title Bootcamp Future Makers 2026', () => {
    render(<LoginPage />);
    expect(screen.getByText(/Bootcamp Future Makers 2026/i)).toBeDefined();
  });
});
