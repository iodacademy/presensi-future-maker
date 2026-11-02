import { getJobForStudent } from '@/features/careers/student-service';
import { asStudent, notFound } from '../../guard';

export const GET = (_req: Request, { params }: { params: Promise<{ id: string }> }) =>
  asStudent(async (actor) => (await getJobForStudent(actor, (await params).id, new Date())) ?? notFound('Lowongan tidak ditemukan'));
