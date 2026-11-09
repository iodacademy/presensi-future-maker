'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { alertBox, btnSolid } from '@/app/(admin)/admin/pameran/admin-ui';
import { countdownParts, EMPLOYMENT_LABELS, formatCountdown, SCHEME_LABELS, type Employment, type Scheme } from '@/features/careers/model';
import { box, h1, MitraShell, sub } from './shell';
import { ContactCandidate } from './contact-candidate';

type Dash = {
  picName: string; partnerName: string; stats: { newCount: number; shortlist: number; interviews: number; activeJobs: number };
  jobs: { id: string; title: string; employment: Employment; scheme: Scheme; quota: number; closesAt: string; applicantCount: number; newCount: number }[];
  toContact: { id: string; fullName: string; jobTitle: string; waLink: string | null }[];
  rescheduleRequests: { id: string; fullName: string; jobTitle: string; note: string }[];
};

export default function MitraDashboardPage() {
  const [d, setD] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const load = () => fetch('/api/mitra/dashboard').then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const stats: [keyof Dash['stats'], string][] = [['newCount', 'Pelamar baru'], ['shortlist', 'Shortlist'], ['interviews', 'Interview terjadwal'], ['activeJobs', 'Lowongan aktif']];
  return (
    <MitraShell>
      <div>
        <h1 style={h1}>Halo, {d?.picName.split(' ')[0] ?? ''}</h1>
        <p style={sub}>Kamu melihat lowongan dan pelamar untuk <b>{d?.partnerName}</b> saja.</p>
      </div>
      {error && <div role="alert" style={alertBox}>{error}</div>}
      {d && d.toContact.length > 0 && (
        <section aria-label="Kandidat lolos yang perlu dihubungi" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ ...h1, fontSize: '14px', color: '#067647' }}>{d.toContact.length} kandidat lolos perlu segera dihubungi</h2>
          {d.toContact.map((c) => <ContactCandidate key={c.id} appId={c.id} name={c.fullName} jobTitle={c.jobTitle} waLink={c.waLink} onContacted={load} />)}
        </section>
      )}
      {d && d.rescheduleRequests.length > 0 && (
        <section aria-label="Permintaan jadwal ulang" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ ...h1, fontSize: '14px', color: '#946200' }}>{d.rescheduleRequests.length} kandidat minta jadwal ulang interview</h2>
          {d.rescheduleRequests.map((r) => (
            <div key={r.id} style={{ ...box, borderColor: '#FEC84B', backgroundColor: '#FFFAEB', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12px' }}>
              <span><b>{r.fullName}</b> · {r.jobTitle}<br />&ldquo;{r.note}&rdquo;</span>
              <Link href={`/mitra/kandidat/${r.id}`} style={{ ...btnSolid, textDecoration: 'none' }}>Jadwalkan ulang</Link>
            </div>
          ))}
        </section>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        {stats.map(([k, l]) => (
          <div key={k} style={box}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{l}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: k === 'newCount' ? 'var(--color-primary)' : 'var(--color-text-main)' }}>{d ? d.stats[k] : '–'}</div>
          </div>
        ))}
      </div>
      <h2 style={{ ...h1, fontSize: '14px' }}>Lowongan {d?.partnerName}</h2>
      {d && d.jobs.length === 0 && <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Belum ada lowongan. Admin Future Makers yang memasang lowongan untukmu.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {d?.jobs.map((j) => {
          const p = countdownParts(j.closesAt, now);
          return (
            <div key={j.id} style={{ ...box, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{j.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{EMPLOYMENT_LABELS[j.employment]} · {SCHEME_LABELS[j.scheme]} · kuota {j.quota}</div>
              <div style={{ fontSize: '12px' }}><b>{j.applicantCount}</b> pelamar {j.newCount > 0 && <span style={{ color: 'var(--color-primary)', marginLeft: '8px' }}>{j.newCount} baru</span>}</div>
              <div style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#E6F1FB', color: '#0072CE', fontWeight: 600 }}>
                {p.ended ? 'Lamaran sudah ditutup' : `Lamaran ditutup dalam ${formatCountdown(p)}`}
              </div>
              <Link href={`/mitra/kandidat?job=${j.id}`} style={{ ...btnSolid, textAlign: 'center', textDecoration: 'none' }}>Lihat kandidat</Link>
            </div>
          );
        })}
      </div>
    </MitraShell>
  );
}
