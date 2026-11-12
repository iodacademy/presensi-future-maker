'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { alertBox, btn, field } from '@/app/(admin)/admin/pameran/admin-ui';
import type { ApplicantRow } from '@/features/careers/applicants-service';
import { APPLICATION_STATUS_LABELS, SCHEME_LABELS, type ApplicationStatus, type Scheme } from '@/features/careers/model';
import { h1, MitraShell, sub, when } from '../shell';

const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' };
const td: React.CSSProperties = { padding: '10px 12px', fontSize: '12px', borderBottom: '1px solid var(--color-border)' };
const TABS = Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[];

/**
 * Daftar kandidat per lowongan, dikelompokkan menurut status seleksi.
 *
 * Candidates per job, grouped by selection status.
 */
export default function KandidatPage() {
  const [jobs, setJobs] = useState<{ id: string; title: string; quota?: number; scheme?: Scheme; applicantCount?: number }[]>([]);
  const [job, setJob] = useState('');
  const [tab, setTab] = useState<ApplicationStatus>('baru');
  const [rows, setRows] = useState<ApplicantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/mitra/dashboard').then((r) => r.json()).then((d) => {
      setJobs(d.jobs ?? []);
      const fromUrl = new URLSearchParams(window.location.search).get('job');
      setJob(fromUrl && d.jobs?.some((j: { id: string }) => j.id === fromUrl) ? fromUrl : d.jobs?.[0]?.id ?? '');
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!job) return;
    window.history.replaceState(null, '', `/mitra/kandidat?job=${job}`);
    setRows(null);
    fetch(`/api/mitra/jobs/${job}/candidates`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setRows(d.candidates); }).catch((e) => setError(e.message));
  }, [job]);

  const shown = (rows ?? []).filter((r) => r.status === tab);
  const current = jobs.find((j) => j.id === job);
  // Kursi terisi: kandidat yang sudah diloloskan atau sudah menerima tawaran / Filled seats: candidates passed or who accepted the offer
  const filled = (rows ?? []).filter((r) => r.status === 'diterima' || r.status === 'bergabung').length;
  const chip: React.CSSProperties = { fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px', backgroundColor: '#ffffff', border: '1px solid var(--color-border)', color: 'var(--color-text-main)' };
  return (
    <MitraShell>
      <div><h1 style={h1}>Kandidat</h1><p style={sub}>Buka "Review CV" untuk melihat lamaran lengkap dan memutuskan tahap berikutnya.</p></div>
      {error && <div role="alert" style={alertBox}>{error}</div>}
      <label style={{ fontSize: '11px', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '360px' }}>Lowongan
        <select value={job} onChange={(e) => setJob(e.target.value)} style={field}>{jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select>
      </label>
      {current?.quota != null && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ ...chip, backgroundColor: 'var(--color-primary)', color: '#ffffff', borderColor: 'var(--color-primary)' }}>Kuota {current.quota} kursi</span>
          {rows && <span style={{ ...chip, ...(filled >= current.quota ? { backgroundColor: '#ECFDF3', color: '#067647', borderColor: '#ABEFC6' } : {}) }}>Terisi {filled} dari {current.quota}</span>}
          <span style={chip}>{current.applicantCount ?? 0} pelamar</span>
          {current.scheme && <span style={chip}>{SCHEME_LABELS[current.scheme]}</span>}
        </div>
      )}
      <div role="tablist" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {TABS.map((s) => {
          const n = (rows ?? []).filter((r) => r.status === s).length;
          return (
            <button key={s} type="button" role="tab" aria-selected={tab === s} onClick={() => setTab(s)}
              style={{ padding: '6px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: tab === s ? 700 : 400, backgroundColor: tab === s ? 'var(--color-primary)' : 'var(--color-border)', color: tab === s ? '#fff' : 'var(--color-text-main)' }}>
              {APPLICATION_STATUS_LABELS[s]} ({n})
            </button>
          );
        })}
      </div>
      {rows && shown.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Belum ada kandidat di status ini.</p> : (
        <div style={{ backgroundColor: '#fff', border: '1px solid var(--color-border)', borderRadius: '12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
            <thead><tr><th style={th}>Nama</th><th style={th}>Kelas FM</th><th style={th}>Nilai akhir</th><th style={th}>Dikirim</th><th style={th}>Status</th><th style={th} aria-label="Aksi" /></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td style={td}><b>{r.fullName}</b><div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{r.number}</div></td>
                  <td style={td}>{r.className || '–'}</td>
                  <td style={td}>{r.finalScore ?? 'Belum ada'}{r.finalScorePending && r.finalScore !== null ? <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}> · sementara</span> : null}</td>
                  <td style={td}>{when(r.submittedAt)}</td>
                  <td style={td}>{APPLICATION_STATUS_LABELS[r.status]}</td>
                  <td style={{ ...td, textAlign: 'right' }}><Link href={`/mitra/kandidat/${r.id}`} style={{ ...btn, textDecoration: 'none' }}>Review CV</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MitraShell>
  );
}
