'use client';

import React from 'react';
import { btn } from '../pameran/admin-ui';
import type { PartnerRow } from '@/features/careers/admin-service';
import { PartnerLogo } from '@/features/careers/job-card';

/**
 * Daftar mitra beserta PIC dan jumlah lowongannya.
 *
 * Partner list with their PICs and job counts.
 */
export function PartnersTab({ rows, onEdit }: { rows: PartnerRow[]; onEdit: (id: string) => void }) {
  if (rows.length === 0) {
    return <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Belum ada mitra. Tekan "+ Tambah mitra".</p>;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
      {rows.map((p) => (
        <div key={p.id} style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <PartnerLogo name={p.name} logo={p.logoThumb || null} size={40} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{p.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{p.field || '–'}</div>
            </div>
          </div>
          <div style={{ fontSize: '11px' }}><b>PIC:</b> {p.picNames.join(', ') || '–'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{p.jobCount} lowongan</span>
            <button type="button" style={btn} onClick={() => onEdit(p.id)}>Ubah</button>
          </div>
        </div>
      ))}
    </div>
  );
}
