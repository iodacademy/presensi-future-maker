import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { listUsers, setUserActive, updateUserAccount } from '@/features/users/list-service';

// Daftar seluruh akun untuk panel admin / Full account listing for the admin panel
export async function GET() {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  try {
    return NextResponse.json(await listUsers(actor));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Mengubah status aktif sebuah akun / Changes an account's active status
export async function PATCH(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (typeof body.uid !== 'string') {
      return NextResponse.json({ error: 'uid wajib disertakan' }, { status: 400 });
    }

    // Mengaktifkan akun dan menyunting isinya dipisahkan. Satu badan yang
    // memuat keduanya membuat sakelar aktif pada daftar ikut mengirim nama
    // dan surel yang kebetulan ada di layar.
    //
    // Toggling an account and editing its contents are kept apart. One body
    // carrying both would have the list's active switch also send whatever
    // name and email happened to be on screen.
    if (typeof body.active === 'boolean') {
      await setUserActive(actor, body.uid, body.active);
      return NextResponse.json({ updated: true });
    }

    await updateUserAccount(actor, body.uid, {
      name: body.name,
      email: body.email,
      classId: body.classId,
    });
    return NextResponse.json({ updated: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
