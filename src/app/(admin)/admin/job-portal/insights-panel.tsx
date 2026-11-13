'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { api, btn, field } from '../pameran/admin-ui';
import { summarize, type InsightApp, type InsightJob, type InsightStudent, type PortalInsights } from '@/features/careers/insights';
import { APPLICATION_STATUS_LABELS, interviewTimeLabel, SCHEME_LABELS, type ApplicationStatus, type Scheme } from '@/features/careers/model';

// Biru dan kuning Plan; kuning digelapkan agar lolos batas terang grafik, dan setiap batang tetap berlabel angka
// Plan blue and yellow; the yellow is darkened to pass the chart lightness band, and every bar still carries a number label
const COLOR: Record<Scheme, string> = { full: '#0072CE', project: '#E8A400' };
const panel: React.CSSProperties = { backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 };
const muted: React.CSSProperties = { fontSize: '11px', color: 'var(--color-text-muted)' };
const big: React.CSSProperties = { fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.1 };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' };
const td: React.CSSProperties = { padding: '8px 10px', fontSize: '12px', borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' };

const CONFIRM: Record<string, string> = { pending: 'menunggu konfirmasi', hadir: 'kandidat konfirmasi hadir', 'jadwal-ulang': 'kandidat minta jadwal ulang' };
function statusTone(s: ApplicationStatus): { bg: string; fg: string } {
  if (s === 'diterima' || s === 'bergabung') return { bg: '#ECFDF3', fg: '#067647' };
  if (s === 'tidak-lolos' || s === 'menolak') return { bg: '#FDECEA', fg: '#B42318' };
  if (s === 'ditutup') return { bg: '#f3f4f6', fg: '#5b6b75' };
  return { bg: '#E6F1FB', fg: '#0072CE' };
}

type Detail = { kind: 'applied' | 'notApplied' | 'accepted' } | { kind: 'status'; status: ApplicationStatus } | { kind: 'partner'; partnerId: string };
const keyOf = (d: Detail | null) => (!d ? '' : d.kind === 'status' ? `status:${d.status}` : d.kind === 'partner' ? `partner:${d.partnerId}` : d.kind);

function Legend() {
  return (
    <div style={{ display: 'flex', gap: '12px', ...muted }}>
      {(['full', 'project'] as const).map((k) => (
        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: COLOR[k] }} />{SCHEME_LABELS[k]}
        </span>
      ))}
    </div>
  );
}

// Batang bertumpuk Full/Project dengan celah 2px dan ujung membulat / A stacked Full/Project bar with a 2px gap and rounded ends
function StackBar({ full, project, max, height = 10 }: { full: number; project: number; max: number; height?: number }) {
  const w = (n: number) => `${max > 0 ? (n / max) * 100 : 0}%`;
  return (
    <div style={{ display: 'flex', gap: full && project ? '2px' : 0, height, flex: 1, minWidth: 0 }}>
      {full > 0 && <div title={`${SCHEME_LABELS.full}: ${full}`} style={{ width: w(full), backgroundColor: COLOR.full, borderRadius: project ? '4px 0 0 4px' : '4px' }} />}
      {project > 0 && <div title={`${SCHEME_LABELS.project}: ${project}`} style={{ width: w(project), backgroundColor: COLOR.project, borderRadius: full ? '0 4px 4px 0' : '4px' }} />}
    </div>
  );
}

// Cincin dua bagian; bagian kedua abu-abu bila hanya satu ukuran yang ditampilkan / A two-part ring; the second part is grey when only one measure is shown
function Ring({ parts, label }: { parts: { value: number; color: string; name: string }[]; label: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  const r = 26;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" role="img" aria-label={label} style={{ flexShrink: 0 }}>
      <circle cx="34" cy="34" r={r} fill="none" stroke="#EEF2F6" strokeWidth="9" />
      {total > 0 && parts.map((p) => {
        const len = (p.value / total) * c;
        // Celah 2px antarbagian, hanya bila ada lebih dari satu bagian / A 2px gap between parts, only when there is more than one
        const gap = parts.filter((x) => x.value > 0).length > 1 && len > 2 ? 2 : 0;
        const el = p.value > 0 ? (
          <circle key={p.name} cx="34" cy="34" r={r} fill="none" stroke={p.color} strokeWidth="9"
            strokeDasharray={`${len - gap} ${c - len + gap}`} strokeDashoffset={-offset} transform="rotate(-90 34 34)">
            <title>{`${p.name}: ${p.value}`}</title>
          </circle>
        ) : null;
        offset += len;
        return el;
      })}
    </svg>
  );
}

function Kpi({ title, value, sub, active, onClick, children }: {
  title: string; value: React.ReactNode; sub?: string; active?: boolean; onClick?: () => void; children?: React.ReactNode;
}) {
  const body = (
    <>
      <div style={{ ...muted, fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div><div style={big}>{value}</div>{sub && <div style={muted}>{sub}</div>}</div>
        {children}
      </div>
      {onClick && <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)' }}>{active ? 'Tutup detail ▲' : 'Lihat detail ▼'}</div>}
    </>
  );
  const style: React.CSSProperties = { ...panel, gap: '6px', textAlign: 'left', fontFamily: 'inherit', ...(active ? { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 2px var(--color-primary-light)' } : null) };
  return onClick
    ? <button type="button" onClick={onClick} aria-expanded={active} style={{ ...style, cursor: 'pointer' }}>{body}</button>
    : <div style={style}>{body}</div>;
}

export function AppLine({ app, job }: { app: InsightApp; job?: InsightJob }) {
  const tone = statusTone(app.status);
  const iv = app.status === 'interview' && app.interview ? interviewTimeLabel(app.interview) : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '3px 0' }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>{job?.title ?? 'Lowongan'}</span>
        <span style={muted}>· {job?.partnerName}</span>
        <span style={{ padding: '1px 7px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, backgroundColor: tone.bg, color: tone.fg }}>
          {app.completedAt ? 'Proyek selesai' : APPLICATION_STATUS_LABELS[app.status]}
        </span>
      </div>
      {iv && app.interview && (
        <div style={muted}>Interview {iv.day}, {iv.time} · {app.interview.interviewer} · {CONFIRM[app.interview.confirmation] ?? app.interview.confirmation}</div>
      )}
      {job?.picName && <div style={muted}>PIC: {job.picName}</div>}
    </div>
  );
}

/**
 * Ringkasan Job Portal: KPI bergrafik, filter jurusan, dan detail peserta per kelompok.
 *
 * The Job Portal summary: KPI cards with charts, a programme filter, and per-group participant detail.
 */
export function InsightsPanel({ onError, reloadKey }: { onError: (m: string) => void; reloadKey: number }) {
  const [data, setData] = useState<PortalInsights | null>(null);
  const [program, setProgram] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    api('/api/karier/insights').then((d) => setData(d.insights)).catch((e) => onError((e as Error).message));
  }, [reloadKey, onError]);

  // Panel samping ditutup dengan Escape, seperti dialog lain / The side panel closes on Escape, like other dialogs
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetail(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail]);

  const s = useMemo(() => (data ? summarize(data, program || null) : null), [data, program]);
  const jobById = useMemo(() => new Map((data?.jobs ?? []).map((j) => [j.id, j])), [data]);
  if (!data || !s) return <div style={muted}>Memuat ringkasan…</div>;

  const toggle = (d: Detail) => { setQ(''); setDetail((cur) => (keyOf(cur) === keyOf(d) ? null : d)); };
  const isOpen = (kind: Detail['kind']) => detail?.kind === kind;
  const maxPartner = Math.max(1, ...s.byPartner.map((p) => p.total));
  const funnel = s.funnel.filter((f) => f.count > 0);
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));
  const joined = s.accepted.filter((a) => a.app.status === 'bergabung').length;

  const byStatus = detail?.kind === 'status' ? detail.status : null;
  // Baris detail: tiap peserta dengan lamaran yang relevan untuk kelompok yang dibuka
  // Detail rows: each participant with the applications relevant to the open group
  const rows: { student: InsightStudent; apps: InsightApp[] }[] = !detail ? []
    : detail.kind === 'applied' ? s.applied.map((st) => ({ student: st, apps: st.apps }))
    : detail.kind === 'notApplied' ? s.notApplied.map((st) => ({ student: st, apps: [] }))
    : detail.kind === 'accepted' ? [
      ...s.placed.map((st) => ({ student: st, apps: st.apps.filter((a) => a.status === 'diterima' || a.status === 'bergabung') })),
      ...s.accepted.filter((a) => !a.student.placedAt).map((a) => ({ student: a.student, apps: [a.app] })),
    ]
    : detail.kind === 'partner' ? s.applicantsOf(detail.partnerId)
    : s.students.map((st) => ({ student: st, apps: st.apps.filter((a) => a.status === byStatus) })).filter((r) => r.apps.length > 0);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => !needle || `${r.student.name} ${r.student.className} ${r.apps.map((a) => `${jobById.get(a.jobId)?.title} ${jobById.get(a.jobId)?.partnerName}`).join(' ')}`.toLowerCase().includes(needle));
  const partner = detail?.kind === 'partner' ? s.byPartner.find((p) => p.partnerId === detail.partnerId) : undefined;
  const detailTitle = !detail ? '' : detail.kind === 'applied' ? 'Peserta yang sudah melamar' : detail.kind === 'notApplied' ? 'Peserta yang belum melamar'
    : detail.kind === 'accepted' ? 'Peserta yang diterima' : detail.kind === 'partner' ? `Pelamar di ${partner?.partnerName ?? 'perusahaan ini'}`
    : `Lamaran berstatus ${APPLICATION_STATUS_LABELS[byStatus!]}`;

  return (
    <section aria-label="Ringkasan Job Portal" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={muted}>Peserta dihitung bila berhak magang (Full Internship atau Project Based di dashboard). Lowongan draf dan demo tidak dihitung.</div>
        <label style={{ ...muted, display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 600 }}>Jurusan
          <select value={program} onChange={(e) => setProgram(e.target.value)} style={{ ...field, width: 'auto' }}>
            <option value="">Semua jurusan</option>
            {data.programs.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <Kpi title="Perusahaan mitra" value={s.partners} sub={`${s.byPartner[0]?.partnerName ?? '-'} terbanyak`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '70px' }} aria-hidden>
            {s.byPartner.slice(0, 4).map((p) => <StackBar key={p.partnerName} full={p.full} project={p.project} max={maxPartner} height={6} />)}
          </div>
        </Kpi>
        <Kpi title="Total posisi (kuota)" value={s.quota.total} sub={`${s.quota.full} Full · ${s.quota.project} Project`}>
          <Ring label={`${s.quota.full} Full Internship, ${s.quota.project} Project Based`} parts={[
            { value: s.quota.full, color: COLOR.full, name: SCHEME_LABELS.full }, { value: s.quota.project, color: COLOR.project, name: SCHEME_LABELS.project },
          ]} />
        </Kpi>
        <Kpi title="Sudah melamar" value={`${s.applied.length}/${s.students.length}`} sub={`${s.students.length ? Math.round((s.applied.length / s.students.length) * 100) : 0}% peserta berhak magang`}
          active={isOpen('applied')} onClick={() => toggle({ kind: 'applied' })}>
          <Ring label={`${s.applied.length} sudah melamar dari ${s.students.length}`} parts={[
            { value: s.applied.length, color: COLOR.full, name: 'Sudah melamar' }, { value: s.notApplied.length, color: '#EEF2F6', name: 'Belum melamar' },
          ]} />
        </Kpi>
        <Kpi title="Belum melamar" value={s.notApplied.length}
          sub={`${s.notApplied.filter((x) => x.placement === 'full').length} Full · ${s.notApplied.filter((x) => x.placement === 'project').length} Project`}
          active={isOpen('notApplied')} onClick={() => toggle({ kind: 'notApplied' })}>
          <div style={{ width: '70px' }} aria-hidden>
            <StackBar full={s.notApplied.filter((x) => x.placement === 'full').length} project={s.notApplied.filter((x) => x.placement === 'project').length} max={Math.max(1, s.notApplied.length)} />
          </div>
        </Kpi>
        <Kpi title="Diterima" value={s.acceptedCount} sub={`${s.placed.length} seleksi awal · ${joined} bergabung · ${s.accepted.length - joined} menunggu jawaban`}
          active={isOpen('accepted')} onClick={() => toggle({ kind: 'accepted' })}>
          <Ring label={`${s.placed.length} seleksi awal, ${joined} bergabung, ${s.accepted.length - joined} menunggu jawaban`} parts={[
            { value: s.placed.length, color: '#0B4F8A', name: 'Seleksi awal mitra' },
            { value: joined, color: '#067647', name: 'Bergabung' }, { value: s.accepted.length - joined, color: '#7FD3A4', name: 'Menunggu jawaban' },
          ]} />
        </Kpi>
      </div>

      {detail && (
        <>
          <div onClick={() => setDetail(null)} aria-hidden style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.35)', zIndex: 60 }} />
          <aside role="dialog" aria-modal="true" aria-label={detailTitle}
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(820px, 94vw)', backgroundColor: '#ffffff', zIndex: 61, boxShadow: '-12px 0 32px rgba(15, 23, 42, 0.18)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>{detailTitle}</div>
                  <div style={muted}>{partner ? `${partner.total} posisi (${partner.full} Full · ${partner.project} Project) · ${shown.length} pelamar` : `${shown.length} peserta`}</div>
                </div>
                <button type="button" style={btn} onClick={() => setDetail(null)} aria-label="Tutup panel">Tutup</button>
              </div>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, kelas, posisi, perusahaan" aria-label="Cari di detail" style={field} />
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
                <thead><tr><th style={th}>Peserta</th><th style={th}>Penempatan</th><th style={th}>{detail.kind === 'notApplied' ? 'Lamaran' : 'Lamaran & progres'}</th></tr></thead>
                <tbody>
                  {shown.map(({ student, apps }) => (
                    <tr key={student.studentId}>
                      <td style={td}><div style={{ fontWeight: 600 }}>{student.name}</div><div style={muted}>{student.className}</div></td>
                      <td style={td}><span style={{ color: COLOR[student.placement], fontWeight: 700 }}>{SCHEME_LABELS[student.placement]}</span></td>
                      <td style={td}>
                        {student.placedAt && (
                          <div style={{ padding: '3px 0' }}>
                            <span style={{ fontWeight: 600 }}>{student.placedAt.position}</span> <span style={muted}>· {student.placedAt.partnerName}</span>{' '}
                            <span style={{ padding: '1px 7px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, backgroundColor: '#ECFDF3', color: '#067647' }}>Ditempatkan · seleksi awal mitra</span>
                          </div>
                        )}
                        {apps.length === 0 ? (!student.placedAt && <span style={muted}>Belum mengirim lamaran</span>) : apps.map((a) => <AppLine key={a.id} app={a} job={jobById.get(a.jobId)} />)}
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 && <tr><td style={td} colSpan={3}><span style={muted}>Tidak ada peserta.</span></td></tr>}
                </tbody>
              </table>
            </div>
          </aside>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
        <div style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>Posisi per perusahaan <span style={muted}>· klik untuk melihat pelamarnya</span></div>
            <Legend />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '360px', overflowY: 'auto' }}>
            <div aria-hidden style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 34%) 1fr 34px 64px', gap: '8px', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', padding: '0 4px' }}>
              <span>Perusahaan</span><span /><span style={{ textAlign: 'right' }}>Posisi</span><span style={{ textAlign: 'right' }}>Pelamar</span>
            </div>
            {s.byPartner.map((p) => {
              const on = keyOf(detail) === `partner:${p.partnerId}`;
              return (
                <button key={p.partnerId} type="button" onClick={() => toggle({ kind: 'partner', partnerId: p.partnerId })} aria-pressed={on}
                  aria-label={`${p.partnerName}: ${p.total} posisi, ${p.applicants} pelamar`}
                  title={`${p.partnerName}: ${p.full} Full Internship, ${p.project} Project Based, ${p.applicants} pelamar`}
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 34%) 1fr 34px 64px', alignItems: 'center', gap: '8px', background: on ? 'var(--color-primary-light)' : 'none', border: 'none', borderRadius: '6px', padding: '3px 4px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'inherit' }}>
                  <span style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.partnerName}</span>
                  <StackBar full={p.full} project={p.project} max={maxPartner} />
                  <span style={{ fontSize: '11px', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.total}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p.applicants ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>{p.applicants} orang</span>
                </button>
              );
            })}
            {s.byPartner.length === 0 && <span style={muted}>Belum ada lowongan untuk jurusan ini.</span>}
          </div>
        </div>

        <div style={panel}>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>Progres lamaran <span style={muted}>· klik status untuk melihat pesertanya</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {funnel.map((f) => {
              const tone = statusTone(f.status);
              const on = keyOf(detail) === `status:${f.status}`;
              return (
                <button key={f.status} type="button" onClick={() => toggle({ kind: 'status', status: f.status })} aria-pressed={on}
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 40%) 1fr 30px', alignItems: 'center', gap: '8px', background: on ? 'var(--color-primary-light)' : 'none', border: 'none', borderRadius: '6px', padding: '3px 4px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ fontSize: '11px' }}>{APPLICATION_STATUS_LABELS[f.status]}</span>
                  <span style={{ height: '10px', display: 'block' }}><span style={{ display: 'block', height: '100%', width: `${(f.count / maxFunnel) * 100}%`, backgroundColor: tone.fg, borderRadius: '4px' }} /></span>
                  <span style={{ fontSize: '11px', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.count}</span>
                </button>
              );
            })}
            {funnel.length === 0 && <span style={muted}>Belum ada lamaran.</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
