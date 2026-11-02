'use client';

import React, { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { alertBox, btn, btnSolid, field } from '@/app/(admin)/admin/pameran/admin-ui';
import { APPLICATION_STATUS_LABELS, type Application, type Interview, type JobQuestion } from '@/features/careers/model';
import { box, h1, MitraShell, sub } from '../../shell';
import { InviteForm } from './invite-form';

type Candidate = Application & { className: string; questions: JobQuestion[]; interview?: Interview };
const REASONS = ['Skill belum sesuai', 'Portofolio kurang relevan', 'Kuota sudah terpenuhi', 'Lainnya'];

/**
 * Review CV satu kandidat: pratinjau CV, data lamaran, dan keputusan seleksi.
 *
 * One candidate's CV review: CV preview, application data, and the selection decision.
 */
export default function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<Candidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [pic, setPic] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/mitra/candidates/${id}`);
    const d = await r.json();
    if (!r.ok) { setError(d.error); return; }
    setC(d.candidate);
  }, [id]);
  useEffect(() => {
    load();
    fetch('/api/mitra/me').then((r) => r.json()).then((d) => setPic(d.picName ?? '')).catch(() => undefined);
  }, [load]);

  async function decide(status: string, rejectReason = '') {
    setError(null);
    const r = await fetch(`/api/mitra/candidates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, rejectReason }) });
    if (!r.ok) { setError((await r.json()).error); return; }
    setRejecting(false);
    await load();
  }

  const row = (k: string, v: React.ReactNode) => (v ? <React.Fragment key={k}><dt style={{ color: 'var(--color-text-muted)' }}>{k}</dt><dd style={{ margin: 0, wordBreak: 'break-word' }}>{v}</dd></React.Fragment> : null);
  const ext = (u: string) => (/^https?:\/\//i.test(u) ? <a href={u} target="_blank" rel="noopener noreferrer">{u}</a> : null);

  return (
    <MitraShell>
      <Link href={c ? `/mitra/kandidat?job=${c.jobId}` : '/mitra/kandidat'} style={{ ...btn, border: 'none', padding: 0, alignSelf: 'flex-start', textDecoration: 'none' }}>← Daftar kandidat</Link>
      {error && <div role="alert" style={alertBox}>{error}</div>}
      {c && (
        <>
          <div>
            <h1 style={h1}>{c.personal.fullName}</h1>
            <p style={sub}>{c.number} · status {APPLICATION_STATUS_LABELS[c.status]}</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <section style={{ ...box, flex: '1 1 460px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: '12px' }}>CV · {c.cvFileName}</b>
                <a href={`/api/karier/cv/${c.cvId}`} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: 'none' }}>Unduh</a>
              </div>
              <iframe title={`CV ${c.personal.fullName}`} src={`/api/karier/cv/${c.cvId}`} style={{ width: '100%', height: '70vh', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
            </section>
            <aside style={{ flex: '0 1 380px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <section style={box}>
                <b style={{ fontSize: '12px' }}>Data pelamar</b>
                <dl style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '4px 10px', fontSize: '12px', margin: '8px 0 0' }}>
                  {row('Email', c.personal.email)}{row('WhatsApp', c.personal.phone)}{row('Domisili', c.personal.city)}
                  {row('Sekolah', c.personal.school)}{row('Jurusan', c.personal.major)}{row('LinkedIn', ext(c.personal.linkedin))}{row('Portofolio', ext(c.portfolioUrl))}
                </dl>
                {c.coverLetterId && <a href={`/api/karier/cv/${c.coverLetterId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px' }}>Buka surat lamaran</a>}
              </section>
              <section style={box}>
                <b style={{ fontSize: '10px', letterSpacing: '.06em', color: 'var(--color-text-muted)' }}>DATA FUTURE MAKERS</b>
                <dl style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '4px 10px', fontSize: '12px', margin: '8px 0 0' }}>
                  {row('Kelas', c.className)}
                  {row('Nilai akhir', c.finalScore === null ? 'Belum ada nilai akhir' : `${c.finalScore}${c.finalScorePending ? ` (sementara, ${c.finalScoreAt})` : ''}`)}
                </dl>
                {(c.works.length > 0 || c.tasks.length > 0) && (
                  <ul style={{ fontSize: '12px', margin: '8px 0 0', paddingLeft: '18px' }}>
                    {c.works.map((w) => <li key={w.id}><a href={`/karya/${w.id}`} target="_blank" rel="noopener noreferrer">{w.title}</a> · {w.type}</li>)}
                    {c.tasks.map((t) => <li key={t.submissionId}><a href={/^https?:\/\//i.test(t.url) ? t.url : `/api/submissions/${t.submissionId}/file`} target="_blank" rel="noopener noreferrer">{t.title}</a> · tugas</li>)}
                  </ul>
                )}
              </section>
              {c.questions.length > 0 && (
                <section style={{ ...box, fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <b>Jawaban pelamar</b>
                  {c.questions.map((q) => <div key={q.id}><div style={{ color: 'var(--color-text-muted)' }}>{q.label}</div><div style={{ whiteSpace: 'pre-wrap' }}>{c.answers[q.id] || '–'}</div></div>)}
                </section>
              )}
              <section style={{ ...box, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <b style={{ fontSize: '10px', letterSpacing: '.06em', color: 'var(--color-text-muted)' }}>KEPUTUSAN SELEKSI</b>
                {c.status === 'diterima' || c.status === 'tidak-lolos' ? (
                  <span style={{ fontSize: '12px' }}>Status kandidat sudah <b>{APPLICATION_STATUS_LABELS[c.status]}</b>.</span>
                ) : inviting || c.status === 'interview' ? (
                  <>
                    {c.status === 'interview' && !inviting && <span style={{ fontSize: '12px' }}>Interview terjadwal. Lihat menu Jadwal interview untuk tindak lanjut.</span>}
                    {(inviting || c.status === 'interview') && (
                      <InviteForm appId={c.id} defaultInterviewer={c.interview?.interviewer ?? pic} initial={c.interview} onSent={load} />
                    )}
                  </>
                ) : rejecting ? (
                  <>
                    <label style={{ fontSize: '11px', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '4px' }}>Alasan internal (tidak dikirim ke siswa)
                      <select value={reason} onChange={(e) => setReason(e.target.value)} style={field}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Siswa menerima pesan standar: &ldquo;Terima kasih sudah melamar. Kali ini kamu belum lolos ke tahap berikutnya.&rdquo;</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" style={btn} onClick={() => setRejecting(false)}>Batal</button>
                      <button type="button" style={{ ...btnSolid, backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => decide('tidak-lolos', reason)}>Ya, tidak lolos</button>
                    </div>
                  </>
                ) : (
                  <>
                    <button type="button" style={btnSolid} onClick={() => setInviting(true)}>Lolos &amp; undang interview</button>
                    {c.status !== 'shortlist' && <button type="button" style={btn} onClick={() => decide('shortlist')}>Simpan ke shortlist</button>}
                    <button type="button" style={{ ...btn, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }} onClick={() => setRejecting(true)}>Tidak lolos</button>
                  </>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </MitraShell>
  );
}
