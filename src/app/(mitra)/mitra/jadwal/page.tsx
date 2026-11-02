'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { alertBox, btn, btnSolid } from '@/app/(admin)/admin/pameran/admin-ui';
import { interviewTimeLabel, type Interview } from '@/features/careers/model';
import { box, h1, MitraShell, sub } from '../shell';

type Row = { id: string; number: string; fullName: string; phone: string; interview: Omit<Interview, 'calendarEventId'> };
const CONFIRM: Record<string, [string, string, string]> = {
  pending: ['Menunggu konfirmasi', '#F3F4F6', '#5b6b75'], hadir: ['Hadir', '#ECFDF3', '#067647'], 'jadwal-ulang': ['Minta jadwal ulang', '#FFF7E0', '#946200'],
};

/**
 * Jadwal interview: status konfirmasi kandidat, lalu hasil setelah interview.
 *
 * Interview schedule: each candidate's confirmation, then the result after the interview.
 */
export default function JadwalPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    fetch('/api/mitra/interviews').then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setRows(d.interviews); }).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function result(id: string, status: 'diterima' | 'tidak-lolos') {
    let rejectReason = '';
    if (status === 'tidak-lolos') {
      const r = window.prompt('Alasan internal (tidak dikirim ke siswa):', 'Skill belum sesuai');
      if (r === null) return;
      rejectReason = r;
    }
    const res = await fetch(`/api/mitra/candidates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, rejectReason }) });
    if (!res.ok) { setError((await res.json()).error); return; }
    load();
  }

  return (
    <MitraShell>
      <div><h1 style={h1}>Jadwal interview</h1><p style={sub}>Status konfirmasi dari kandidat, lalu isi hasil setelah interview.</p></div>
      {error && <div role="alert" style={alertBox}>{error}</div>}
      {rows && rows.length === 0 && <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Belum ada interview terjadwal.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {rows?.map((r) => {
          const { day, time } = interviewTimeLabel(r.interview);
          const [label, bg, fg] = CONFIRM[r.interview.confirmation] ?? CONFIRM.pending;
          return (
            <section key={r.id} style={{ ...box, display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                <b style={{ fontSize: '13px' }}>{r.fullName} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>· {r.number}</span></b>
                <span>{day}, {time} · {r.interview.mode === 'offline' ? 'Offline' : 'Online'}</span>
                {r.interview.mode === 'offline' ? <span>{r.interview.address}</span> : <a href={r.interview.url} target="_blank" rel="noopener noreferrer">{r.interview.url}</a>}
                <span style={{ alignSelf: 'flex-start', padding: '2px 8px', borderRadius: '6px', backgroundColor: bg, color: fg, fontWeight: 600 }}>{label}</span>
                {r.interview.rescheduleNote && <span style={{ color: 'var(--color-text-muted)' }}>Catatan kandidat: {r.interview.rescheduleNote}</span>}
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Link href={`/mitra/kandidat/${r.id}`} style={{ ...btn, textDecoration: 'none' }}>Jadwalkan ulang</Link>
                <button type="button" style={btnSolid} onClick={() => result(r.id, 'diterima')}>Diterima</button>
                <button type="button" style={{ ...btn, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }} onClick={() => result(r.id, 'tidak-lolos')}>Tidak diterima</button>
              </div>
            </section>
          );
        })}
      </div>
    </MitraShell>
  );
}
