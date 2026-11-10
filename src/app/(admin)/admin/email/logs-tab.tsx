'use client';

import React, { useMemo, useState } from 'react';
import { api, btn, field, label, send } from '../pameran/admin-ui';
import type { LogRow } from '@/features/email/service';
import { Badge, panel, sub, td, th, waktu } from './email-ui';

const SEMUA = '';

/**
 * Tab Sudah dikirim: riwayat semua email dengan saringan kelas, template, dan status.
 * Isi email diambil saat dibuka; email gagal bisa dikirim lagi dari sini.
 *
 * Sent tab: history of every email, filterable by class, template, and status.
 * The body is fetched when opened; failed emails can be resent from here.
 */
export function LogsTab({ logs, onChanged, onError }: { logs: LogRow[] | null; onChanged: () => void; onError: (m: string | null) => void }) {
  const [kelas, setKelas] = useState(SEMUA);
  const [template, setTemplate] = useState(SEMUA);
  const [status, setStatus] = useState(SEMUA);
  const [cari, setCari] = useState('');
  const [buka, setBuka] = useState<{ id: string; body: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const opsi = useMemo(() => ({
    kelas: [...new Set((logs ?? []).map((l) => l.className))].sort(),
    template: [...new Map((logs ?? []).map((l) => [l.templateId, l.templateName])).entries()],
  }), [logs]);
  const q = cari.trim().toLowerCase();
  const rows = (logs ?? []).filter((l) => (!kelas || l.className === kelas) && (!template || l.templateId === template) && (!status || l.status === status)
    && (!q || l.studentName.toLowerCase().includes(q) || l.email.toLowerCase().includes(q)));

  async function lihat(id: string) {
    if (buka?.id === id) { setBuka(null); return; }
    try { setBuka({ id, body: (await api(`/api/email/logs/${id}`)).body }); } catch (e) { onError((e as Error).message); }
  }

  async function ulang(l: LogRow) {
    if (!window.confirm(`Kirim lagi "${l.templateName}" ke ${l.studentName}?`)) return;
    setBusy(l.id); onError(null);
    try {
      const r = await send('/api/email/send', 'POST', { templateId: l.templateId, studentIds: [l.studentId] });
      if (r.failed) onError('Masih gagal terkirim. Lihat keterangan di baris terbaru.');
      onChanged();
    } catch (e) { onError((e as Error).message); } finally { setBusy(null); }
  }

  if (!logs) return <div style={sub}>Memuat riwayat…</div>;
  const gagal = rows.filter((l) => l.status === 'gagal').length;

  return (
    <div style={panel}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
        <label style={label}>Kelas<select style={field} value={kelas} onChange={(e) => setKelas(e.target.value)}><option value={SEMUA}>Semua kelas</option>{opsi.kelas.map((k) => <option key={k}>{k}</option>)}</select></label>
        <label style={label}>Template<select style={field} value={template} onChange={(e) => setTemplate(e.target.value)}><option value={SEMUA}>Semua template</option>{opsi.template.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
        <label style={label}>Status<select style={field} value={status} onChange={(e) => setStatus(e.target.value)}><option value={SEMUA}>Semua status</option><option value="terkirim">Terkirim</option><option value="gagal">Gagal</option></select></label>
        <label style={label}>Cari peserta<input style={field} value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Nama atau email" /></label>
      </div>
      <div style={sub}>{rows.length} email · {rows.length - gagal} terkirim · {gagal} gagal</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th}>Waktu</th><th style={th}>Penerima</th><th style={th}>Kelas</th><th style={th}>Template</th><th style={th}>Subjek</th><th style={th}>Status</th><th style={th}>Pengirim</th><th style={th} aria-label="Aksi" />
          </tr></thead>
          <tbody>
            {rows.map((l) => (
              <React.Fragment key={l.id}>
                <tr>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{waktu(l.sentAt)}</td>
                  <td style={td}><div style={{ fontWeight: 600 }}>{l.studentName}</div><div style={sub}>{l.email}</div></td>
                  <td style={td}>{l.className}</td>
                  <td style={td}>{l.templateName}</td>
                  <td style={{ ...td, maxWidth: '240px' }}>{l.subject}</td>
                  <td style={td}>
                    <Badge category={l.status === 'terkirim' ? 'lulus-magang' : 'tidak-lulus'}>{l.status === 'terkirim' ? 'Terkirim' : 'Gagal'}</Badge>
                    {l.error && <div style={{ ...sub, color: '#B42318', maxWidth: '200px' }}>{l.error}</div>}
                  </td>
                  <td style={td}>{l.sentBy}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button type="button" style={{ ...btn, padding: '4px 8px' }} onClick={() => lihat(l.id)}>{buka?.id === l.id ? 'Tutup' : 'Lihat isi'}</button>{' '}
                    {l.status === 'gagal' && <button type="button" style={{ ...btn, padding: '4px 8px' }} disabled={busy === l.id} onClick={() => ulang(l)}>{busy === l.id ? 'Mengirim…' : 'Kirim lagi'}</button>}
                  </td>
                </tr>
                {buka?.id === l.id && (
                  <tr><td style={{ ...td, backgroundColor: '#F8FAFC' }} colSpan={8}><div style={{ whiteSpace: 'pre-wrap', fontSize: '11px', lineHeight: 1.55 }}>{buka.body}</div></td></tr>
                )}
              </React.Fragment>
            ))}
            {rows.length === 0 && <tr><td style={td} colSpan={8}><span style={sub}>Belum ada email.</span></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
