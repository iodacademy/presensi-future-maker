'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { StudentShell } from '@/components/student-shell';
import { CountdownBanner } from '@/features/careers/countdown-banner';
import { JobCard } from '@/features/careers/job-card';
import { CATEGORY_LABELS, type Category } from '@/features/careers/model';
import type { MyApplication, StudentJobCard } from '@/features/careers/student-service';
import { InterviewCard } from './interview-card';
import { OfferCard } from './offer-card';
import { BLUE, btnOutline, card, errorBox, formatDate, getJson, heading, LINE, MUTED, pageWrap, pill, STATUS_PILL } from './ui';

type Lowongan = { access: boolean; jobs: StudentJobCard[]; appliedJobIds: string[]; bannerClosesAt: string | null };

/**
 * Portal Karier siswa: tab Lowongan dan Lamaran Saya. Tab disimpan di ?tab= agar tautan "Lihat status" langsung ke sana.
 *
 * Student career portal: Lowongan and Lamaran Saya tabs. The tab lives in ?tab= so the "Lihat status" link lands there.
 */
export default function KarierPage() {
  const [tab, setTab] = useState<'lowongan' | 'lamaran'>('lowongan');
  const [data, setData] = useState<Lowongan | null>(null);
  const [apps, setApps] = useState<MyApplication[] | null>(null);
  const [filter, setFilter] = useState<Category | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'lamaran') setTab('lamaran');
    getJson<Lowongan>('/api/karier/lowongan').then(setData).catch((e) => setError(e.message));
    loadApps();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function loadApps() {
    getJson<{ applications: MyApplication[] }>('/api/karier/lamaran').then((r) => setApps(r.applications)).catch((e) => setError(e.message));
  }

  function choose(t: 'lowongan' | 'lamaran') {
    setTab(t);
    window.history.replaceState(null, '', t === 'lamaran' ? '/app/karier?tab=lamaran' : '/app/karier');
  }

  const applied = new Set(data?.appliedJobIds ?? []);
  const jobs = (data?.jobs ?? []).filter((j) => !filter || j.category === filter);

  return (
    <StudentShell>
      <div style={pageWrap}>
        <div>
          <div style={{ fontSize: '12px', color: MUTED }}>Karier</div>
          <h1 style={{ ...heading, fontSize: '22px' }}>Portal Karier</h1>
        </div>

        <div role="tablist" style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${LINE}` }}>
          {([['lowongan', 'Lowongan'], ['lamaran', `Lamaran Saya${apps ? ` (${apps.length})` : ''}`]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => choose(k)}
              style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: tab === k ? BLUE : MUTED, borderBottom: `3px solid ${tab === k ? BLUE : 'transparent'}`, marginBottom: '-1px' }}>
              {l}
            </button>
          ))}
        </div>

        {error && <div role="alert" style={errorBox}>{error}</div>}

        {data && !data.access && (
          <div style={{ ...card, color: MUTED }}>
            Portal Karier terbuka untuk peserta dengan skema Full Internship atau Project Based. Skemamu mengikuti nilai akhir bootcamp.
          </div>
        )}

        {data && !data.access ? null : tab === 'lowongan' ? (
          <>
            <CountdownBanner closesAt={data?.bannerClosesAt ?? null} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {([['', 'Semua'], ...Object.entries(CATEGORY_LABELS)] as [Category | '', string][]).map(([k, l]) => (
                <button key={k || 'semua'} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
                  style={{ padding: '8px 16px', borderRadius: '999px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${filter === k ? BLUE : LINE}`, backgroundColor: filter === k ? BLUE : '#fff', color: filter === k ? '#fff' : '#243c4b' }}>
                  {l}
                </button>
              ))}
            </div>
            {!data ? <p style={{ color: MUTED }}>Memuat lowongan…</p> : jobs.length === 0 ? (
              <div style={{ ...card, color: MUTED }}>{data.jobs.length ? 'Belum ada lowongan di bidang ini.' : 'Belum ada lowongan yang dibuka. Cek lagi nanti.'}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {jobs.map((j) => (
                  <JobCard key={j.id} job={j} logo={j.logo} now={now} footer={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      {applied.has(j.id) ? <span style={pill('#ECFDF3', '#067647')}>Sudah dilamar</span> : <span style={{ fontSize: '13px', color: MUTED }}>{j.applicantCount} pelamar</span>}
                      <Link href={`/app/karier/${j.id}`} style={btnOutline}>Lihat detail</Link>
                    </div>
                  } />
                ))}
              </div>
            )}
          </>
        ) : (
          !apps ? <p style={{ color: MUTED }}>Memuat lamaran…</p> : apps.length === 0 ? (
            <div style={{ ...card, color: MUTED }}>Kamu belum melamar lowongan apa pun.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {apps.map((a) => {
                const [bg, fg] = STATUS_PILL[a.statusLabel] ?? ['#F3F4F6', MUTED];
                return (
                  <div key={a.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <div>
                        <Link href={`/app/karier/${a.jobId}`} style={{ ...heading, fontSize: '16px', textDecoration: 'none' }}>{a.jobTitle}</Link>
                        <div style={{ fontSize: '13px', color: MUTED }}>{a.partnerName} · {a.number} · dikirim {formatDate(a.submittedAt)}</div>
                      </div>
                      <span style={pill(bg, fg)}>{a.statusLabel}</span>
                    </div>
                    {a.message && <p style={{ margin: 0, fontSize: '13px', color: MUTED }}>{a.message}</p>}
                    {a.interview && <InterviewCard appId={a.id} partnerName={a.partnerName} interview={a.interview} picWaLink={a.picWaLink} />}
                    {a.status === 'diterima' && <OfferCard appId={a.id} jobTitle={a.jobTitle} partnerName={a.partnerName} onAnswered={loadApps} />}
                    {a.status === 'bergabung' && (
                      <p style={{ margin: 0, fontSize: '13px', color: '#067647', fontWeight: 600 }}>
                        Kamu menerima tawaran ini. {a.partnerName} akan menghubungimu untuk kontrak magang dan onboarding.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </StudentShell>
  );
}
