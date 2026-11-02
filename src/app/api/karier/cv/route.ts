import { listCvs, MAX_PDF_BYTES, uploadCv } from '@/features/careers/cv-service';
import type { CvKind } from '@/features/careers/model';
import { asStudent } from '../guard';

export const GET = () => asStudent(async (actor) => ({ cvs: await listCvs(actor.uid, 'cv'), covers: await listCvs(actor.uid, 'surat') }));

export const POST = (request: Request) =>
  asStudent(async (actor) => {
    // Panjang permintaan diperiksa sebelum formData() membaca seluruh isinya ke memori. Kiriman tanpa
    // panjang (chunked) ditolak: peramban selalu menyertakannya untuk FormData.
    // The request length is checked before formData() reads the whole body into memory. A body with no
    // length (chunked) is refused: browsers always send one for FormData.
    const length = Number(request.headers.get('content-length'));
    if (!Number.isFinite(length) || length <= 0) throw new Error('Panjang unggahan tidak diketahui');
    if (length > MAX_PDF_BYTES + 64 * 1024) throw new Error('Ukuran PDF maksimal 2 MB');
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('Berkas wajib disertakan');
    // Ukuran diperiksa sebelum berkas dibaca ke memori / Size is checked before the file is read into memory
    if (file.size > MAX_PDF_BYTES) throw new Error('Ukuran PDF maksimal 2 MB');
    const bytes = Buffer.from(await file.arrayBuffer());
    return { cv: await uploadCv(actor.uid, String(form.get('kind') ?? 'cv') as CvKind, { name: file.name, type: file.type, size: file.size, bytes }) };
  });
