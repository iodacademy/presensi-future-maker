import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { readSubmissionFile } from '@/features/tasks/submission-file';

// Membuka berkas pengumpulan bagi admin, pesertanya, atau mentornya
// Opens a submission's file for an admin, its participant, or their mentor
export async function GET(_request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ error: 'Masuk terlebih dahulu' }, { status: 401 });

  const { submissionId } = await params;
  try {
    const { buffer, contentType, fileName } = await readSubmissionFile(actor, submissionId);
    // PDF dan gambar dibuka di tab, sisanya diunduh. sandbox mencegah isi berkas
    // menjalankan skrip di domain aplikasi bila jenisnya ternyata salah.
    // PDFs and images open in the tab, the rest download. sandbox stops a file's
    // contents from running script on the app's domain should its type be wrong.
    const inline = contentType === 'application/pdf' || contentType.startsWith('image/');
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': 'sandbox',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }
}
