import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { createSession, listSessionsForClass } from '@/features/attendance/service';

export async function GET(request: Request) {
  // Sesi memuat zoomUrl dan alamat lokasi; classId datang dari query sehingga
  // tanpa penguncian role siapa pun bisa membaca jadwal kelas lain. Siswa
  // memakai /api/attendance/student yang terikat ke kelasnya sendiri.
  //
  // Sessions carry zoomUrl and venue address; classId comes from the query, so
  // without a role gate anyone could read other classes' schedules. Students
  // use /api/attendance/student, which is bound to their own class.
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get('classId');
  if (!classId) {
    return NextResponse.json({ error: 'classId wajib disertakan' }, { status: 400 });
  }

  try {
    const sessions = await listSessionsForClass(classId);
    return NextResponse.json({ sessions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan membuat jadwal pertemuan' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const result = await createSession(actor, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
