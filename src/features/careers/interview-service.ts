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

  // Acara lama dibatalkan dulu agar siswa tidak menerima dua undangan; gagal batal tidak menahan jadwal baru
  // The old event is cancelled first so the student does not get two invites; a failed cancel does not block the new one
  const previous = snap.get('interview') as Interview | undefined;
  if (previous?.calendarEventId) {
    await cancelCalendarEvent(previous.calendarEventId).catch((e) => console.error('[karier] batal acara interview', e));
  }

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
    });
    if (!ev.meetUrl) throw new Error('Link Meet belum terbentuk. Coba lagi atau tempel link sendiri.');
    url = ev.meetUrl;
    calendarEventId = ev.eventId;
  }

  const t = now.toISOString();
  const interview: Interview = { ...input, url, confirmation: 'pending', rescheduleNote: '', calendarEventId, invitedAt: t };
  await apps().doc(appId).update({ interview, status: 'interview', statusChangedAt: t, updatedAt: t });
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
