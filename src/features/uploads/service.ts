// Unggahan gambar soal ujian / Exam question image uploads
import crypto from 'crypto';
import { getAdminStorage } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';

/**
 * Jenis berkas yang diterima.
 *
 * Daftar putih, bukan daftar hitam: jenis yang tidak terduga selalu lebih
 * banyak daripada yang dapat disebutkan, dan satu jenis yang terlewat pada
 * daftar hitam berarti berkas apa pun dapat masuk.
 *
 * SVG sengaja tidak termasuk meski berupa gambar: isinya dapat memuat skrip
 * yang berjalan saat gambarnya dibuka langsung.
 *
 * The accepted file types.
 *
 * An allowlist, not a blocklist: unexpected types always outnumber the ones
 * anyone can name, and a single type missed on a blocklist means any file can
 * pass.
 *
 * SVG is deliberately absent although it is an image: its contents can carry
 * script that runs when the image is opened directly.
 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

/**
 * Batas ukuran berkas, dalam bita.
 *
 * Gambar soal dibuka peserta lewat jaringan seluler di ruang kelas; berkas
 * lima megabita membuat satu soal memuat lebih lama daripada waktu yang
 * tersedia untuk menjawabnya.
 *
 * The file size cap, in bytes.
 *
 * Question images open on participants' mobile connections in a classroom; a
 * five-megabyte file makes one question take longer to load than the time
 * available to answer it.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function requireAdmin(actor: Actor): void {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan mengunggah gambar');
  }
}

/**
 * Memvalidasi sebuah berkas sebelum diunggah.
 *
 * Jenisnya diperiksa dari contentType yang dikirim peramban maupun dari
 * namanya: keduanya dapat dipalsukan sendiri-sendiri, tetapi memeriksa
 * keduanya menuntut pemalsuan yang konsisten.
 *
 * Validates a file before uploading.
 *
 * The type is checked against both the browser's contentType and the file
 * name: either can be forged on its own, but checking both demands a
 * consistent forgery.
 */
export function validateImage(input: { contentType: string; size: number; fileName: string }): void {
  if (!ALLOWED_IMAGE_TYPES.includes(input.contentType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new Error('Berkas harus berupa gambar JPG, PNG, WebP, atau GIF');
  }

  if (!/\.(jpe?g|png|webp|gif)$/i.test(input.fileName)) {
    throw new Error('Nama berkas harus berakhiran .jpg, .png, .webp, atau .gif');
  }

  if (input.size <= 0) {
    throw new Error('Berkas kosong');
  }

  if (input.size > MAX_IMAGE_BYTES) {
    throw new Error(`Ukuran gambar maksimal ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB`);
  }
}

/**
 * Mengunggah gambar soal dan mengembalikan tautannya.
 *
 * Nama berkasnya dibuat ulang, bukan memakai nama asli dari peramban: nama
 * kiriman dapat memuat garis miring yang memindahkan berkasnya ke jalur lain,
 * dan dapat menimpa berkas yang sudah ada bila namanya kebetulan sama.
 *
 * Uploads a question image and returns its link.
 *
 * The file name is generated rather than taken from the browser: a submitted
 * name can carry slashes that move the file to another path, and can overwrite
 * an existing file when the name happens to match.
 */
export async function uploadExamImage(
  actor: Actor,
  examId: string,
  file: { buffer: Buffer; contentType: string; fileName: string }
): Promise<{ url: string; path: string }> {
  requireAdmin(actor);

  validateImage({ contentType: file.contentType, size: file.buffer.length, fileName: file.fileName });

  const ext = file.fileName.split('.').pop()!.toLowerCase();
  const path = `exam-images/${examId}/${crypto.randomUUID()}.${ext}`;

  const bucket = getAdminStorage().bucket();
  const blob = bucket.file(path);

  // Token unduhan dibuat sendiri agar tautannya dapat dibuka peserta tanpa
  // kredensial. Aturan Storage menolak seluruh akses langsung, sehingga tanpa
  // token ini gambarnya hanya dapat dibaca oleh server.
  //
  // A download token is generated so participants can open the link without
  // credentials. The Storage rules refuse all direct access, so without this
  // token only the server could read the image.
  const token = crypto.randomUUID();

  await blob.save(file.buffer, {
    contentType: file.contentType,
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: token,
        uploadedBy: actor.uid,
        examId,
      },
    },
  });

  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

  return { url, path };
}

/**
 * Menghapus gambar yang sudah diunggah.
 *
 * Kegagalan diabaikan: berkas yang sudah tidak ada bukan kesalahan, dan
 * menggagalkan penghapusan soal hanya karena gambarnya tidak ditemukan
 * meninggalkan soal yang tidak dapat dihapus sama sekali.
 *
 * Deletes an uploaded image.
 *
 * Failures are ignored: a file already gone is not an error, and failing a
 * question's deletion because its image is missing would leave a question that
 * cannot be deleted at all.
 */
export async function deleteExamImage(actor: Actor, path: string): Promise<void> {
  requireAdmin(actor);

  // Jalur diperiksa agar penghapusan tidak dapat diarahkan ke berkas lain di
  // luar gambar ujian.
  //
  // The path is checked so a deletion cannot be aimed at any file outside the
  // exam images.
  if (!path.startsWith('exam-images/')) {
    throw new Error('Jalur berkas tidak sah');
  }

  try {
    await getAdminStorage().bucket().file(path).delete();
  } catch {
    // Berkas sudah tidak ada; tidak ada yang perlu dilakukan.
    // The file is already gone; nothing to do.
  }
}
