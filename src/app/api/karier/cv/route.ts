import { listCvs, MAX_PDF_BYTES, uploadCv } from '@/features/careers/cv-service';
import type { CvKind } from '@/features/careers/model';
import { asStudent } from '../guard';

export const GET = () => asStudent(async (actor) => ({ cvs: await listCvs(actor.uid, 'cv'), covers: await listCvs(actor.uid, 'surat') }));

export const POST = (request: Request) =>
  asStudent(async (actor) => {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('Berkas wajib disertakan');
    // Ukuran diperiksa sebelum berkas dibaca ke memori / Size is checked before the file is read into memory
    if (file.size > MAX_PDF_BYTES) throw new Error('Ukuran PDF maksimal 2 MB');
    const bytes = Buffer.from(await file.arrayBuffer());
    return { cv: await uploadCv(actor.uid, String(form.get('kind') ?? 'cv') as CvKind, { name: file.name, type: file.type, size: file.size, bytes }) };
  });
