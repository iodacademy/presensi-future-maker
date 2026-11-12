'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { btn, field, send } from '../pameran/admin-ui';
import type { JobRow } from '@/features/careers/admin-service';
import { countdownParts, EMPLOYMENT_LABELS, formatCountdown, jobState, SCHEME_LABELS, type JobState } from '@/features/careers/model';

const STATE_STYLE: Record<JobState, { label: string; bg: string; fg: string }> = {
  draft: { label: 'Draf', bg: '#f3f4f6', fg: '#5b6b75' },
  terjadwal: { label: 'Terjadwal', bg: '#E6F1FB', fg: '#0072CE' },
  aktif: { label: 'Aktif', bg: '#ECFDF3', fg: '#067647' },
  ditutup: { label: 'Ditutup', bg: '#f3f4f6', fg: '#5b6b75' },
};

const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' };
const td: React.CSSProperties = { padding: '10px 12px', fontSize: '12px', borderBottom: '1px solid var(--color-border)', verticalAlign: 'middle' };

/**
 * Tabel lowongan dengan hitung mundur yang diperbarui tiap detik.
 *
 * Job table with a countdown refreshed every second.
 */
export function JobsTab({ rows, onEdit, onChanged, onError }: {
  rows: JobRow[]; onEdit: (id: string) => void; onChanged: () => void; onError: (m: string) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const [q, setQ] = useState('');
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  async function remove(r: JobRow) {
    if (!window.confirm(`Hapus lowongan "${r.title}"?`)) return;
    try { await send(`/api/karier/jobs/${r.id}`, 'DELETE', {}); onChanged(); } catch (e) { onError((e as Error).message); }
  }

  // Lowongan demo fiktif tidak menambah kursi magang sungguhan / Fictitious demo jobs add no real internship seats
  const real = rows.filter((r) => !r.demo);

  if (rows.length === 0) {
    return <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Belum ada lowongan. Tambahkan mitra, lalu tekan "+ Tambah lowongan".</p>;
  }

  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => !needle || `${r.title} ${r.partnerName} ${r.picName} ${r.scheme ? SCHEME_LABELS[r.scheme] : ''}`.toLowerCase().includes(needle));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari lowongan" placeholder="Cari posisi, perusahaan, atau PIC"
      style={{ ...field, maxWidth: '360px' }} />
    <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
        <thead>
          <tr><th style={th}>Posisi</th><th style={th}>Perusahaan → PIC</th><th style={th}>Tutup dalam</th><th style={th}>Kuota</th><th style={th}>Pelamar</th><th style={th}>Status</th><th style={th} aria-label="Aksi" /></tr>
        </thead>
        <tbody>
          {shown.length === 0 && <tr><td style={td} colSpan={7}><span style={{ color: 'var(--color-text-muted)' }}>Tidak ada lowongan yang cocok.</span></td></tr>}
          {shown.map((r) => {
            const state = jobState(r, now);
            const parts = countdownParts(r.closesAt, now);
            const urgent = !parts.ended && parts.days === 0;
            const s = STATE_STYLE[state];
            return (
              <tr key={r.id}>
                <td style={td}><div style={{ fontWeight: 600 }}>{r.title}</div><div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{EMPLOYMENT_LABELS[r.employment]}{r.scheme ? ` · ${SCHEME_LABELS[r.scheme]}` : ''}</div></td>
                <td style={td}><div style={{ fontWeight: 600 }}>{r.partnerName}</div><div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{r.picName || '–'}</div></td>
                <td style={td}>
                  <span style={{ padding: '2px 8px', borderRadius: '6px', fontVariantNumeric: 'tabular-nums', backgroundColor: urgent ? '#FDECEA' : '#E6F1FB', color: urgent ? '#B42318' : '#0072CE' }}>
                    {formatCountdown(parts)}
                  </span>
                </td>
                <td style={td}>{r.quota}</td>
                <td style={td}>{r.applicantCount}</td>
                <td style={td}><span style={{ padding: '2px 8px', borderRadius: '6px', fontWeight: 600, backgroundColor: s.bg, color: s.fg }}>{s.label}</span></td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <Link href={`/admin/job-portal/${r.id}`} style={{ ...btn, textDecoration: 'none', marginRight: '6px' }}>Lihat pelamar</Link>
                  <button type="button" style={btn} onClick={() => onEdit(r.id)}>Ubah</button>
                  {r.applicantCount === 0 && (
                    <button type="button" style={{ ...btn, marginLeft: '6px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }} onClick={() => remove(r)}>Hapus</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, borderTop: '1px solid var(--color-border)', backgroundColor: '#F8FBFE' }}>
        {`Total kuota: ${real.reduce((n, r) => n + (r.quota || 0), 0)} kursi dari ${real.length} lowongan`}
        <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}> · lowongan demo tidak dihitung</span>
      </div>
    </div>
    </div>
  );
}
