'use client';

import React, { useState } from 'react';
import { interviewTimeLabel, type Interview } from '@/features/careers/model';
import { BLUE, btnOutline, btnPrimary, errorBox, getJson, input, LINE, MUTED } from './ui';

/**
 * Kartu undangan interview di Lamaran Saya: rincian jadwal dan jawaban siswa (hadir atau minta jadwal ulang).
 *
 * The interview invitation card in Lamaran Saya: schedule details and the student's reply (attend or reschedule).
 */
export function InterviewCard({ appId, partnerName, interview, picWaLink }: { appId: string; partnerName: string; interview: Omit<Interview, 'calendarEventId'>; picWaLink?: string | null }) {
  const [state, setState] = useState(interview.confirmation);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { day, time } = interviewTimeLabel(interview);

  async function reply(response: 'hadir' | 'jadwal-ulang') {
    setError(null);
    try {
      await getJson(`/api/karier/lamaran/${appId}/konfirmasi`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response, note }) });
      setState(response); setAsking(false);
    } catch (e) { setError((e as Error).message); }
  }

  const rows: [string, React.ReactNode][] = [
    ['Tanggal', day], ['Waktu', time],
    ['Mode', interview.mode === 'offline' ? 'Offline · di kantor' : 'Online'],
    interview.mode === 'offline' ? ['Alamat', interview.address] : ['Link', <a key="l" href={interview.url} target="_blank" rel="noopener noreferrer" style={{ color: BLUE, wordBreak: 'break-all' }}>{interview.url}</a>],
    ['Pewawancara', interview.interviewer],
  ];
  const pic = interview.contact;
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: '10px', padding: '14px', backgroundColor: '#F8FBFE', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <b style={{ fontSize: '14px' }}>Undangan interview dari {partnerName}</b>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '110px 1fr', gap: '4px 10px', fontSize: '13px' }}>
        {rows.map(([k, v]) => <React.Fragment key={k}><dt style={{ color: MUTED }}>{k}</dt><dd style={{ margin: 0 }}>{v}</dd></React.Fragment>)}
      </dl>
      {interview.note && <p style={{ margin: 0, fontSize: '13px' }}>Catatan: {interview.note}</p>}
      {pic && (
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
          <span>Butuh jadwal ulang atau ada pertanyaan? Hubungi PIC <b>{pic.name}</b>:</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {picWaLink && <a href={picWaLink} target="_blank" rel="noopener noreferrer" style={{ ...btnPrimary, backgroundColor: '#25D366' }}>WhatsApp PIC</a>}
            {pic.email && <a href={`mailto:${pic.email}`} style={btnOutline}>Email {pic.email}</a>}
          </div>
        </div>
      )}
      {error && <div role="alert" style={errorBox}>{error}</div>}
      {state === 'hadir' ? (
        <p style={{ margin: 0, fontSize: '13px', color: '#067647', fontWeight: 600 }}>Kamu sudah konfirmasi hadir. PIC sudah diberi tahu.</p>
      ) : state === 'jadwal-ulang' && !asking ? (
        <p style={{ margin: 0, fontSize: '13px', color: '#946200', fontWeight: 600 }}>Permintaan jadwal ulang terkirim ke PIC. Jadwal baru akan muncul di sini dan di emailmu.</p>
      ) : asking ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '6px' }}>Alasan dan usulan waktu lain
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} style={input} placeholder="mis. ada ujian sekolah, bisa Jumat 13.00?" />
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" style={btnOutline} onClick={() => setAsking(false)}>Batal</button>
            <button type="button" style={btnPrimary} onClick={() => reply('jadwal-ulang')}>Kirim ke PIC</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={btnPrimary} onClick={() => reply('hadir')}>Konfirmasi hadir</button>
          <button type="button" style={btnOutline} onClick={() => setAsking(true)}>Minta jadwal ulang</button>
        </div>
      )}
    </div>
  );
}
