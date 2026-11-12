// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, reset } from './careers-fake-db';

const getSessionActor = vi.fn();
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb }));
import { GET, POST } from '../../src/app/api/auth/peran/route';

const req = (role: string) => new Request('http://x/api/auth/peran', { method: 'POST', body: JSON.stringify({ role }) });

beforeEach(() => {
  reset({ partners: { p1: { name: 'Ioda Academy' }, p2: { name: 'TryoutIn' } } });
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

  it('PIC beberapa mitra mendapat satu pilihan per mitra, dan bisa memilih mitranya', async () => {
    getSessionActor.mockResolvedValue({ uid: 'm1', role: 'partner', roles: ['mentor', 'partner'], partnerId: 'p1', partnerIds: ['p1', 'p2'], name: 'Rama' });
    expect(await (await GET()).json()).toEqual({
      role: 'partner', partnerId: 'p1',
      roles: [
        { role: 'mentor', label: 'Mentor' },
        { role: 'partner', partnerId: 'p1', label: 'PIC Mitra · Ioda Academy' },
        { role: 'partner', partnerId: 'p2', label: 'PIC Mitra · TryoutIn' },
      ],
    });
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ role: 'partner', partnerId: 'p2' }) }));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/__mitra=p2/);
    const tolak = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ role: 'partner', partnerId: 'p9' }) }));
    expect(tolak.status).toBe(400);
  });
});

