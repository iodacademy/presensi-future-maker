'use client';

import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { api, btn, field } from '../pameran/admin-ui';
import type { InsightStudent, PortalInsights } from '@/features/careers/insights';
import { APPLICATION_STATUS_LABELS, SCHEME_LABELS } from '@/features/careers/model';
import { AppLine } from './insights-panel';

type Status = 'belum' | 'melamar' | 'keterima';
type Filter = 'semua' | Status | 'belum-dokumen';
type Place = { label: string; waiting: boolean };

const muted: React.CSSProperties = { fontSize: '11px', color: 'var(--color-text-muted)' };
const th: React.CSSProperties = { textAlign: 'left', padding: '9px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '9px 10px', fontSize: '12px', borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' };
const TONE: Record<Status, { label: string; bg: string; fg: string }> = {
  belum: { label: 'Belum melamar', bg: '#FEF3F2', fg: '#B42318' },
  melamar: { label: 'Belum keterima', bg: '#E6F1FB', fg: '#0072CE' },
  keterima: { label: 'Sudah keterima', bg: '#ECFDF3', fg: '#067647' },
};
const when = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });
const labelled = (l: string, el: React.ReactNode) => <label style={{ ...muted, display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 600 }}>{l}{el}</label>;

/**
 * Tracking peserta: siapa yang belum melamar, yang melamar tapi belum keterima
 * (di mana saja dan statusnya), dan yang sudah keterima beserta tempatnya.
 * Bisa disaring per kelas, perusahaan, dan skema magang.
 *
 * Participant tracking: who has not applied, who applied but is not accepted yet
 * (where and with what status), and who is accepted and where. Filterable by
 * class, company, and internship scheme.
 */
export function TrackingTab({ onError }: { onError: (m: string) => void }) {
  const [data, setData] = useState<PortalInsights | null>(null);
  const [kelas, setKelas] = useState('');
  const [company, setCompany] = useState('');
  const [scheme, setScheme] = useState('');
  const [filter, setFilter] = useState<Filter>('semua');
  const [q, setQ] = useState('');

  useEffect(() => {
    api('/api/karier/insights').then((d) => setData(d.insights)).catch((e) => onError((e as Error).message));
  }, [onError]);

  const jobById = useMemo(() => new Map((data?.jobs ?? []).map((j) => [j.id, j])), [data]);
  const classes = useMemo(() => [...new Set((data?.students ?? []).map((s) => s.className))].sort(), [data]);
  const companies = useMemo(() => [...new Set([
    ...(data?.jobs ?? []).map((j) => j.partnerName),
    ...(data?.students ?? []).flatMap((s) => (s.placedAt ? [s.placedAt.partnerName] : [])),
  ])].sort(), [data]);

  // Keterima = penempatan mitra, tawaran yang sudah diterima peserta, atau lolos tapi belum dikonfirmasi peserta
  // Accepted = a partner placement, an offer the participant accepted, or passed but not yet confirmed by the participant
  const placesOf = (s: InsightStudent): Place[] => [
    ...(s.placedAt ? [{ label: `${s.placedAt.position} · ${s.placedAt.partnerName}`, waiting: false }] : []),
    ...s.apps.filter((a) => a.status === 'bergabung' || a.status === 'diterima').flatMap((a) => {
      const job = jobById.get(a.jobId);
      return job ? [{ label: `${job.title} · ${job.partnerName}`, waiting: a.status === 'diterima' }] : [];
    }),
  ];
  const statusOf = (s: InsightStudent): Status => (placesOf(s).length ? 'keterima' : s.apps.length ? 'melamar' : 'belum');
  const atCompany = (s: InsightStudent) => s.placedAt?.partnerName === company || s.apps.some((a) => jobById.get(a.jobId)?.partnerName === company);

  if (!data) return <div style={muted}>Memuat tracking peserta…</div>;

  const scoped = data.students.filter((s) => (!kelas || s.className === kelas) && (!scheme || s.placement === scheme) && (!company || atCompany(s)));
  const count = (f: Filter) => scoped.filter((s) => match(s, f)).length;
  function match(s: InsightStudent, f: Filter) {
    if (f === 'semua') return true;
    // LoA baru bisa ada setelah penempatan pasti, bukan saat masih menunggu konfirmasi / An LoA only exists once placement is confirmed, not while awaiting confirmation
    if (f === 'belum-dokumen') return placesOf(s).some((p) => !p.waiting) && !s.acceptanceDoc;
    return statusOf(s) === f;
  }
  const needle = q.trim().toLowerCase();
  const rows = scoped
    .filter((s) => match(s, filter) && (!needle || s.name.toLowerCase().includes(needle)))
    .sort((a, b) => a.name.localeCompare(b.name));
  // Excel memuat baris yang sedang tampil, jadi filter di layar = isi berkas / The sheet holds the rows on screen, so the screen filter is the file's content
  function download() {
    const sheet = rows.map((s) => {
      const places = placesOf(s);
      const confirmed = places.some((p) => !p.waiting);
      return {
        'Nama peserta': s.name, Kelas: s.className, Skema: SCHEME_LABELS[s.placement], Status: TONE[statusOf(s)].label,
        'Keterima di': places.map((p) => (p.waiting ? `${p.label} (menunggu konfirmasi peserta)` : p.label)).join('\n'),
        'Jumlah lamaran': s.apps.length,
        Lamaran: s.apps.map((a) => {
          const job = jobById.get(a.jobId);
          return `${job ? `${job.title} · ${job.partnerName}` : 'Lowongan'}: ${a.completedAt ? 'Proyek selesai' : APPLICATION_STATUS_LABELS[a.status]}`;
        }).join('\n'),
        'Dokumen LoA/kontrak': confirmed ? (s.acceptanceDoc ? 'Sudah' : 'Belum') : '-',
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), 'Tracking peserta');
    XLSX.writeFile(wb, `Tracking_peserta_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
  const chips: [Filter, string][] = [['semua', 'Semua'], ['belum', 'Belum melamar'], ['melamar', 'Melamar, belum keterima'], ['keterima', 'Sudah keterima'], ['belum-dokumen', 'Belum unggah dokumen']];

  return (
    <section aria-label="Tracking peserta" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {labelled('Kelas', <select value={kelas} onChange={(e) => setKelas(e.target.value)} style={{ ...field, width: 'auto', minWidth: '240px' }}>
          <option value="">Semua kelas</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>)}
        {labelled('Perusahaan', <select value={company} onChange={(e) => setCompany(e.target.value)} style={{ ...field, width: 'auto', minWidth: '220px' }}>
          <option value="">Semua perusahaan</option>
          {companies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>)}
        {labelled('Skema', <select value={scheme} onChange={(e) => setScheme(e.target.value)} style={{ ...field, width: 'auto' }}>
          <option value="">Semua skema</option>
          {Object.entries(SCHEME_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>)}
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama peserta" aria-label="Cari nama peserta" style={{ ...field, maxWidth: '240px' }} />
        <button type="button" style={btn} onClick={download} disabled={rows.length === 0}>{`Unduh Excel (${rows.length})`}</button>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {chips.map(([f, l]) => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
            style={{ padding: '6px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: filter === f ? 700 : 500, backgroundColor: filter === f ? 'var(--color-primary)' : 'var(--color-border)', color: filter === f ? '#ffffff' : 'var(--color-text-main)' }}>
            {`${l} (${count(f)})`}
          </button>
        ))}
      </div>
      <div style={muted}>Peserta yang berhak magang (Full Internship atau Project Based di dashboard). Filter perusahaan menampilkan peserta yang melamar atau ditempatkan di perusahaan itu.</div>
      <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
          <thead><tr><th style={th}>Peserta</th><th style={th}>Status</th><th style={th}>Lamaran</th><th style={th}>Keterima di</th></tr></thead>
          <tbody>
            {rows.map((s) => {
              const st = statusOf(s);
              const places = placesOf(s);
              return (
                <tr key={s.studentId}>
                  <td style={td}><div style={{ fontWeight: 600 }}>{s.name}</div><div style={muted}>{SCHEME_LABELS[s.placement]}</div>{!kelas && <div style={muted}>{s.className}</div>}</td>
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
                    {places.length ? (
                      <>
                        {places.map((p) => (
                          <div key={p.label} style={{ padding: '2px 0' }}>
                            <div style={{ fontWeight: 600 }}>{p.label}</div>
                            {p.waiting && <div style={{ fontSize: '11px', fontWeight: 700, color: '#B54708' }}>Menunggu konfirmasi peserta</div>}
                          </div>
                        ))}
                        {places.every((p) => p.waiting) ? null : s.acceptanceDoc
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
