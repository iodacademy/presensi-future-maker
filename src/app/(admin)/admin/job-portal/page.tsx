'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { alertBox, api, btn, btnSolid, send } from '../pameran/admin-ui';
import type { JobRow, PartnerRow } from '@/features/careers/admin-service';
import { JobsTab } from './jobs-tab';
import { PartnersTab } from './partners-tab';
import { PartnerForm } from './partner-form';
import { JobForm } from './job-form';
import { InsightsPanel } from './insights-panel';
import { TrackingTab } from './tracking-tab';

type Tab = 'lowongan' | 'mitra' | 'tracking';
type View = { kind: 'list' } | { kind: 'job'; id: string | null } | { kind: 'partner'; id: string | null };

/**
 * Panel admin Job Portal: lowongan dan mitra. Tab dipilih lewat ?tab= agar muat ulang tidak kembali ke Lowongan.
 *
 * Job Portal admin panel: jobs and partners. The tab lives in ?tab= so a reload does not jump back to Lowongan.
 */
export default function AdminJobPortalPage() {
  const [tab, setTab] = useState<Tab>('lowongan');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'mitra' || t === 'tracking') setTab(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const [j, p, g] = await Promise.all([api('/api/karier/jobs'), api('/api/karier/partners'), api('/api/karier/pendaftaran')]);
      setJobs(j.jobs); setReloadKey((k) => k + 1); setPartners(p.partners); setOpen(g.open); setError(null);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function choose(key: Tab) {
    setTab(key);
    window.history.replaceState(null, '', `/admin/job-portal?tab=${key}`);
  }
  const back = () => { setView({ kind: 'list' }); load(); };

  async function toggleOpen() {
    const next = !open;
    if (!window.confirm(next ? 'Buka pendaftaran? Siswa langsung bisa mengirim lamaran.' : 'Tutup pendaftaran? Siswa hanya bisa melihat lowongan.')) return;
    try { setOpen((await send('/api/karier/pendaftaran', 'POST', { open: next })).open); } catch (e) { setError((e as Error).message); }
  }

  async function resetDemo() {
    if (!window.confirm('Reset akun demo? Semua lamaran akun demo dihapus agar demo bisa diulang. CV dan profilnya tetap. Data peserta asli tidak tersentuh.')) return;
    try {
      const r = await send('/api/karier/demo/reset', 'POST', {});
      setInfo(`Akun demo direset: ${r.applications} lamaran dihapus.`); setError(null); load();
    } catch (e) { setError((e as Error).message); }
  }

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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {open !== null && (
              <button type="button" style={{ ...btn, color: open ? '#067647' : '#B42318' }} onClick={toggleOpen} aria-pressed={open}
                title="Siswa tetap bisa melihat lowongan selama pendaftaran tutup">
                {open ? 'Pendaftaran lamaran: dibuka' : 'Pendaftaran lamaran: ditutup'}
              </button>
            )}
            <button type="button" style={btn} onClick={resetDemo} title="Hapus lamaran akun demo agar demo bisa diulang">Reset akun demo</button>
            <button type="button" style={btn} onClick={() => setView({ kind: 'partner', id: null })}>+ Tambah mitra</button>
            <button type="button" style={btnSolid} onClick={() => setView({ kind: 'job', id: null })} disabled={partners.length === 0}
              title={partners.length === 0 ? 'Tambahkan mitra lebih dulu' : undefined}>+ Tambah lowongan</button>
          </div>
        )}
      </div>

      {error && <div role="alert" style={alertBox}>{error}</div>}
      {info && <div role="status" style={{ ...alertBox, backgroundColor: '#ECFDF3', color: '#067647' }}>{info}</div>}

      {view.kind === 'job' ? (
        <JobForm id={view.id} onDone={back} />
      ) : view.kind === 'partner' ? (
        <PartnerForm id={view.id} onDone={back} />
      ) : (
        <>
          {reloadKey > 0 && <InsightsPanel reloadKey={reloadKey} onError={setError} />}
          <div role="tablist" style={{ display: 'flex', gap: '8px' }}>
            {([['lowongan', 'Lowongan'], ['mitra', 'Mitra & PIC'], ['tracking', 'Tracking peserta']] as const).map(([k, l]) => (
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
          {tab === 'tracking'
            ? <TrackingTab onError={setError} />
            : tab === 'mitra'
            ? <PartnersTab rows={partners} onEdit={(id) => setView({ kind: 'partner', id })} />
            : <JobsTab rows={jobs} onEdit={(id) => setView({ kind: 'job', id })} onChanged={load} onError={setError} />}
        </>
      )}
    </AppShell>
  );
}
