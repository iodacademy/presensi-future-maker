'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { WorksTab } from './works-tab';
import { PeopleTab } from './people-tab';
import { CollectionsTab } from './collections-tab';
import { SiteTab } from './site-tab';

const TABS = [
  { key: 'karya', label: 'Karya' },
  { key: 'peserta', label: 'Peserta' },
  { key: 'koleksi', label: 'Koleksi' },
  { key: 'situs', label: 'Konten Situs' },
] as const;

/**
 * Panel admin pameran. Tab dipilih lewat ?tab= agar muat ulang tidak kembali ke Karya.
 *
 * Exhibition admin panel. The tab lives in ?tab= so a reload does not jump back to Karya.
 */
export default function AdminPameranPage() {
  const [tab, setTab] = useState<string>('karya');
  useEffect(() => { setTab(new URLSearchParams(window.location.search).get('tab') || 'karya'); }, []);

  function choose(key: string) {
    setTab(key);
    window.history.replaceState(null, '', `/admin/pameran?tab=${key}`);
  }

  return (
    <AppShell role="admin" userName="Administrator">
      <div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>Pameran</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>Kelola karya, peserta, koleksi, dan isi situs pameran.</p>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key} type="button" onClick={() => choose(t.key)} aria-pressed={tab === t.key}
            style={{
              padding: '7px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px',
              fontWeight: tab === t.key ? 700 : 400,
              backgroundColor: tab === t.key ? 'var(--color-primary)' : 'var(--color-border)',
              color: tab === t.key ? '#ffffff' : 'var(--color-text-main)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'peserta' ? <PeopleTab /> : tab === 'koleksi' ? <CollectionsTab /> : tab === 'situs' ? <SiteTab /> : <WorksTab />}
    </AppShell>
  );
}
