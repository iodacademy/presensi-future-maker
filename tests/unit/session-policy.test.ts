import { describe, it, expect } from 'vitest';
import { getRoleRedirectPath, isAuthorizedPath } from '../../src/features/auth/session';

describe('Session redirect policy', () => {
  it('redirects admin to /admin/kelas', () => {
    expect(getRoleRedirectPath('admin')).toBe('/admin/kelas');
  });

  it('redirects student to /app', () => {
    expect(getRoleRedirectPath('student')).toBe('/app');
  });

  it('redirects mentor to /mentor/peserta', () => {
    expect(getRoleRedirectPath('mentor')).toBe('/mentor/peserta');
  });

  it('verifies path authorization for each role', () => {
    expect(isAuthorizedPath('admin', '/admin/kelas')).toBe(true);
    expect(isAuthorizedPath('admin', '/admin/tugas')).toBe(true);
    expect(isAuthorizedPath('student', '/admin/kelas')).toBe(false);
    expect(isAuthorizedPath('student', '/app')).toBe(true);
    expect(isAuthorizedPath('student', '/app/jadwal')).toBe(true);
    expect(isAuthorizedPath('mentor', '/mentor/peserta')).toBe(true);
    expect(isAuthorizedPath('mentor', '/app')).toBe(false);
  });
});
