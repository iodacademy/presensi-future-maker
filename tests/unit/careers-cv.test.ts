// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { data, fakeDb, fakeStorage, objects, reset } from './careers-fake-db';

const getSessionActor = vi.fn();
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb, getAdminStorage: () => fakeStorage }));

import { deleteCv, listCvs, readCvFile, uploadCv } from '../../src/features/careers/cv-service';
import { GET as fileGet } from '../../src/app/api/karier/cv/[id]/route';
import { POST as cvPost } from '../../src/app/api/karier/cv/route';

const pdf = (size = 100) => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(Math.max(0, size - 9), 'a')]);
const file = (bytes: Buffer, name = 'CV Andi.pdf', type = 'application/pdf') => ({ name, type, size: bytes.length, bytes });

beforeEach(() => { reset({ studentCvs: {} }); getSessionActor.mockResolvedValue({ uid: 'u1', role: 'student' }); });

describe('bank CV', () => {
  it('menolak berkas yang bukan PDF walau bernama .pdf', async () => {
    await expect(uploadCv('u1', 'cv', file(Buffer.from('hello')))).rejects.toThrow('Berkas harus PDF');
  });

  it('menolak PDF lebih dari 2 MB', async () => {
    await expect(uploadCv('u1', 'cv', file(pdf(2 * 1024 * 1024 + 1)))).rejects.toThrow('Ukuran PDF maksimal 2 MB');
  });

  it('menyimpan berkas privat di cv/<uid>/<id>.pdf', async () => {
    const cv = await uploadCv('u1', 'cv', file(pdf()));
    expect(cv.storagePath).toBe(`cv/u1/${cv.id}.pdf`);
    expect(objects[cv.storagePath]).toBeTruthy();
    expect(data.studentCvs[cv.id]).toMatchObject({ ownerUid: 'u1', kind: 'cv', fileName: 'CV Andi.pdf', deleted: false });
  });

  it('maksimal lima CV aktif, surat dihitung terpisah', async () => {
    for (let i = 0; i < 5; i++) await uploadCv('u1', 'cv', file(pdf()));
    await expect(uploadCv('u1', 'cv', file(pdf()))).rejects.toThrow('Maksimal 5 CV tersimpan. Hapus salah satu dulu.');
    await expect(uploadCv('u1', 'surat', file(pdf()))).resolves.toBeTruthy();
  });

  it('hapus hanya menandai, berkas tetap ada untuk lamaran lama', async () => {
    const cv = await uploadCv('u1', 'cv', file(pdf()));
    await expect(deleteCv('u2', cv.id)).rejects.toThrow('CV tidak ditemukan');
    await deleteCv('u1', cv.id);
    expect(data.studentCvs[cv.id].deleted).toBe(true);
    expect(objects[cv.storagePath]).toBeTruthy();
    expect(await listCvs('u1')).toEqual([]);
  });

  it('hanya pemilik dan admin yang bisa membuka berkas', async () => {
    const cv = await uploadCv('u1', 'cv', file(pdf()));
    await expect(readCvFile({ uid: 'u2', role: 'student' } as never, cv.id)).rejects.toThrow('Tidak boleh membuka berkas ini');
    await expect(readCvFile({ uid: 'a', role: 'admin' } as never, cv.id)).resolves.toMatchObject({ fileName: 'CV Andi.pdf' });
    await expect(readCvFile({ uid: 'u1', role: 'student' } as never, cv.id)).resolves.toBeTruthy();
  });

  it('unggah-hapus berulang dibatasi 20 berkas per jenis', async () => {
    for (let i = 0; i < 20; i++) await deleteCv('u1', (await uploadCv('u1', 'cv', file(pdf()))).id);
    await expect(uploadCv('u1', 'cv', file(pdf()))).rejects.toThrow('Batas unggahan CV tercapai. Hubungi admin.');
  });

  it('permintaan unggah yang terlalu besar ditolak sebelum isinya dibaca', async () => {
    const req = new Request('http://x', { method: 'POST', headers: { 'content-length': String(3 * 1024 * 1024) }, body: 'x' });
    const formData = vi.spyOn(req, 'formData');
    const res = await cvPost(req);
    expect(res.status).toBe(400);
    expect(formData).not.toHaveBeenCalled();
  });

  it('permintaan unggah tanpa panjang yang sah ditolak sebelum isinya dibaca', async () => {
    const req = new Request('http://x', { method: 'POST', body: 'x' });
    req.headers.delete('content-length');
    const formData = vi.spyOn(req, 'formData');
    expect((await cvPost(req)).status).toBe(400);
    expect(formData).not.toHaveBeenCalled();
  });

  it('PDF boleh tampil di iframe aplikasi: tanpa sandbox, hanya bingkai dari situs sendiri', async () => {
    const cv = await uploadCv('u1', 'cv', file(pdf()));
    const res = await fileGet(new Request('http://x'), { params: Promise.resolve({ id: cv.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toBe("frame-ancestors 'self'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('rute berkas menolak siswa lain dengan 403', async () => {
    const cv = await uploadCv('u1', 'cv', file(pdf()));
    getSessionActor.mockResolvedValue({ uid: 'u2', role: 'student' });
    const res = await fileGet(new Request('http://x'), { params: Promise.resolve({ id: cv.id }) });
    expect(res.status).toBe(403);
  });
});

describe('dokumen penerimaan magang', () => {
  it('hanya peserta yang sudah ditempatkan yang bisa mengunggah', async () => {
    await expect(uploadCv('u1', 'penerimaan', file(pdf(), 'LoA.pdf'))).rejects.toThrow('Dokumen penerimaan hanya untuk peserta yang sudah ditempatkan');
    data.internshipPlacements = { u1: { studentId: 'u1', partnerName: 'Mayar', position: 'DM' } };
    const doc = await uploadCv('u1', 'penerimaan', file(pdf(), 'LoA.pdf'));
    expect(data.studentCvs[doc.id]).toMatchObject({ ownerUid: 'u1', kind: 'penerimaan', fileName: 'LoA.pdf' });
    expect((await listCvs('u1', 'penerimaan')).map((d) => d.id)).toEqual([doc.id]);
  });

  it('tawaran yang diterima lewat Portal Karier juga berarti sudah ditempatkan', async () => {
    data.jobApplications = { a1: { studentId: 'u1', status: 'bergabung' } };
    await expect(uploadCv('u1', 'penerimaan', file(pdf(), 'Kontrak.pdf'))).resolves.toBeTruthy();
  });
});

