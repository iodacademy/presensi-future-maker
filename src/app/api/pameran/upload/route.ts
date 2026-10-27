import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { isValidFolder, storeHtml, storeImage, storePdf } from '@/features/exhibition/media';

const MB = 1024 * 1024;
// Jenis, batas ukuran, dan pola nama per kind / Type, size cap, and name pattern per kind
const KINDS = {
  image: { max: 15 * MB, types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], name: /\.(jpe?g|png|webp|gif)$/i },
  pdf: { max: 30 * MB, types: ['application/pdf'], name: /\.pdf$/i },
  html: { max: 15 * MB, types: ['text/html'], name: /\.html?$/i },
} as const;

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

/**
 * Unggahan media pameran (khusus admin).
 *
 * Exhibition media upload (admin only).
 */
export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    const kind = String(form.get('kind') ?? '') as keyof typeof KINDS;
    const folder = String(form.get('folder') ?? '');

    if (!(file instanceof File)) return bad('Berkas wajib disertakan');
    const rule = KINDS[kind];
    if (!rule) return bad('kind harus image, pdf, atau html');
    if (!isValidFolder(folder)) return bad('Folder tidak sah');
    if (!(rule.types as readonly string[]).includes(file.type) || !rule.name.test(file.name)) {
      return bad(`Jenis berkas tidak cocok untuk ${kind}`);
    }
    if (file.size <= 0) return bad('Berkas kosong');
    // Ukuran diperiksa sebelum berkas dibaca ke memori / Size is checked before the file is read into memory
    if (file.size > rule.max) return bad(`Ukuran ${kind} maksimal ${rule.max / MB} MB`);

    const buffer = Buffer.from(await file.arrayBuffer());
    if (kind === 'image') return NextResponse.json(await storeImage(buffer, folder));
    return NextResponse.json({ url: await (kind === 'pdf' ? storePdf : storeHtml)(buffer, folder) });
  } catch (err) {
    return bad((err as Error).message);
  }
}
