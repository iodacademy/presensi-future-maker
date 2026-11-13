'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { api, field } from '../pameran/admin-ui';
import type { InsightStudent, PortalInsights } from '@/features/careers/insights';
import { SCHEME_LABELS } from '@/features/careers/model';
import { AppLine } from './insights-panel';

type Status = 'belum' | 'melamar' | 'ditempatkan';
type Filter = 'semua' | Status | 'belum-dokumen';

const muted: React.CSSProperties = { fontSize: '11px', color: 'var(--color-text-muted)' };
const th: React.CSSProperties = { textAlign: 'left', padding: '9px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '9px 10px', fontSize: '12px', borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' };
const TONE: Record<Status, { label: string; bg: string; fg: string }> = {
  belum: { label: 'Belum melamar', bg: '#FEF3F2', fg: '#B42318' },
  melamar: { label: 'Sudah melamar', bg: '#E6F1FB', fg: '#0072CE' },
  ditempatkan: { label: 'Ditempatkan', bg: '#ECFDF3', fg: '#067647' },
};
const when = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });

/**
 * Tracking peserta per kelas: siapa yang belum melamar, sudah melamar (di mana
 * dan statusnya), dan sudah ditempatkan beserta dokumen penerimaannya.
 *
 * Participant tracking per class: who has not applied, who has (where and with
 * what status), and who is placed, with their acceptance document.
 */
export function TrackingTab({ onError }: { onError: (m: string) => void }) {
  const [data, setData] = useState<PortalInsights | null>(null);
  const [kelas, setKelas] = useState('');
  const [filter, setFilter] = useState<Filter>('semua');
  const [q, setQ] = useState('');

  useEffect(() => {
    api('/api/karier/insights').then((d) => setData(d.insights)).catch((e) => onError((e as Error).message));
  }, [onError]);

  const jobById = useMemo(() => new Map((data?.jobs ?? []).map((j) => [j.id, j])), [data]);
  const classes = useMemo(() => [...new Set((data?.students ?? []).map((s) => s.className))].sort(), [data]);
  useEffect(() => { if (!kelas && classes.length) setKelas(classes[0]); }, [classes, kelas]);

  // Tempat magang: dari penempatan mitra, atau dari tawaran yang diterima lewat portal
  // The internship: from a partner placement, or from an offer accepted through the portal
  const placeOf = (s: InsightStudent): string | null => {
    if (s.placedAt) return `${s.placedAt.position} · ${s.placedAt.partnerName}`;
    const joined = s.apps.find((a) => a.status === 'bergabung');
    const job = joined ? jobById.get(joined.jobId) : undefined;
    return job ? `${job.title} · ${job.partnerName}` : null;
  };
  const statusOf = (s: InsightStudent): Status => (placeOf(s) ? 'ditempatkan' : s.apps.length ? 'melamar' : 'belum');

  if (!data) return <div style={muted}>Memuat tracking peserta…</div>;

  const inClass = data.students.filter((s) => s.className === kelas);
  const count = (f: Filter) => inClass.filter((s) => match(s, f)).length;
  function match(s: InsightStudent, f: Filter) {
    if (f === 'semua') return true;
    if (f === 'belum-dokumen') return statusOf(s) === 'ditempatkan' && !s.acceptanceDoc;
    return statusOf(s) === f;
  }
  const needle = q.trim().toLowerCase();
  const rows = inClass
    .filter((s) => match(s, filter) && (!needle || s.name.toLowerCase().includes(needle)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const chips: [Filter, string][] = [['semua', 'Semua'], ['belum', 'Belum melamar'], ['melamar', 'Sudah melamar'], ['ditempatkan', 'Ditempatkan'], ['belum-dokumen', 'Belum unggah dokumen']];

  return (
    <section aria-label="Tracking peserta" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ ...muted, display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 600 }}>Kelas
          <select value={kelas} onChange={(e) => setKelas(e.target.value)} style={{ ...field, width: 'auto', minWidth: '260px' }}>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama peserta" aria-label="Cari nama peserta" style={{ ...field, maxWidth: '260px' }} />
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {chips.map(([f, l]) => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
            style={{ padding: '6px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: filter === f ? 700 : 500, backgroundColor: filter === f ? 'var(--color-primary)' : 'var(--color-border)', color: filter === f ? '#ffffff' : 'var(--color-text-main)' }}>
            {`${l} (${count(f)})`}
          </button>
        ))}
      </div>
      <div style={muted}>Peserta yang berhak magang (Full Internship atau Project Based di dashboard).</div>
      <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
          <thead><tr><th style={th}>Peserta</th><th style={th}>Status</th><th style={th}>Lamaran</th><th style={th}>Penempatan</th></tr></thead>
          <tbody>
            {rows.map((s) => {
              const st = statusOf(s);
              const place = placeOf(s);
              return (
                <tr key={s.studentId}>
                  <td style={td}><div style={{ fontWeight: 600 }}>{s.name}</div><div style={muted}>{SCHEME_LABELS[s.placement]}</div></td>
                  <td style={td}><span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: TONE[st].bg, color: TONE[st].fg, whiteSpace: 'nowrap' }}>{TONE[st].label}</span></td>
                  <td style={{ ...td, minWidth: '300px' }}>
                    {s.apps.length === 0 ? <span style={muted}>Belum ada lamaran</span> : (
                      <>
                        <div style={{ ...muted, fontWeight: 700 }}>{s.apps.length} lamaran</div>
                        {s.apps.map((a) => <AppLine key={a.id} app={a} job={jobById.get(a.jobId)} />)}
                      </>
                    )}
                  </td>
                  <td style={td}>
                    {place ? (
                      <>
                        <div style={{ fontWeight: 600 }}>{place}</div>
                        {s.acceptanceDoc
                          ? <div style={muted}><a href={`/api/karier/cv/${s.acceptanceDoc.id}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>Lihat dokumen</a> · {when(s.acceptanceDoc.uploadedAt)}</div>
                          : <div style={{ fontSize: '11px', fontWeight: 700, color: '#B42318' }}>Belum unggah LoA/kontrak</div>}
                      </>
                    ) : <span style={muted}>-</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td style={td} colSpan={4}><span style={muted}>Tidak ada peserta.</span></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
