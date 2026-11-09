'use client';

import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { alertBox, btn, btnSolid, field, label } from '@/app/(admin)/admin/pameran/admin-ui';
import type { InterviewInput } from '@/features/careers/model';

const radioRow: React.CSSProperties = { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', fontWeight: 400 };

/**
 * Formulir undangan interview untuk PIC. Setelah terkirim, tombol WhatsApp membuka chat ke pelamar
 * dengan pesan yang sudah tersusun; PIC tinggal menekan kirim dari nomornya sendiri.
 *
 * Interview invitation form for PICs. Once sent, the WhatsApp button opens a chat to the applicant with
 * the message already composed; the PIC only presses send from their own number.
 */
export function InviteForm({ appId, defaultInterviewer, initial, onSent }: {
  appId: string; defaultInterviewer: string; initial?: Partial<InterviewInput>; onSent?: () => void;
}) {
  const [v, setV] = useState<InterviewInput>({
    date: '', start: '10:00', durationMin: 45, linkSource: 'meet-auto', url: '', address: '', interviewer: defaultInterviewer, note: '',
    ...initial,
    // Undangan lama yang luring dijadwalkan ulang sebagai daring / An older offline invite is rescheduled as online
    mode: 'online',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ waLink: string | null; meetUrl: string } | null>(null);
  const set = (patch: Partial<InterviewInput>) => setV({ ...v, ...patch });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/mitra/candidates/${appId}/interview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Undangan gagal dikirim');
      setDone(data);
      onSent?.();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <b style={{ fontSize: '13px', color: '#067647' }}>Undangan tersimpan. Kandidat melihatnya di aplikasi{v.linkSource === 'meet-auto' ? ' dan menerima undangan Google Calendar' : ''}.</b>
        {done.meetUrl && <span style={{ fontSize: '12px' }}>Link: <a href={done.meetUrl} target="_blank" rel="noopener noreferrer">{done.meetUrl}</a></span>}
        {done.waLink ? (
          <a href={done.waLink} target="_blank" rel="noopener noreferrer" style={{ ...btnSolid, backgroundColor: '#25D366', borderColor: '#25D366', textDecoration: 'none', alignSelf: 'flex-start', display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
            <MessageCircle size={14} aria-hidden /> Kirim lewat WhatsApp
          </a>
        ) : <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Nomor WhatsApp pelamar tidak terbaca; hubungi lewat email.</span>}
        <button type="button" style={{ ...btn, alignSelf: 'flex-start' }} onClick={() => setDone(null)}>Ubah jadwal</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {error && <div role="alert" style={alertBox}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        <label style={label}>Tanggal<input type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} style={field} required /></label>
        <label style={label}>Jam mulai (WIB)<input type="time" value={v.start} onChange={(e) => set({ start: e.target.value })} style={field} required /></label>
        <label style={label}>Durasi
          <select value={v.durationMin} onChange={(e) => set({ durationMin: Number(e.target.value) as 30 | 45 | 60 })} style={field}>
            {[30, 45, 60].map((m) => <option key={m} value={m}>{m} menit</option>)}
          </select>
        </label>
      </div>
      <>
          <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <legend style={{ ...label, marginBottom: '6px' }}>Link meeting</legend>
            <label style={radioRow}><input type="radio" name="link" checked={v.linkSource === 'meet-auto'} onChange={() => set({ linkSource: 'meet-auto' })} /> Buat link Google Meet otomatis</label>
            <label style={radioRow}><input type="radio" name="link" checked={v.linkSource === 'manual'} onChange={() => set({ linkSource: 'manual' })} aria-label="Pakai link sendiri" /> Pakai link sendiri (Zoom, Teams, Meet)</label>
          </fieldset>
          {v.linkSource === 'manual' && (
            <label style={label}>Link meeting<input value={v.url} onChange={(e) => set({ url: e.target.value })} style={field} placeholder="https://zoom.us/j/…" required /></label>
          )}
      </>
      <label style={label}>Pewawancara<input value={v.interviewer} onChange={(e) => set({ interviewer: e.target.value })} style={field} required /></label>
      <label style={label}>Catatan untuk kandidat<textarea rows={2} value={v.note} onChange={(e) => set({ note: e.target.value })} style={field} placeholder="mis. siapkan portofolio untuk dipresentasikan 10 menit" /></label>
      <button type="submit" style={{ ...btnSolid, alignSelf: 'flex-start' }} disabled={busy}>{busy ? 'Mengirim…' : 'Kirim undangan'}</button>
    </form>
  );
}
