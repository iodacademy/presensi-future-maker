'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { alertBox, api, btn, btnSolid } from '../pameran/admin-ui';
import type { JobRow, PartnerRow } from '@/features/careers/admin-service';
import { JobsTab } from './jobs-tab';
import { PartnersTab } from './partners-tab';
import { PartnerForm } from './partner-form';
import { JobForm } from './job-form';

type Stats = { activeJobs: number; applicants: number; partners: number; interviews: number };
type View = { kind: 'list' } | { kind: 'job'; id: string | null } | { kind: 'partner'; id: string | null };

const STAT_LABELS: [keyof Stats, string][] = [
  ['activeJobs', 'Lowongan aktif'], ['applicants', 'Total pelamar'], ['partners', 'Mitra terdaftar'], ['interviews', 'Interview terjadwal'],
];

/**
 * Panel admin Job Portal: lowongan dan mitra. Tab dipilih lewat ?tab= agar muat ulang tidak kembali ke Lowongan.
 *
 * Job Portal admin panel: jobs and partners. The tab lives in ?tab= so a reload does not jump back to Lowongan.
 */
export default function AdminJobPortalPage() {
  const [tab, setTab] = useState<'lowongan' | 'mitra'>('lowongan');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (new URLSearchParams(window.location.search).get('tab') === 'mitra') setTab('mitra'); }, []);

  const load = useCallback(async () => {
    try {
      const [j, p] = await Promise.all([api('/api/karier/jobs'), api('/api/karier/partners')]);
      setJobs(j.jobs); setStats(j.stats); setPartners(p.partners); setError(null);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function choose(key: 'lowongan' | 'mitra') {
    setTab(key);
    window.history.replaceState(null, '', `/admin/job-portal?tab=${key}`);
  }
  const back = () => { setView({ kind: 'list' }); load(); };

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>Job Portal</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>
            Kelola lowongan dari mitra. Lamaran siswa diteruskan ke PIC sesuai perusahaan.
          </p>
        </div>
        {view.kind === 'list' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" style={btn} onClick={() => setView({ kind: 'partner', id: null })}>+ Tambah mitra</button>
            <button type="button" style={btnSolid} onClick={() => setView({ kind: 'job', id: null })} disabled={partners.length === 0}
              title={partners.length === 0 ? 'Tambahkan mitra lebih dulu' : undefined}>+ Tambah lowongan</button>
          </div>
        )}
      </div>

      {error && <div role="alert" style={alertBox}>{error}</div>}

      {view.kind === 'job' ? (
        <JobForm id={view.id} onDone={back} />
      ) : view.kind === 'partner' ? (
        <PartnerForm id={view.id} onDone={back} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            {STAT_LABELS.map(([k, l]) => (
              <div key={k} style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{l}</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: 'var(--color-text-main)' }}>{stats ? stats[k] : '–'}</div>
              </div>
            ))}
          </div>
          <div role="tablist" style={{ display: 'flex', gap: '8px' }}>
            {([['lowongan', 'Lowongan'], ['mitra', 'Mitra & PIC']] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => choose(k)}
                style={{
                  padding: '7px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px',
                  fontWeight: tab === k ? 700 : 400,
                  backgroundColor: tab === k ? 'var(--color-primary)' : 'var(--color-border)',
                  color: tab === k ? '#ffffff' : 'var(--color-text-main)',
                }}>
                {l}
              </button>
            ))}
          </div>
          {tab === 'mitra'
            ? <PartnersTab rows={partners} onEdit={(id) => setView({ kind: 'partner', id })} />
            : <JobsTab rows={jobs} onEdit={(id) => setView({ kind: 'job', id })} onChanged={load} onError={setError} />}
        </>
      )}
    </AppShell>
  );
}
