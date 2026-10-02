import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getSessionActor } from '@/features/auth/session';

/**
 * Catatan admin tentang seorang peserta.
 *
 * Disimpan di luar dokumen penggunanya: catatan ini milik admin, bukan milik
 * peserta, dan menaruhnya pada dokumen pengguna berarti ia ikut terbaca setiap
 * kali akun itu dimuat -- termasuk pada jalur yang dipakai peserta sendiri.
 *
 * An admin's note about a participant.
 *
 * Stored outside the user document: the note belongs to the admin, not the
 * participant, and putting it on the user document means it is read every time
 * that account loads -- including on paths the participant themselves use.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { studentId } = await params;

  try {
    const body = await request.json();
    const note = String(body.note ?? '').trim();
    const followUp = String(body.followUp ?? '').trim();

    // Batas panjang: kolom catatan yang tidak dibatasi membuat satu baris tabel
    // mendorong seluruh kolom lainnya keluar layar.
    //
    // A length cap: an unbounded note field would have one table row push every
    // other column off screen.
    if (note.length > 500 || followUp.length > 500) {
      return NextResponse.json({ error: 'Catatan maksimal 500 karakter' }, { status: 400 });
    }

    await getAdminDb().collection('studentNotes').doc(studentId).set({
      note,
      followUp,
      updatedBy: actor.name,
      updatedAt: new Date().toISOString(),
    });

    // Ringkasan hari ini dihapus agar catatan barunya terbaca pada pemuatan
    // berikutnya. Tanpa ini, catatan yang baru diketik tidak muncul sampai
    // ringkasannya berumur satu jam, dan admin mengira penyimpanannya gagal.
    //
    // Today's snapshot is dropped so the new note is read on the next load.
    // Without this, a note just typed would not appear until the snapshot turns
    // an hour old, and the admin would assume the save failed.
    const hariIni = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
    }).format(new Date());
    await getAdminDb().collection('dashboardSnapshots').doc(hariIni).delete().catch(() => {});

    return NextResponse.json({ saved: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
