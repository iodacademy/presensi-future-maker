import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { bulkUpdateWorks, type BulkPatch } from '@/features/exhibition/admin-works';

const MAX_IDS = 5000;
const PATCH_KEYS = ['status', 'aiAssisted', 'collectionId'];

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }
  try {
    const { ids, patch } = (await request.json()) as { ids: string[]; patch: BulkPatch };
    if (!Array.isArray(ids) || ids.some((i) => typeof i !== 'string')) throw new Error('ids harus berupa daftar teks');
    if (ids.length > MAX_IDS) throw new Error(`ids maksimal ${MAX_IDS}`);
    if (!patch || typeof patch !== 'object' || Object.keys(patch).some((k) => !PATCH_KEYS.includes(k))) {
      throw new Error('patch memuat kunci yang tidak dikenal');
    }
    return NextResponse.json({ updated: await bulkUpdateWorks(ids, patch) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
