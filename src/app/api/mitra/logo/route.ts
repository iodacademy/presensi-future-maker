import { storeImage } from '@/features/exhibition/media';
import { asPartner } from '../../karier/guard';

const MAX = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Logo PIC disimpan di folder mitra/<partnerId> miliknya sendiri / A PIC's logo goes to their own mitra/<partnerId> folder
export const POST = (request: Request) =>
  asPartner(async (actor) => {
    const length = Number(request.headers.get('content-length'));
    if (!Number.isFinite(length) || length <= 0 || length > MAX + 64 * 1024) throw new Error('Ukuran logo maksimal 5 MB');
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('Berkas wajib disertakan');
    if (!TYPES.includes(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name)) throw new Error('Logo harus JPG, PNG, atau WebP');
    if (file.size > MAX) throw new Error('Ukuran logo maksimal 5 MB');
    return storeImage(Buffer.from(await file.arrayBuffer()), `mitra/${actor.partnerId}`);
  });
