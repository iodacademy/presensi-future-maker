import { sendEmails } from '@/features/email/service';
import { asAdmin } from '../../karier/guard';

// Pengiriman berkelompok lewat Apps Script bisa makan beberapa menit / Batched sending through Apps Script can take a few minutes
export const maxDuration = 300;

export const POST = (request: Request) => asAdmin(async (actor) => sendEmails(actor, await request.json()));
