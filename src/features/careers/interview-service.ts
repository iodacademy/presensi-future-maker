/**
 * Undangan interview dari PIC dan konfirmasi dari siswa. Link Meet otomatis
 * memakai jembatan Apps Script mentoring: acara Kalender dibuat dengan PIC
 * sebagai co-host, dan Google Calendar mengirim email undangan ke keduanya.
 *
 * Interview invitations from PICs and confirmations from students. The
 * automatic Meet link uses the mentoring Apps Script bridge: a Calendar event is
 * created with the PIC as co-host, and Google Calendar emails both of them.
 */
import { getAdminDb } from '../../lib/firebase/admin';
import { whatsAppLink } from '../../lib/whatsapp';
import type { Actor } from '../auth/types';
import { cancelCalendarEvent, createCalendarEvent, isCalendarConfigured } from '../calendar/client';
import { interviewMessage, interviewWindow, validateInterviewInput, type Interview } from './model';
import type { PartnerActor } from './partner-service';

const apps = () => getAdminDb().collection('jobApplications');

export async function inviteToInterview(actor: PartnerActor, appId: string, raw: unknown, now: Date): Promise<{ waLink: string | null; meetUrl: string }> {
  const snap = await apps().doc(appId).get();
  if (!snap.exists || snap.get('partnerId') !== actor.partnerId) throw new Error('Lamaran tidak ditemukan');
  const input = validateInterviewInput(raw);
  const personal = snap.get('personal') as { fullName: string; email: string; phone: string };
  const job = await getAdminDb().collection('jobs').doc(String(snap.get('jobId'))).get();
  const jobTitle = String(job.get('title') ?? 'Lowongan');
  const partnerName = String(job.get('partnerName') ?? '');

  if (input.linkSource === 'meet-auto' && !isCalendarConfigured()) throw new Error('Link Meet otomatis belum tersedia. Tempel link meeting sendiri.');

  const previous = snap.get('interview') as Interview | undefined;

  let url = input.url;
  let calendarEventId: string | null = null;
  if (input.linkSource === 'meet-auto') {
    const ev = await createCalendarEvent({
      bookingId: `interview-${appId}`,
      summary: `Interview ${jobTitle} · ${partnerName}`,
      description: [`Kandidat: ${personal.fullName}`, `Pewawancara: ${input.interviewer}`, input.note].filter(Boolean).join('\n'),
      ...interviewWindow(input),
      studentEmail: personal.email,
      mentorEmail: actor.email,
      // Interview perusahaan tidak direkam, berbeda dari sesi mentoring (keputusan pemilik produk)
      // Company interviews are not recorded, unlike mentoring sessions (product owner's decision)
      record: false,
    });
    if (!ev.meetUrl) {
      // Acara tanpa link dibatalkan lagi agar tidak menjadi undangan yatim / An event without a link is cancelled so it is not an orphan invite
      await cancelCalendarEvent(ev.eventId).catch((e) => console.error('[karier] batal acara tanpa link', e));
      throw new Error('Link Meet belum terbentuk. Coba lagi atau tempel link sendiri.');
    }
    url = ev.meetUrl;
    calendarEventId = ev.eventId;
  }

  const t = now.toISOString();
  const interview: Interview = { ...input, url, confirmation: 'pending', rescheduleNote: '', calendarEventId, invitedAt: t };
  await apps().doc(appId).update({ interview, status: 'interview', statusChangedAt: t, updatedAt: t });
  // Acara lama baru dibatalkan setelah jadwal baru tersimpan: bila pembuatan gagal, undangan lama tetap berlaku
  // The old event is cancelled only after the new schedule is saved: if creation fails, the old invite still stands
  if (previous?.calendarEventId && previous.calendarEventId !== calendarEventId) {
    await cancelCalendarEvent(previous.calendarEventId).catch((e) => console.error('[karier] batal acara interview lama', e));
  }
  return {
    meetUrl: url,
    waLink: whatsAppLink(personal.phone, interviewMessage({ studentName: personal.fullName, jobTitle, partnerName, interview })),
  };
}

export async function listInterviews(actor: PartnerActor) {
  const snap = await apps().where('partnerId', '==', actor.partnerId).where('status', '==', 'interview')
    .select('number', 'jobId', 'personal.fullName', 'personal.phone', 'interview').get();
  return snap.docs
    .map((a) => {
      const { calendarEventId: _c, ...interview } = a.get('interview') as Interview;
      return { id: a.id, number: String(a.get('number') ?? ''), jobId: String(a.get('jobId')), fullName: String(a.get('personal.fullName') ?? ''), phone: String(a.get('personal.phone') ?? ''), interview };
    })
    .sort((a, b) => `${a.interview.date}${a.interview.start}`.localeCompare(`${b.interview.date}${b.interview.start}`));
}

export async function respondInterview(actor: Actor, appId: string, response: unknown, note: unknown): Promise<void> {
  const snap = await apps().doc(appId).get();
  if (!snap.exists || snap.get('studentId') !== actor.uid) throw new Error('Lamaran tidak ditemukan');
  if (snap.get('status') !== 'interview' || !snap.get('interview')) throw new Error('Belum ada undangan interview');
  if (response !== 'hadir' && response !== 'jadwal-ulang') throw new Error('Jawaban tidak dikenal');
  const text = String(note ?? '').trim().slice(0, 500);
  if (response === 'jadwal-ulang' && !text) throw new Error('Tulis alasan dan usulan waktu lain');
  await apps().doc(appId).update({
    'interview.confirmation': response, 'interview.rescheduleNote': response === 'jadwal-ulang' ? text : '', updatedAt: new Date().toISOString(),
  });
}
