/**
 * Mengunggah foto website pameran ke Firebase Storage.
 *
 * Nama berkas = id slot di halaman, misalnya `hero-poster.jpg`,
 * `doc-web-smg-film-0.jpg`, atau `foto-p12.png`. Setiap foto diubah ke WebP
 * selebar maksimum 1600 piksel, diunggah ke `pameran/` dengan cache satu
 * tahun, lalu alamatnya dicatat di src/features/exhibition/photos.json.
 * Nama di Storage memuat sidik isi berkas, sehingga foto yang diganti
 * mendapat alamat baru dan tidak tertahan cache lama.
 *
 * Id slot:
 *   hero-poster, testi-plan, doc-1..doc-5, bento-1/3/4/6/8/9
 *   best-<kelas>, testi-<kelas>, trainer-<web|da|smm>, foto-<id peserta>
 *   doc-<kelas>-<hero|film|bento|kelas|momen|kenangan>-<n>
 * <kelas> = web-smg | da-jkt | smm-yk | smm-sby
 *
 * Uploads the exhibition website photos to Firebase Storage.
 *
 * File name = the slot id on the page, e.g. `hero-poster.jpg`,
 * `doc-web-smg-film-0.jpg`, or `foto-p12.png`. Each photo becomes a WebP at
 * most 1600 pixels wide, is uploaded to `pameran/` with a one-year cache, and
 * its address is recorded in src/features/exhibition/photos.json. The Storage
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
import { getAdminStorage } from '../src/lib/firebase/admin';

const SLOT = /^(hero-poster|testi-plan|doc-[1-5]|bento-(1|3|4|6|8|9)|(best|testi)-(web-smg|da-jkt|smm-yk|smm-sby)|trainer-(web|da|smm)|foto-p\d+|doc-(web-smg|da-jkt|smm-yk|smm-sby)-(hero|film|bento|kelas|momen|kenangan)-\d+)$/;
const MAX_BYTES = 300 * 1024;
const MANIFEST = path.resolve('src/features/exhibition/photos.json');

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
  const manifest: Record<string, string> = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

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
    manifest[slot] = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(object)}?alt=media`;
  }

  if (apply) {
    const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`\nphotos.json diperbarui (${Object.keys(sorted).length} slot). Commit dan deploy agar tampil.`);
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
