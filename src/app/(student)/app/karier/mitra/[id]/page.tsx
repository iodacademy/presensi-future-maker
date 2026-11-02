'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe } from 'lucide-react';
import { StudentShell } from '@/components/student-shell';
import { JobCard, PartnerLogo } from '@/features/careers/job-card';
import type { Socials } from '@/features/careers/model';
import type { PublicPartner, StudentJobCard } from '@/features/careers/student-service';
import { BLUE, btnGhost, btnOutline, card, errorBox, getJson, heading, MUTED, pageWrap } from '../../ui';

const SOCIAL_LABELS: Record<keyof Socials, string> = { instagram: 'Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok', youtube: 'YouTube' };

/**
 * Profil mitra untuk siswa: deskripsi, tautan, dan lowongan yang terbuka.
 *
 * Partner profile for students: description, links, and open jobs.
 */
export default function PartnerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<{ partner: PublicPartner; jobs: StudentJobCard[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();

  useEffect(() => { getJson<{ partner: PublicPartner; jobs: StudentJobCard[] }>(`/api/karier/mitra/${id}`).then(setD).catch((e) => setError(e.message)); }, [id]);

  const links = d ? (Object.keys(SOCIAL_LABELS) as (keyof Socials)[]).filter((k) => d.partner.socials[k]) : [];

  return (
    <StudentShell>
      <div style={pageWrap}>
        <Link href="/app/karier" style={{ ...btnGhost, alignSelf: 'flex-start' }}>← Kembali ke lowongan</Link>
        {error && <div role="alert" style={errorBox}>{error}</div>}
        {d && (
          <>
            <section style={{ ...card, display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <PartnerLogo name={d.partner.name} logo={d.partner.logo?.full ?? null} size={88} />
              <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h1 style={{ ...heading, fontSize: '24px' }}>{d.partner.name}</h1>
                {d.partner.field && <div style={{ color: MUTED }}>{d.partner.field}</div>}
                {d.partner.about && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{d.partner.about}</p>}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {d.partner.website && <a href={d.partner.website} target="_blank" rel="noopener noreferrer" style={btnOutline}><Globe size={16} aria-hidden /> Situs web</a>}
                  {links.map((k) => <a key={k} href={d.partner.socials[k]} target="_blank" rel="noopener noreferrer" style={btnOutline}>{SOCIAL_LABELS[k]}</a>)}
                </div>
              </div>
            </section>
            <h2 style={{ ...heading, fontSize: '18px' }}>Lowongan yang dibuka</h2>
            {d.jobs.length === 0 ? <div style={{ ...card, color: MUTED }}>Belum ada lowongan yang dibuka untukmu.</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {d.jobs.map((j) => (
                  <JobCard key={j.id} job={j} logo={j.logo} now={now}
                    footer={<Link href={`/app/karier/${j.id}`} style={{ ...btnOutline, alignSelf: 'flex-end', color: BLUE }}>Lihat detail</Link>} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </StudentShell>
  );
}
