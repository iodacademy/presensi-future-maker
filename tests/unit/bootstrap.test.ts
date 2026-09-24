import { describe, it, expect } from 'vitest';
import { parseBootstrapArgs } from '../../scripts/bootstrap-admin';

describe('Bootstrap CLI argument parser', () => {
  it('throws error when email or name is missing', () => {
    expect(() => parseBootstrapArgs([])).toThrowError(/Email dan Nama wajib diisi/);
    expect(() => parseBootstrapArgs(['--email=admin@test.com'])).toThrowError(/Email dan Nama wajib diisi/);
  });

  it('correctly parses --email and --name arguments', () => {
    const args = ['--email=admin@innov.org', '--name=Super Admin'];
    const parsed = parseBootstrapArgs(args);
    expect(parsed.email).toBe('admin@innov.org');
    expect(parsed.name).toBe('Super Admin');
  });
});
