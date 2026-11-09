import type React from 'react';

// Gaya bersama halaman Karier, mengikuti mockup Portal Karier / Shared Karier page styles, per the Portal Karier mockup
export const BLUE = '#0072CE';
export const INK = '#243c4b';
export const MUTED = '#5b6b75';
export const LINE = '#e5e7eb';

export const pageWrap: React.CSSProperties = { padding: '24px 28px 96px', display: 'flex', flexDirection: 'column', gap: '18px', fontFamily: 'Inter, Arial, sans-serif', color: INK, fontSize: '14px', lineHeight: 1.5, maxWidth: '1180px', width: '100%' };
export const heading: React.CSSProperties = { fontFamily: 'var(--font-heading)', fontWeight: 700, color: INK, margin: 0 };
export const card: React.CSSProperties = { backgroundColor: '#ffffff', border: `1px solid ${LINE}`, borderRadius: '12px', padding: '20px' };
export const btnPrimary: React.CSSProperties = { padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: BLUE, color: '#ffffff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' };
export const btnOutline: React.CSSProperties = { ...btnPrimary, backgroundColor: '#ffffff', color: BLUE, border: `1px solid ${BLUE}` };
export const btnGhost: React.CSSProperties = { ...btnPrimary, backgroundColor: 'transparent', color: BLUE, padding: '6px 0' };
export const input: React.CSSProperties = { padding: '10px 12px', borderRadius: '8px', border: `1px solid ${LINE}`, fontSize: '14px', fontFamily: 'inherit', color: INK, backgroundColor: '#ffffff', width: '100%', boxSizing: 'border-box' };
export const fieldLabel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 };
export const hint: React.CSSProperties = { fontSize: '12px', fontWeight: 400, color: MUTED };
export const errorBox: React.CSSProperties = { backgroundColor: '#FDECEA', color: '#B42318', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' };
export const pill = (bg: string, fg: string): React.CSSProperties => ({ padding: '3px 10px', borderRadius: '999px', backgroundColor: bg, color: fg, fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' });

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Permintaan gagal');
  return data as T;
}

export const STATUS_PILL: Record<string, [string, string]> = {
  Terkirim: ['#E6F1FB', BLUE], 'Dilihat mitra': ['#F5F3FF', '#6D28D9'], 'Lolos ke tahap interview': ['#FFF7E0', '#946200'],
  Lolos: ['#ECFDF3', '#067647'], 'Tawaran diterima': ['#067647', '#ffffff'], 'Belum lolos': ['#F3F4F6', MUTED],
  'Tawaran ditolak': ['#F3F4F6', MUTED], Ditutup: ['#F3F4F6', MUTED],
};

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
