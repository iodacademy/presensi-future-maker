import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { commitAccountImport } from '@/features/users/import-service';

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { rows, forcedClassName } = body;

    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'Data baris harus berupa array' }, { status: 400 });
    }

    const result = await commitAccountImport(actor, rows, forcedClassName);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
