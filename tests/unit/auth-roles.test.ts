// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { activeRole, availableRoles, ROLE_LABELS } from '../../src/features/auth/policy';

describe('akun dengan beberapa peran', () => {
  it('peran yang tersedia adalah peran utama ditambah peran tambahan, tanpa ganda', () => {
    expect(availableRoles('mentor', ['mentor', 'partner'])).toEqual(['mentor', 'partner']);
    expect(availableRoles('admin', undefined)).toEqual(['admin']);
  });

  it('peran pilihan dipakai hanya bila akun memilikinya', () => {
    expect(activeRole('mentor', ['partner'], 'partner')).toBe('partner');
    expect(activeRole('mentor', ['partner'], 'admin')).toBe('mentor');
    expect(activeRole('mentor', undefined, undefined)).toBe('mentor');
    expect(activeRole('mentor', ['partner'], 'bukan-peran')).toBe('mentor');
  });

  it('setiap peran punya label untuk header', () => {
    expect(ROLE_LABELS).toEqual({ admin: 'Admin', mentor: 'Mentor', partner: 'PIC Mitra', student: 'Peserta' });
  });
});
