'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';

/**
 * Kerangka portal PIC: nama perusahaan di bawah judul agar PIC tahu sedang melihat perusahaan mana.
 *
 * PIC portal frame: the company name under the title so the PIC knows which company they are viewing.
 */
export function MitraShell({ children }: { children: React.ReactNode }) {
  const [names, setNames] = useState<{ picName: string; partnerName: string } | null>(null);
  useEffect(() => {
    fetch('/api/mitra/me').then((r) => (r.ok ? r.json() : null)).then((d) => d && setNames({ picName: d.picName, partnerName: d.partnerName })).catch(() => undefined);
  }, []);
  return (
    <AppShell role="partner" userName={names?.picName ?? 'PIC Mitra'} classNameTitle={names ? `${names.partnerName} · Portal Mitra` : undefined}>
      {children}
    </AppShell>
  );
}

export const when = (iso: string) => (iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '–');
export const h1: React.CSSProperties = { fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' };
export const sub: React.CSSProperties = { color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' };
export const box: React.CSSProperties = { backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px' };
