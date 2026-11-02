'use client';

import React, { useEffect, useState } from 'react';
import { alertBox, btnSolid, card, field, label } from '@/app/(admin)/admin/pameran/admin-ui';
import { PartnerLogo } from '@/features/careers/job-card';
import type { Logo, Socials } from '@/features/careers/model';
import { h1, MitraShell, sub } from '../shell';

type Profile = { name: string; field: string; about: string; website: string; socials: Socials; logo: Logo | null };
const SOCIALS: [keyof Socials, string][] = [['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['tiktok', 'TikTok'], ['youtube', 'YouTube']];

/**
 * Profil perusahaan yang dilihat siswa. Nama dan daftar PIC diatur admin Future Makers.
 *
 * The company profile students see. The name and PIC list are managed by Future Makers admins.
 */
export default function ProfilPage() {
  const [p, setP] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch('/api/mitra/profile').then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setP(d.partner); }).catch((e) => setError(e.message)); }, []);

  async function uploadLogo(file: File) {
    setBusy(true); setError(null);
    try {
      const form = new FormData(); form.append('file', file);
      const r = await fetch('/api/mitra/logo', { method: 'POST', body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setP((x) => (x ? { ...x, logo: d } : x));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setSaved(false);
    try {
      const r = await fetch('/api/mitra/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
      if (!r.ok) throw new Error((await r.json()).error);
      setSaved(true);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <MitraShell>
      <div><h1 style={h1}>Profil perusahaan</h1><p style={sub}>Profil ini tampil untuk siswa di Portal Karier. Nama perusahaan dan daftar PIC diatur admin Future Makers.</p></div>
      {error && <div role="alert" style={alertBox}>{error}</div>}
      {p && (
        <form onSubmit={save} style={{ ...card, maxWidth: '720px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <PartnerLogo name={p.name} logo={p.logo?.thumb ?? null} size={56} />
            <div><b>{p.name}</b>
              <label style={{ ...label, marginTop: '6px' }}>Ganti logo (JPG, PNG, WebP)
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} style={field} />
              </label>
            </div>
          </div>
          <label style={label}>Bidang usaha<input value={p.field} onChange={(e) => setP({ ...p, field: e.target.value })} style={field} /></label>
          <label style={label}>Deskripsi singkat<textarea rows={4} value={p.about} onChange={(e) => setP({ ...p, about: e.target.value })} style={field} /></label>
          <label style={label}>Situs web<input value={p.website} onChange={(e) => setP({ ...p, website: e.target.value })} style={field} placeholder="https://…" /></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {SOCIALS.map(([k, l]) => (
              <label key={k} style={label}>{l}<input value={p.socials[k]} onChange={(e) => setP({ ...p, socials: { ...p.socials, [k]: e.target.value } })} style={field} placeholder="https://…" /></label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end' }}>
            {saved && <span role="status" style={{ fontSize: '11px', color: '#067647' }}>Tersimpan.</span>}
            <button type="submit" style={btnSolid} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </form>
      )}
    </MitraShell>
  );
}
