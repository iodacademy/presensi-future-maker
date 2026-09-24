import { describe, it, expect, beforeEach } from 'vitest';
import { getEnv } from '../../src/lib/env';

describe('env configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FIREBASE_PROJECT_ID;
  });

  it('throws error when required FIREBASE_PROJECT_ID is missing', () => {
    expect(() => getEnv()).toThrowError(/Missing FIREBASE_PROJECT_ID/);
  });

  it('returns valid config when env vars are present', () => {
    process.env.FIREBASE_PROJECT_ID = 'innov-bootcamp-dev';
    process.env.FIREBASE_CLIENT_EMAIL = 'admin@example.com';
    process.env.FIREBASE_PRIVATE_KEY = 'test-key';

    const config = getEnv();
    expect(config.projectId).toBe('innov-bootcamp-dev');
    expect(config.clientEmail).toBe('admin@example.com');
  });
});
