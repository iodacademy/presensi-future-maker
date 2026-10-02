import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getProfile, saveProfile } from '@/features/users/profile-service';

/**
 * Profil peserta yang sedang masuk.
 *
 * Mengembalikan complete sebagai penanda, bukan hanya dokumennya: halaman
 * peserta memanggil ini sebelum menggambar apa pun, dan memeriksa kelengkapan
 * di sisi peramban berarti aturannya tersebar di setiap halaman.
 *
 * The signed-in participant's profile.
 *
 * It returns a complete flag rather than only the document: participant pages
 * call this before drawing anything, and checking completeness in the browser
 * would spread the rule across every page.
 */
export async function GET() {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ error: 'Masuk terlebih dahulu' }, { status: 401 });
  }

  // Hanya peserta yang punya profil. Mentor dan admin tidak pernah diminta
  // melengkapinya, dan mengembalikan complete:false bagi mereka akan menahan
  // mereka pada formulir yang bukan untuknya.
  //
  // Only participants have a profile. Mentors and admins are never asked to
  // complete one, and returning complete:false for them would hold them on a
  // form that is not theirs.
  if (actor.role !== 'student') {
    return NextResponse.json({ complete: true, profile: null });
  }

  const profile = await getProfile(actor.uid);
  return NextResponse.json({ complete: profile !== null, profile });
}

export async function PUT(request: Request) {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ error: 'Masuk terlebih dahulu' }, { status: 401 });
  }

  try {
    await saveProfile(actor, await request.json());
    return NextResponse.json({ saved: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
