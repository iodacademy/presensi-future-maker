import { NextResponse } from 'next/server';
import { deleteCv, readCvFile } from '@/features/careers/cv-service';
import { asSignedIn, asStudent } from '../../guard';

type Ctx = { params: Promise<{ id: string }> };

// Membuka CV atau surat lamaran bagi pemiliknya dan admin / Opens a CV or cover letter for its owner and admins
export const GET = (_req: Request, { params }: Ctx) =>
  asSignedIn(async (actor) => {
    let file: Awaited<ReturnType<typeof readCvFile>>;
    try {
      file = await readCvFile(actor, (await params).id);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 403 });
    }
    // Tanpa sandbox: penampil PDF Chrome dianggap plugin dan diblokir oleh sandbox, sehingga pratinjau CV kosong.
    // Isinya sudah diperiksa berawalan %PDF- saat diunggah dan dikirim sebagai application/pdf dengan nosniff.
    // No sandbox: Chrome's PDF viewer counts as a plugin and sandbox blocks it, leaving the CV preview blank.
    // The content was checked to start with %PDF- at upload and is sent as application/pdf with nosniff.
    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "frame-ancestors 'self'",
        'Cache-Control': 'private, no-store',
      },
    });
  });

export const DELETE = (_req: Request, { params }: Ctx) =>
  asStudent(async (actor) => { await deleteCv(actor.uid, (await params).id); });
