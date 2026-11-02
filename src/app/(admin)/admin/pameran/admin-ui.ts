import type React from 'react';

// Gaya dan pemanggil API yang dipakai bersama oleh tab Peserta, Koleksi, dan Konten Situs
// Styles and API caller shared by the Peserta, Koleksi, and Konten Situs tabs
// fontFamily inherit: textarea dan input tanggal memakai huruf monospace bawaan peramban bila tidak diatur / textarea and date inputs fall back to the browser's monospace font otherwise
export const field: React.CSSProperties = { padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px', fontFamily: 'inherit', backgroundColor: '#ffffff', width: '100%' };
export const btn: React.CSSProperties = { padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--color-primary)', backgroundColor: '#ffffff', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' };
export const btnSolid: React.CSSProperties = { ...btn, backgroundColor: 'var(--color-primary)', color: '#ffffff' };
export const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-main)' };
export const card: React.CSSProperties = { backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '720px' };
export const alertBox: React.CSSProperties = { backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', borderRadius: '12px', padding: '12px 16px', fontSize: '11px' };

export async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Permintaan gagal');
  return data;
}

export const send = (url: string, method: string, body: unknown) =>
  api(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export async function uploadImage(file: File, folder: string): Promise<{ thumb: string; full: string }> {
  const form = new FormData();
  form.append('file', file); form.append('kind', 'image'); form.append('folder', folder);
  return api('/api/pameran/upload', { method: 'POST', body: form });
}
