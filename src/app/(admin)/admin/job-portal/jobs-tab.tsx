'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { api, btn, btnSolid, field, send } from '../pameran/admin-ui';
import type { ExportRow } from '@/features/careers/export-service';
import type { JobRow } from '@/features/careers/admin-service';
import { countdownParts, EMPLOYMENT_LABELS, formatCountdown, interviewTimeLabel, jobState, SCHEME_LABELS, type JobState } from '@/features/careers/model';

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
  const [company, setCompany] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
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
  const companies = [...new Set(rows.map((r) => r.partnerName))].sort();
  const shown = rows.filter((r) => (!company || r.partnerName === company)
    && (!needle || `${r.title} ${r.partnerName} ${r.picName} ${r.scheme ? SCHEME_LABELS[r.scheme] : ''}`.toLowerCase().includes(needle)));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShown = shown.length > 0 && shown.every((r) => picked.has(r.id));
  const toggleShown = () => setPicked((p) => {
    const n = new Set(p);
    shown.forEach((r) => (allShown ? n.delete(r.id) : n.add(r.id)));
    return n;
  });

  // Satu tabel untuk semua lowongan terpilih; urutan id mengikuti urutan pilihan / One table for every picked job; ids follow the picking order
  async function exportPicked() {
    setExporting(true);
    try {
      const { rows: data } = (await api(`/api/karier/export?jobs=${[...picked].join(',')}`)) as { rows: ExportRow[] };
      const sheet = data.map((r) => {
        const iv = r.interview ? interviewTimeLabel({ date: r.interview.date, start: r.interview.start, durationMin: r.interview.durationMin as 30 | 45 | 60 }) : null;
        return {
          Nama: r.name, Email: r.email, 'Nilai capstone': r.capstone ?? 'Belum dinilai',
          CV: r.cvId ? `${window.location.origin}/api/karier/cv/${r.cvId}` : '',
          Role: r.role, Perusahaan: r.company, 'Tanggal interview': iv ? `${iv.day}, ${iv.time}` : '',
        };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), 'Pelamar');
      XLSX.writeFile(wb, `Pelamar_${picked.size}_lowongan.xlsx`);
    } catch (e) { onError((e as Error).message); } finally { setExporting(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari lowongan" placeholder="Cari posisi, perusahaan, atau PIC"
        style={{ ...field, maxWidth: '320px' }} />
      <select value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Perusahaan" style={{ ...field, width: 'auto', maxWidth: '320px' }}>
        <option value="">Semua perusahaan</option>
        {companies.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button type="button" style={btnSolid} disabled={picked.size === 0 || exporting} onClick={exportPicked}>
        {exporting ? 'Menyiapkan…' : `Ekspor pelamar (${picked.size} lowongan)`}
      </button>
      {picked.size > 0 && <button type="button" style={btn} onClick={() => setPicked(new Set())}>Kosongkan pilihan</button>}
    </div>
    <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
        <thead>
          <tr><th style={{ ...th, width: '32px' }}><input type="checkbox" checked={allShown} onChange={toggleShown} aria-label="Pilih semua lowongan yang tampil" /></th><th style={th}>Posisi</th><th style={th}>Perusahaan → PIC</th><th style={th}>Tutup dalam</th><th style={th}>Kuota</th><th style={th}>Pelamar</th><th style={th}>Status</th><th style={th} aria-label="Aksi" /></tr>
        </thead>
        <tbody>
          {shown.length === 0 && <tr><td style={td} colSpan={8}><span style={{ color: 'var(--color-text-muted)' }}>Tidak ada lowongan yang cocok.</span></td></tr>}
          {shown.map((r) => {
            const state = jobState(r, now);
            const parts = countdownParts(r.closesAt, now);
            const urgent = !parts.ended && parts.days === 0;
            const s = STATE_STYLE[state];
            return (
              <tr key={r.id} style={{ backgroundColor: picked.has(r.id) ? '#F5F9FE' : undefined }}>
                <td style={td}><input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Pilih ${r.title}`} /></td>
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
