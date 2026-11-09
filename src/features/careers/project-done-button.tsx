'use client';

import React, { useState } from 'react';
import { btn } from '@/app/(admin)/admin/pameran/admin-ui';

/**
 * Status proyek Project Based yang sudah diterima kandidat. Admin atau PIC menandainya selesai,
 * dan jatah proyek kandidat kembali satu.
 *
 * The status of a Project Based project the candidate accepted. An admin or the PIC marks it
 * finished, and the candidate gets one project slot back.
 */
export function ProjectDone({ url, completedAt, onDone }: { url: string; completedAt?: string | null; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (completedAt) return <span style={{ fontSize: '12px', color: '#067647', fontWeight: 600 }}>Proyek selesai</span>;

  async function mark() {
    if (!window.confirm('Tandai proyek ini selesai? Jatah proyek kandidat kembali satu, dan tanda ini tidak bisa dibatalkan.')) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal menandai proyek selesai');
      onDone();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
      <button type="button" style={btn} onClick={mark} disabled={busy}>{busy ? 'Menyimpan…' : 'Tandai proyek selesai'}</button>
      {error && <span role="alert" style={{ fontSize: '11px', color: '#B42318' }}>{error}</span>}
    </span>
  );
}
