// Penyimpanan media pameran di Firebase Storage / Exhibition media storage
import crypto from 'crypto';
import { gzipSync } from 'zlib';
import sharp from 'sharp';
import { getAdminStorage } from '../../lib/firebase/admin';
import type { WorkCover } from './model';

const CACHE = 'public, max-age=31536000, immutable';

/**
 * Alamat publik objek; formatnya sama dengan scripts/upload-pameran-photos.ts.
 *
 * Public URL of an object; same format as scripts/upload-pameran-photos.ts.
 */
export function publicUrl(objectPath: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(objectPath)}?alt=media`;
}

/**
 * Folder hanya boleh karya/<id>, peserta/<id>, mitra/<id>, atau situs; selain itu bisa
 * menyusup keluar dari pameran/ lewat "..".
 *
 * Folder may only be karya/<id>, peserta/<id>, mitra/<id>, or situs; anything else could
 * escape pameran/ via "..".
 */
export function isValidFolder(folder: string): boolean {
  return folder === 'situs' || /^(karya|peserta|mitra)\/[A-Za-z0-9_-]{1,64}$/.test(folder);
}

// Nama memuat sidik isi, jadi berkas yang diganti mendapat alamat baru / The name carries a content hash, so a replaced file gets a new address
async function put(data: Buffer, folder: string, ext: string, contentType: string, extra: Record<string, string> = {}): Promise<string> {
  if (!isValidFolder(folder)) throw new Error('Folder tidak sah');
  const objectPath = `pameran/${folder}/${crypto.createHash('sha1').update(data).digest('hex').slice(0, 10)}.${ext}`;
  const bucket = getAdminStorage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  await bucket.file(objectPath).save(data, { contentType, metadata: { cacheControl: CACHE, ...extra } });
  return publicUrl(objectPath);
}

export async function storeImage(buffer: Buffer, folder: string): Promise<WorkCover> {
  const webp = (width: number) => sharp(buffer).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const [thumb, full] = await Promise.all([webp(640), webp(1600)]);
  // Berurutan agar urutan simpan tetap / Sequential so the save order stays fixed
  const thumbUrl = await put(thumb, folder, 'webp', 'image/webp');
  const fullUrl = await put(full, folder, 'webp', 'image/webp');
  return { thumb: thumbUrl, full: fullUrl };
}

export function storePdf(buffer: Buffer, folder: string): Promise<string> {
  return put(buffer, folder, 'pdf', 'application/pdf');
}

export function storeHtml(buffer: Buffer, folder: string): Promise<string> {
  return put(gzipSync(buffer), folder, 'html', 'text/html; charset=utf-8', { contentEncoding: 'gzip' });
}
