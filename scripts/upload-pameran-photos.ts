/**
 * Mengunggah foto website pameran ke Firebase Storage.
 *
 * Nama berkas = id slot di halaman, misalnya `hero-poster.jpg`,
 * atau `doc-web-smg-film-0.jpg`. Setiap foto diubah ke WebP
 * selebar maksimum 1600 piksel, diunggah ke `pameran/` dengan cache satu
 * tahun, lalu alamatnya dicatat di Firestore (exhibitionSite/content, kolom photos).
 * Nama di Storage memuat sidik isi berkas, sehingga foto yang diganti
 * mendapat alamat baru dan tidak tertahan cache lama.
 *
 * Id slot:
 *   hero-poster, testi-plan, doc-1..doc-5, bento-1/3/4/6/8/9
 *   testi-<kelas>, trainer-<web|da|smm>
 *   doc-<kelas>-<hero|film|bento|kelas|momen|kenangan>-<n>
 * <kelas> = web-smg | da-jkt | smm-yk | smm-sby
 *
 * Uploads the exhibition website photos to Firebase Storage.
 *
 * File name = the slot id on the page, e.g. `hero-poster.jpg`,
 * or `doc-web-smg-film-0.jpg`. Each photo becomes a WebP at
 * most 1600 pixels wide, is uploaded to `pameran/` with a one-year cache, and
 * its address is recorded in Firestore (exhibitionSite/content, field photos). The Storage
 * name carries a hash of the content, so a replaced photo gets a new address
 * and is not held back by an old cache.
 *
 * Pemakaian / Usage:
 *   npm run upload-pameran-photos -- <folder>            (pratinjau / preview)
 *   npm run upload-pameran-photos -- <folder> --apply
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getAdminDb, getAdminStorage } from '../src/lib/firebase/admin';

const SLOT = /^(hero-poster|testi-plan|doc-[1-5]|bento-(1|3|4|6|8|9)|testi-(web-smg|da-jkt|smm-yk|smm-sby)|trainer-(web|da|smm)|doc-(web-smg|da-jkt|smm-yk|smm-sby)-(hero|film|bento|kelas|momen|kenangan)-\d+)$/;
const MAX_BYTES = 300 * 1024;

async function compress(file: string): Promise<Buffer> {
  // Mutu diturunkan bertahap sampai di bawah 300 kB / Quality steps down until under 300 kB
  for (const quality of [82, 72, 62]) {
    const out = await sharp(file).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality }).toBuffer();
    if (out.length <= MAX_BYTES || quality === 62) return out;
  }
  throw new Error('unreachable');
}

async function main() {
  const dir = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!dir || !fs.existsSync(dir)) throw new Error('Sebutkan folder foto, misalnya: npm run upload-pameran-photos -- ./foto-pameran');
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET belum disetel');
  const bucket = getAdminStorage().bucket(bucketName);
  const added: Record<string, string> = {};

  for (const name of fs.readdirSync(dir).sort()) {
    const ext = path.extname(name).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;
    const slot = path.basename(name, path.extname(name));
    if (!SLOT.test(slot)) {
      console.warn(`Lewati ${name}: "${slot}" bukan id slot yang dikenal`);
      continue;
    }
    const data = await compress(path.join(dir, name));
    const object = `pameran/${slot}-${crypto.createHash('sha256').update(data).digest('hex').slice(0, 10)}.webp`;
    const kb = Math.round(data.length / 1024);
    console.log(`${slot} → ${object} (${kb} kB)${kb > 300 ? ' — masih di atas 300 kB' : ''}`);
    if (!apply) continue;
    await bucket.file(object).save(data, { contentType: 'image/webp', metadata: { cacheControl: 'public, max-age=31536000, immutable' } });
    added[slot] = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(object)}?alt=media`;
  }

  if (apply) {
    // Gabung ke foto yang ada tanpa menyentuh kolom lain / Merge into existing photos without touching other fields
    const ref = getAdminDb().collection('exhibitionSite').doc('content');
    const stored = ((await ref.get()).data()?.photos ?? {}) as Record<string, string>;
    const photos = Object.fromEntries(Object.entries({ ...stored, ...added }).sort(([a], [b]) => a.localeCompare(b)));
    await ref.set({ photos }, { merge: true });
    console.log(`
exhibitionSite/content diperbarui (${Object.keys(photos).length} slot). Cache publik habis dalam 5 menit.`);
  } else {
    console.log('\nIni mode pratinjau -- tidak ada yang diunggah.\nJalankan ulang dengan --apply untuk mengunggah.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Gagal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
