// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { activePartner, activeRole, availablePartners, availableRoles, ROLE_LABELS } from '../../src/features/auth/policy';

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

  it('PIC beberapa mitra memakai mitra pilihan bila memilikinya, selain itu mitra utama', () => {
    expect(availablePartners('p2', ['p2', 'p1'])).toEqual(['p2', 'p1']);
    expect(availablePartners('p2', undefined)).toEqual(['p2']);
    expect(activePartner('p2', ['p2', 'p1'], 'p1')).toBe('p1');
    expect(activePartner('p2', ['p2', 'p1'], 'p9')).toBe('p2');
    expect(activePartner(null, [], 'p1')).toBeNull();
  });
});

