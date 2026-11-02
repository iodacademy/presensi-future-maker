'use client';

import React, { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { AppShell } from '@/components/app-shell';
import { alertBox, api, btn, btnSolid, card, field, send } from '../../pameran/admin-ui';
import type { ApplicantRow } from '@/features/careers/applicants-service';
import { APPLICATION_STATUS_LABELS, type Application, type ApplicationStatus, type Job, type JobQuestion } from '@/features/careers/model';

type Detail = Application & { className: string; questions: JobQuestion[] };
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' };
const td: React.CSSProperties = { padding: '10px 12px', fontSize: '12px', borderBottom: '1px solid var(--color-border)', verticalAlign: 'middle' };
const REASONS = ['Skill belum sesuai', 'Portofolio kurang relevan', 'Kuota sudah terpenuhi', 'Lainnya'];
const when = (iso: string) => (iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '–');

function Score({ r }: { r: Pick<ApplicantRow, 'finalScore' | 'finalScorePending' | 'finalScoreAt'> }) {
  if (r.finalScore === null) return <span style={{ color: 'var(--color-text-muted)' }}>Belum ada nilai akhir</span>;
  return (
    <span>
      <b>{r.finalScore}</b>
      {r.finalScorePending && <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}> · sementara · {r.finalScoreAt}</span>}
    </span>
  );
}

/**
 * Pelamar satu lowongan: tabel, detail lamaran, ubah status, dan ekspor .xlsx.
 *
 * One job's applicants: table, application detail, status change, and .xlsx export.
 */
export default function ApplicantsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [rows, setRows] = useState<ApplicantRow[]>([]);
  const [open, setOpen] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [j, a] = await Promise.all([api(`/api/karier/jobs/${jobId}`), api(`/api/karier/jobs/${jobId}/applications`)]);
      setJob(j.job); setRows(a.applicants); setError(null);
    } catch (e) { setError((e as Error).message); }
  }, [jobId]);
  useEffect(() => { load(); }, [load]);

  async function changeStatus(id: string, status: ApplicationStatus) {
    let rejectReason = '';
    if (status === 'tidak-lolos') {
      const r = window.prompt(`Alasan internal (tidak dikirim ke siswa):\n${REASONS.join(' / ')}`, REASONS[0]);
      if (r === null) return;
      rejectReason = r;
    }
    try { await send(`/api/karier/applications/${id}`, 'PATCH', { status, rejectReason }); await load(); if (open?.id === id) await view(id); } catch (e) { setError((e as Error).message); }
  }
  async function view(id: string) {
    try { setOpen((await api(`/api/karier/applications/${id}`)).application); } catch (e) { setError((e as Error).message); }
  }

  function exportXlsx() {
    const data = rows.map((r) => ({
      'No. lamaran': r.number, Nama: r.fullName, Email: r.email, 'No. WhatsApp': r.phone, Domisili: r.city, 'Sekolah / kampus': r.school,
      Jurusan: r.major, Kelas: r.className, 'Nilai akhir': r.finalScore ?? '', 'Nilai sementara': r.finalScorePending ? 'Ya' : '',
      Status: APPLICATION_STATUS_LABELS[r.status], Dikirim: when(r.submittedAt), Portofolio: r.portfolioUrl,
      CV: `${window.location.origin}/api/karier/cv/${r.cvId}`,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Pelamar');
    XLSX.writeFile(wb, `Pelamar_${(job?.title ?? 'lowongan').replace(/[^\w-]+/g, '_')}.xlsx`);
  }

  return (
    <AppShell role="admin" userName="Administrator">
      <Link href="/admin/job-portal" style={{ ...btn, border: 'none', padding: 0, alignSelf: 'flex-start', textDecoration: 'none' }}>← Kembali ke Job Portal</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>{job?.title ?? 'Pelamar'}</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>{job?.partnerName} · {rows.length} pelamar</p>
        </div>
        <button type="button" style={btnSolid} onClick={exportXlsx} disabled={rows.length === 0}>Ekspor .xlsx</button>
      </div>
      {error && <div role="alert" style={alertBox}>{error}</div>}

      {rows.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Belum ada pelamar.</p> : (
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
            <thead><tr><th style={th}>No.</th><th style={th}>Nama</th><th style={th}>Kelas</th><th style={th}>Nilai akhir</th><th style={th}>Dikirim</th><th style={th}>Status</th><th style={th}>Terakhir diubah</th><th style={th} aria-label="Aksi" /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ backgroundColor: open?.id === r.id ? 'var(--color-primary-light)' : undefined }}>
                  <td style={td}>{r.number}</td>
                  <td style={td}><b>{r.fullName}</b><div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{r.city}</div></td>
                  <td style={td}>{r.className || '–'}</td>
                  <td style={td}><Score r={r} /></td>
                  <td style={td}>{when(r.submittedAt)}</td>
                  <td style={td}>
                    <select value={r.status} onChange={(e) => changeStatus(r.id, e.target.value as ApplicationStatus)} style={{ ...field, width: 'auto' }} aria-label={`Status ${r.fullName}`}>
                      {(Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[]).map((s) => <option key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td style={td}>{when(r.statusChangedAt)}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <a href={`/api/karier/cv/${r.cvId}`} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: 'none' }}>Buka CV</a>
                    <button type="button" style={{ ...btn, marginLeft: '6px' }} onClick={() => view(r.id)}>Detail</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <section style={{ ...card, maxWidth: '920px' }} aria-label={`Lamaran ${open.personal.fullName}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{open.personal.fullName} · {open.number}</h2>
            <button type="button" style={btn} onClick={() => setOpen(null)}>Tutup</button>
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 180px) 1fr', gap: '6px 12px', fontSize: '12px', margin: 0 }}>
            {([
              ['Email', open.personal.email], ['No. WhatsApp', open.personal.phone], ['Domisili', open.personal.city],
              ['Sekolah / kampus', open.personal.school], ['Jurusan', open.personal.major], ['Kelas', open.className],
              ['LinkedIn', open.personal.linkedin], ['Portofolio', open.portfolioUrl],
              ['Status', APPLICATION_STATUS_LABELS[open.status] + (open.rejectReason ? ` · ${open.rejectReason}` : '')],
            ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
              <React.Fragment key={k}><dt style={{ color: 'var(--color-text-muted)' }}>{k}</dt><dd style={{ margin: 0, wordBreak: 'break-word' }}>{/^https?:\/\//.test(v) ? <a href={v} target="_blank" rel="noopener noreferrer">{v}</a> : v}</dd></React.Fragment>
            ))}
            <dt style={{ color: 'var(--color-text-muted)' }}>Nilai akhir</dt><dd style={{ margin: 0 }}><Score r={open} /></dd>
          </dl>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a href={`/api/karier/cv/${open.cvId}`} target="_blank" rel="noopener noreferrer" style={{ ...btnSolid, textDecoration: 'none' }}>Buka CV · {open.cvFileName}</a>
            {open.coverLetterId && <a href={`/api/karier/cv/${open.coverLetterId}`} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: 'none' }}>Buka surat lamaran</a>}
          </div>
          {(open.works.length > 0 || open.tasks.length > 0) && (
            <div style={{ fontSize: '12px' }}>
              <b>Lampiran</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                {open.works.map((w) => <li key={w.id}><a href={`/karya/${w.id}`} target="_blank" rel="noopener noreferrer">{w.title}</a> · karya pameran {w.type}</li>)}
                {open.tasks.map((t) => <li key={t.submissionId}><a href={t.url || `/api/submissions/${t.submissionId}/file`} target="_blank" rel="noopener noreferrer">{t.title}</a> · tugas</li>)}
              </ul>
            </div>
          )}
          {open.questions.length > 0 && (
            <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <b>Jawaban</b>
              {open.questions.map((q) => (
                <div key={q.id}><div style={{ color: 'var(--color-text-muted)' }}>{q.label}</div><div style={{ whiteSpace: 'pre-wrap' }}>{open.answers[q.id] || '–'}</div></div>
              ))}
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
