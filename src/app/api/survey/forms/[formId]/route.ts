import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getSurveyForm, updateSurveyForm, deleteSurveyForm } from '@/features/survey/service';

export async function GET(request: Request, { params }: { params: Promise<{ formId: string }> }) {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ error: 'Masuk terlebih dahulu' }, { status: 401 });
  }

  const { formId } = await params;
  const form = await getSurveyForm(formId);
  if (!form) {
    return NextResponse.json({ error: 'Survei tidak ditemukan' }, { status: 404 });
  }
  return NextResponse.json({ form });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ formId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { formId } = await params;
  try {
    await updateSurveyForm(actor, formId, await request.json());
    return NextResponse.json({ updated: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ formId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { formId } = await params;
  try {
    await deleteSurveyForm(actor, formId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
