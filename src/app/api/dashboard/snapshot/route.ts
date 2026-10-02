import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getSnapshot } from '@/features/dashboard/snapshot-service';

/**
 * Ringkasan dashboard.
 *
 * Dihitung ulang hanya bila sudah usang, atau bila admin memintanya dengan
 * refresh=1. Menghitungnya tiap kali halaman dibuka berarti membaca sekitar
 * tiga belas ribu dokumen untuk satu halaman yang paling sering dibuka.
 *
 * The dashboard snapshot.
 *
 * Recomputed only when stale, or when an admin asks with refresh=1. Computing
 * it on every page load would mean reading around thirteen thousand documents
 * for the most-opened page there is.
 */
export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const force = new URL(request.url).searchParams.get('refresh') === '1';

  try {
    return NextResponse.json({ snapshot: await getSnapshot(actor, { force }) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
