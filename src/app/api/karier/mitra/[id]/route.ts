import { getPartnerProfile } from '@/features/careers/student-service';
import { asStudent, notFound } from '../../guard';

export const GET = (_req: Request, { params }: { params: Promise<{ id: string }> }) =>
  asStudent(async (actor) => (await getPartnerProfile(actor, (await params).id, new Date())) ?? notFound('Mitra tidak ditemukan'));
