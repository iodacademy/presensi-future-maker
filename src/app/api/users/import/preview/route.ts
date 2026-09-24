import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { previewAccountImport } from '@/features/users/import-service';

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

    if (rows.length > 100) {
      return NextResponse.json({ error: 'Maksimum 100 baris data per impor' }, { status: 400 });
    }

    const result = await previewAccountImport(actor, rows, forcedClassName);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
