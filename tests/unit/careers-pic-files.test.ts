// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, fakeStorage, objects, reset } from './careers-fake-db';

vi.mock('../../src/features/auth/session', () => ({ getSessionActor: vi.fn() }));
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb, getAdminStorage: () => fakeStorage }));

import { readCvFile } from '../../src/features/careers/cv-service';
import { readSubmissionFile } from '../../src/features/tasks/submission-file';

const pic = (partnerId: string) => ({ uid: 'r-' + partnerId, role: 'partner', partnerId }) as never;

beforeEach(() => {
  reset({
    studentCvs: {
      cv1: { ownerUid: 'u1', kind: 'cv', fileName: 'CV Andi.pdf', storagePath: 'cv/u1/cv1.pdf', deleted: false, uploadedAt: '1' },
      sl1: { ownerUid: 'u1', kind: 'surat', fileName: 'Surat.pdf', storagePath: 'cv/u1/sl1.pdf', deleted: false, uploadedAt: '1' },
    },
    submissions: {
      t1_u1: { studentId: 'u1', fileId: 'submissions/k1/t1/u1/a.pdf', fileName: 'tpm.pdf' },
      t2_u1: { studentId: 'u1', fileId: 'submissions/k1/t2/u1/b.pdf', fileName: 'lain.pdf' },
    },
    jobApplications: {
      j1_u1: { partnerId: 'p1', studentId: 'u1', cvId: 'cv1', coverLetterId: 'sl1', tasks: [{ submissionId: 't1_u1', title: 'TPM', kind: 'daily', url: '' }] },
    },
    assignments: {},
  });
  for (const p of ['cv/u1/cv1.pdf', 'cv/u1/sl1.pdf', 'submissions/k1/t1/u1/a.pdf', 'submissions/k1/t2/u1/b.pdf']) objects[p] = Buffer.from('%PDF-');
});

describe('berkas pelamar untuk PIC', () => {
  it('PIC perusahaan yang dilamar bisa membuka CV dan surat lamaran', async () => {
    await expect(readCvFile(pic('p1'), 'cv1')).resolves.toMatchObject({ fileName: 'CV Andi.pdf' });
    await expect(readCvFile(pic('p1'), 'sl1')).resolves.toMatchObject({ fileName: 'Surat.pdf' });
  });

  it('PIC perusahaan lain tidak bisa membuka CV', async () => {
    await expect(readCvFile(pic('p2'), 'cv1')).rejects.toThrow('Tidak boleh membuka berkas ini');
  });

  it('berkas tugas hanya terbuka bila dilampirkan ke lamaran perusahaan itu', async () => {
    await expect(readSubmissionFile(pic('p1'), 't1_u1')).resolves.toMatchObject({ fileName: 'tpm.pdf' });
    await expect(readSubmissionFile(pic('p2'), 't1_u1')).rejects.toThrow('Anda tidak berhak membuka berkas ini');
    await expect(readSubmissionFile(pic('p1'), 't2_u1')).rejects.toThrow('Anda tidak berhak membuka berkas ini');
  });
});
