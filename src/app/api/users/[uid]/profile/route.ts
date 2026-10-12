import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getProfile, updateProfileByAdmin } from '@/features/users/profile-service';

type Params = { params: Promise<{ uid: string }> };

// Admin membaca profil seorang peserta / An admin reads a participant's profile
export async function GET(_request: Request, { params }: Params) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }
  const { uid } = await params;
  return NextResponse.json({ profile: await getProfile(uid) });
}

// Admin membetulkan profil yang sudah diisi peserta / An admin corrects a profile the participant filled in
export async function PUT(request: Request, { params }: Params) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }
  const { uid } = await params;
  try {
    await updateProfileByAdmin(actor, uid, await request.json());
    return NextResponse.json({ saved: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
