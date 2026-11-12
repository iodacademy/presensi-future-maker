// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionActor = vi.fn();
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));
import { GET, POST } from '../../src/app/api/auth/peran/route';

const req = (role: string) => new Request('http://x/api/auth/peran', { method: 'POST', body: JSON.stringify({ role }) });

beforeEach(() => {
  getSessionActor.mockResolvedValue({ uid: 'm1', role: 'mentor', roles: ['mentor', 'partner'], name: 'Rama' });
});

describe('ganti peran', () => {
  it('menampilkan peran aktif dan semua peran akun', async () => {
    expect(await (await GET()).json()).toEqual({ role: 'mentor', roles: [{ role: 'mentor', label: 'Mentor' }, { role: 'partner', label: 'PIC Mitra' }] });
  });

  it('beralih ke peran yang dimiliki: cookie peran disimpan dan diarahkan ke berandanya', async () => {
    const res = await POST(req('partner'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ redirect: '/mitra' });
    expect(res.headers.get('set-cookie')).toMatch(/__peran=partner/);
  });

  it('peran yang tidak dimiliki ditolak', async () => {
    const res = await POST(req('admin'));
    expect(res.status).toBe(400);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});
