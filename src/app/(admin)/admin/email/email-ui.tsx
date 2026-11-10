import React from 'react';
import type { EmailCategory } from '@/features/email/model';

// Gaya bersama halaman Email / Shared styles for the Email page
export const panel: React.CSSProperties = { backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' };
export const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' };
export const td: React.CSSProperties = { padding: '8px 10px', fontSize: '11px', borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' };
export const sub: React.CSSProperties = { fontSize: '10px', color: 'var(--color-text-muted)' };

const WARNA: Record<EmailCategory | 'none', [string, string]> = {
  'lulus-magang': ['#E6F4EA', '#067647'],
  'lulus-tanpa-magang': ['#FFF4D6', '#8A5A00'],
  'tidak-lulus': ['#FDECEC', '#B42318'],
  umum: ['#EEF2F7', '#344054'],
  none: ['#EEF2F7', '#667085'],
};

export function Badge({ category, children }: { category: EmailCategory | null; children: React.ReactNode }) {
  const [bg, fg] = WARNA[category ?? 'none'];
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, backgroundColor: bg, color: fg, whiteSpace: 'nowrap' }}>{children}</span>;
}

export const waktu = (iso: string) =>
  iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB' : '';
