// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const ada = (p: string) => existsSync(resolve(process.cwd(), p));
const login = read('src/app/(auth)/login/page.tsx');
const presensi = read('src/app/presensi/page.tsx');
const route = read('src/app/api/auth/login/route.ts');
const session = read('src/features/auth/session.ts');

/**
 * Login dikerjakan seluruhnya di server.
 *
 * Penukaran token dulu dikerjakan peramban lewat Firebase Client SDK, yang
 * menghubungi googleapis.com langsung dari laptop peserta. Jaringan kampus,
 * antivirus, atau pemblokir iklan yang menahan alamat itu menggagalkan login
 * dengan "auth/network-request-failed", padahal situs kita sendiri terjangkau.
 *
 * Sign-in happens entirely on the server.
 *
 * The token exchange used to run in the browser through the Firebase Client SDK,
 * calling googleapis.com straight from the participant's laptop. A campus network,
 * antivirus, or ad blocker holding that address back failed the login with
 * "auth/network-request-failed", even though our own site was reachable.
 */
describe('login lewat server', () => {
  it('tidak memuat Firebase Client SDK di halaman masuk mana pun', () => {
    for (const [nama, isi] of [['login', login], ['presensi', presensi]] as const) {
      expect(isi, nama).not.toMatch(/from 'firebase\//);
      expect(isi, nama).not.toMatch(/signInWithCustomToken/);
    }
  });

  it('memakai satu permintaan ke server kita', () => {
    expect(login).toContain("fetch('/api/auth/login'");
    expect(presensi).toContain("fetch('/api/auth/login'");
  });

  it('menukar custom token ke ID token di server', () => {
    expect(session).toMatch(/identitytoolkit\.googleapis\.com\/v1\/accounts:signInWithCustomToken/);
    expect(route).toMatch(/createSessionCookieFromCustomToken\(token\.customToken\)/);
  });

  it('tidak pernah mengirim custom token ke peramban', () => {
    // Token itu kredensial; endpoint lama menyerahkannya kepada siapa pun yang
    // mengetik email terdaftar.
    //
    // That token is a credential; the old endpoint handed it to anyone who typed a
    // registered email.
    const jawaban = route.slice(route.indexOf('NextResponse.json({ role'));
    expect(jawaban).not.toMatch(/customToken/);
    expect(ada('src/app/api/auth/token/route.ts')).toBe(false);
  });

  it('membatasi waktu penukarannya', () => {
    // Permintaan yang menggantung menahan peserta pada tombol "Memproses..."
    // tanpa pernah diberi tahu apa yang terjadi.
    //
    // A hanging request holds the participant on a "Memproses..." button without
    // ever telling them what happened.
    expect(session).toMatch(/AbortSignal\.timeout\([\d_]+\)/);
  });

  it('tetap membatasi laju percobaan masuk', () => {
    // Email adalah satu-satunya kredensial; tanpa pembatasan, penyerang dapat
    // menebak alamat tanpa batas.
    //
    // Email is the only credential; without a limit, an attacker can guess
    // addresses indefinitely.
    expect(route).toMatch(/checkRateLimit\(`auth:\$\{ip\}`, 10, 60_000\)/);
  });

  it('memakai pesan seragam untuk email yang ditolak', () => {
    // "Email tidak terdaftar" dan "akun dinonaktifkan" tidak boleh dapat
    // dibedakan dari luar.
    //
    // "Email not registered" and "account deactivated" must not be distinguishable
    // from outside.
    expect(route).toContain('Email tidak terdaftar atau tidak aktif. Hubungi admin bootcamp.');
  });

  it('membedakan kegagalan server dari email yang ditolak', () => {
    // Menyebut kegagalan server sebagai "email tidak terdaftar" membuat peserta
    // mengetik ulang alamat yang sudah benar.
    //
    // Calling a server failure "email not registered" would have the participant
    // retype an address that was right.
    expect(route).toMatch(/status: 502/);
    expect(route).toContain('Layanan masuk sedang bermasalah');
  });

  it('memasang session cookie yang tidak terbaca skrip', () => {
    const cookie = route.slice(route.indexOf('response.cookies.set'));
    expect(cookie).toMatch(/httpOnly: true/);
    expect(cookie).toMatch(/sameSite: 'lax'/);
  });

  it('menyebut putusnya koneksi dengan bahasa peserta', () => {
    // fetch melempar TypeError saat koneksi peserta sendiri putus, dan "Failed
    // to fetch" tidak memberi tahu apa yang harus dilakukan.
    //
    // fetch throws a TypeError when the participant's own connection drops, and
    // "Failed to fetch" says nothing about what to do.
    for (const isi of [login, presensi]) {
      expect(isi).toMatch(/if \(err instanceof TypeError\)/);
      expect(isi).toContain('Periksa koneksi internet Anda');
    }
  });
});

const buatCookie = vi.fn(async (idToken: string) => `cookie-dari-${idToken}`);
vi.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: () => ({ createSessionCookie: (t: string) => buatCookie(t) }),
  getAdminDb: () => ({}),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));

describe('penukaran token di server, dijalankan', () => {
  const fetchAsli = globalThis.fetch;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'kunci-uji';
    buatCookie.mockClear();
  });
  afterEach(() => {
    globalThis.fetch = fetchAsli;
  });

  it('mengirim custom token ke Google dan menjadikan ID token-nya session cookie', async () => {
    const panggilan: { url: string; body: unknown }[] = [];
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      panggilan.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ idToken: 'id-123' }), { status: 200 });
    }) as typeof fetch;

    const { createSessionCookieFromCustomToken } = await import('@/features/auth/session');
    await expect(createSessionCookieFromCustomToken('custom-abc')).resolves.toBe('cookie-dari-id-123');

    expect(panggilan).toHaveLength(1);
    expect(panggilan[0].url).toContain('accounts:signInWithCustomToken?key=kunci-uji');
    expect(panggilan[0].body).toEqual({ token: 'custom-abc', returnSecureToken: true });
    expect(buatCookie).toHaveBeenCalledWith('id-123');
  });

  it('melempar galat bila Google menolak, tanpa membuat sesi', async () => {
    // Sesi yang dibuat dari jawaban yang ditolak akan memasukkan peserta tanpa
    // identitas yang sah.
    //
    // A session made from a rejected answer would sign someone in with no valid
    // identity.
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: 'INVALID_CUSTOM_TOKEN' } }), { status: 400 })
    ) as typeof fetch;

    const { createSessionCookieFromCustomToken } = await import('@/features/auth/session');
    await expect(createSessionCookieFromCustomToken('rusak')).rejects.toThrow('INVALID_CUSTOM_TOKEN');
    expect(buatCookie).not.toHaveBeenCalled();
  });

  it('melempar galat bila jawabannya berhasil tetapi tanpa ID token', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as typeof fetch;
    const { createSessionCookieFromCustomToken } = await import('@/features/auth/session');
    await expect(createSessionCookieFromCustomToken('x')).rejects.toThrow();
    expect(buatCookie).not.toHaveBeenCalled();
  });
});
