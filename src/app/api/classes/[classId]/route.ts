import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getClassById } from '@/features/classes/service';
import { deleteClass, getClassDeletionImpact } from '@/features/admin/delete-service';

// Endpoint detail satu kelas (field lengkap termasuk mentorIds, untuk Course Builder)
// Single class detail endpoint (full fields including mentorIds, for Course Builder)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  // Dokumen kelas memuat mentorIds dan requiredDailyTaskIds -- hanya untuk admin.
  // Siswa/mentor tidak boleh menelusuri kelas lain lewat classId di URL.
  //
  // The class document carries mentorIds and requiredDailyTaskIds -- admin only.
  // Students/mentors must not enumerate other classes via the URL classId.
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { classId } = await params;
  const { searchParams } = new URL(request.url);

  try {
    // Ringkasan dampak dilayani dari endpoint yang sama agar UI penghapusan
    // tidak perlu menebak jumlah data yang ikut terhapus.
    //
    // The impact summary is served from the same endpoint so the deletion UI
    // need not guess how much data goes with it.
    if (searchParams.get('impact') === '1') {
      return NextResponse.json(await getClassDeletionImpact(actor, classId));
    }

    const classData = await getClassById(classId);
    if (!classData) {
      return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ class: classData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { classId } = await params;
  try {
    await deleteClass(actor, classId);
    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
