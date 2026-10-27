// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { gunzipSync } from 'zlib';

type Saved = { path: string; buffer: Buffer; options: any };
const saved: Saved[] = [];
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminStorage: () => ({
    bucket: () => ({ file: (path: string) => ({ save: async (buffer: Buffer, options: any) => void saved.push({ path, buffer, options }) }) }),
  }),
}));
const session = vi.hoisted(() => ({ actor: { uid: 'a', role: 'admin' } as any }));
vi.mock('@/features/auth/session', () => ({ getSessionActor: async () => session.actor }));

import { storeImage, storeHtml, storePdf, publicUrl } from '../../src/features/exhibition/media';
import { POST } from '../../src/app/api/pameran/upload/route';

const widthOf = async (b: Buffer) => (await sharp(b).metadata()).width;
const CACHE = 'public, max-age=31536000, immutable';

beforeEach(() => {
  saved.length = 0;
  session.actor = { uid: 'a', role: 'admin' };
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'bkt';
});

function req(fields: Record<string, string>, file: File) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  form.set('file', file);
  return new Request('http://x/api/pameran/upload', { method: 'POST', body: form });
}

describe('media Storage', () => {
  it('gambar disimpan dua ukuran WebP dengan cache immutable', async () => {
    const png = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#38f' } }).png().toBuffer();
    const cover = await storeImage(png, 'karya/w1');
    expect(saved.map((s) => s.options.contentType)).toEqual(['image/webp', 'image/webp']);
    expect(saved.every((s) => s.options.metadata.cacheControl === CACHE)).toBe(true);
    expect(await widthOf(saved[0].buffer)).toBe(640);
    expect(await widthOf(saved[1].buffer)).toBe(1600);
    expect(cover.thumb).toMatch(/pameran%2Fkarya%2Fw1%2F[0-9a-f]{10}\.webp/);
    expect(cover.full).toMatch(/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/bkt\/o\/.+\?alt=media$/);
    expect(cover.thumb).not.toBe(cover.full);
  });

  it('HTML disimpan gzip', async () => {
    await storeHtml(Buffer.from('<html></html>'), 'karya/w1');
    expect(saved[0].options.metadata.contentEncoding).toBe('gzip');
    expect(saved[0].options.contentType).toBe('text/html; charset=utf-8');
    expect(gunzipSync(saved[0].buffer).toString()).toBe('<html></html>');
  });

  it('PDF disimpan dengan jenis application/pdf', async () => {
    const url = await storePdf(Buffer.from('%PDF-1.4'), 'peserta/u1');
    expect(saved[0].path).toMatch(/^pameran\/peserta\/u1\/[0-9a-f]{10}\.pdf$/);
    expect(saved[0].options.contentType).toBe('application/pdf');
    expect(url).toBe(publicUrl(saved[0].path));
  });
});

describe('rute unggah', () => {
  it('menolak selain admin', async () => {
    session.actor = { uid: 'u', role: 'student' };
    const res = await POST(req({ kind: 'pdf', folder: 'situs' }, new File(['x'], 'a.pdf', { type: 'application/pdf' })));
    expect(res.status).toBe(403);
  });

  it('menolak PDF lebih dari 30 MB sebelum membaca isinya', async () => {
    const big = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 30 * 1024 * 1024 + 1 });
    const spy = vi.spyOn(big, 'arrayBuffer');
    const res = await POST({ formData: async () => ({ get: (k: string) => ({ file: big, kind: 'pdf', folder: 'situs' } as any)[k] }) } as any);
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
  });

  it.each(['../x', 'karya/../../x', 'karya/a/b', 'foo', 'karya/', 'karya/a b'])('menolak folder %s', async (folder) => {
    const res = await POST(req({ kind: 'pdf', folder }, new File(['x'], 'a.pdf', { type: 'application/pdf' })));
    expect(res.status).toBe(400);
    expect(saved).toHaveLength(0);
  });

  it('menolak jenis berkas yang tidak cocok', async () => {
    const res = await POST(req({ kind: 'pdf', folder: 'situs' }, new File(['x'], 'a.exe', { type: 'application/pdf' })));
    expect(res.status).toBe(400);
  });

  it('PDF sah mengembalikan { url }', async () => {
    const res = await POST(req({ kind: 'pdf', folder: 'karya/w-1_x' }, new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: expect.stringContaining('pameran%2Fkarya%2Fw-1_x%2F') });
  });
});
