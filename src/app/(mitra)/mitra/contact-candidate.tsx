'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { btnSolid } from '@/app/(admin)/admin/pameran/admin-ui';
import { HANDOVER_NOTE } from '@/features/careers/model';

export const waButton: React.CSSProperties = {
  ...btnSolid, backgroundColor: '#25D366', borderColor: '#25D366', textDecoration: 'none', alignSelf: 'flex-start', display: 'inline-flex', gap: '6px', alignItems: 'center',
};

/**
 * Pengingat PIC untuk segera menghubungi kandidat yang lolos. Menekan tombol
 * WhatsApp menandai kandidat sudah dihubungi, sehingga ia hilang dari daftar
 * "Segera hubungi" di dashboard.
 *
 * The PIC's reminder to contact a passed candidate right away. Pressing the
 * WhatsApp button marks the candidate as contacted, so they drop off the
 * dashboard's "Segera hubungi" list.
 */
export function ContactCandidate({ appId, name, jobTitle, waLink, onContacted }: { appId: string; name: string; jobTitle?: string; waLink: string | null; onContacted?: () => void }) {
  const mark = () => {
    fetch(`/api/mitra/candidates/${appId}/hubungi`, { method: 'POST' }).then(() => onContacted?.()).catch(() => undefined);
  };
  return (
    <div style={{ border: '1px solid #A6F4C5', backgroundColor: '#ECFDF3', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
      <b style={{ fontSize: '13px', color: '#067647' }}>Segera hubungi {name}{jobTitle ? ` · ${jobTitle}` : ''}: kandidat lolos</b>
      {waLink ? (
        <a href={waLink} target="_blank" rel="noopener noreferrer" style={waButton} onClick={mark}>
          <MessageCircle size={14} aria-hidden /> Hubungi lewat WhatsApp
        </a>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>Nomor WhatsApp kandidat tidak terbaca; hubungi lewat email.</span>}
      <span style={{ color: '#344054' }}>{HANDOVER_NOTE}</span>
    </div>
  );
}
