import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { uploadExamImage, MAX_IMAGE_BYTES } from '@/features/uploads/service';

/**
 * Unggahan gambar soal.
 *
 * Melewati server, bukan langsung dari peramban ke Storage: aturan Storage
 * menolak seluruh akses langsung, sehingga setiap berkas diperiksa perannya,
 * jenisnya, dan ukurannya lebih dulu di sini.
 *
 * Question image upload.
 *
 * It goes through the server rather than browser-to-Storage: the Storage rules
 * refuse all direct access, so every file has its role, type, and size checked
 * here first.
 */
export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    const examId = String(form.get('examId') ?? '');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Berkas gambar wajib disertakan' }, { status: 400 });
    }
    if (!examId) {
      return NextResponse.json({ error: 'examId wajib disertakan' }, { status: 400 });
    }

    // Ukuran diperiksa sebelum berkasnya dibaca ke memori. Membaca lebih dulu
    // lalu menolaknya berarti berkas besar tetap menghabiskan memori server
    // sebelum ditolak.
    //
    // The size is checked before the file is read into memory. Reading first
    // and refusing after would still spend server memory on a large file.
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `Ukuran gambar maksimal ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const hasil = await uploadExamImage(actor, examId, {
      buffer,
      contentType: file.type,
      fileName: file.name,
    });

    return NextResponse.json(hasil);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
