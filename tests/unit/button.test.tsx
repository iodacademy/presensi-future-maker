import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Button } from '../../src/components/ui/button';

describe('Button primitive', () => {
  it('renders primary button with proper classes and attributes', () => {
    render(<Button variant="primary">Masuk</Button>);
    const btn = screen.getByRole('button', { name: /Masuk/i });
    expect(btn).toBeDefined();
    expect(btn.getAttribute('data-variant')).toBe('primary');
  });

  it('renders secondary button variant', () => {
    render(<Button variant="secondary">Batal</Button>);
    const btn = screen.getByRole('button', { name: /Batal/i });
    expect(btn.getAttribute('data-variant')).toBe('secondary');
  });
});
