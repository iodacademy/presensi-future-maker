'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { alertBox, api, btn, btnSolid, card, field, label, send, uploadImage } from '../pameran/admin-ui';
import { PartnerLogo } from '@/features/careers/job-card';
import type { Logo, PartnerPic, Socials } from '@/features/careers/model';

const SOCIALS: [keyof Socials, string, string][] = [
  ['instagram', 'Instagram', 'https://instagram.com/…'],
  ['linkedin', 'LinkedIn', 'https://linkedin.com/company/…'],
  ['tiktok', 'TikTok', 'https://tiktok.com/@…'],
  ['youtube', 'YouTube', 'https://youtube.com/@…'],
];
const emptyPic = (): PartnerPic => ({ name: '', phone: '', email: '' });

/**
 * Formulir tambah dan ubah mitra beserta PIC dan profil yang dilihat siswa.
 *
 * Add and edit form for a partner, its PICs, and the profile students see.
 */
export function PartnerForm({ id, onDone }: { id: string | null; onDone: () => void }) {
  const [name, setName] = useState('');
  const [fieldText, setFieldText] = useState('');
  const [about, setAbout] = useState('');
  const [website, setWebsite] = useState('');
  const [socials, setSocials] = useState<Socials>({ instagram: '', linkedin: '', tiktok: '', youtube: '' });
  const [pics, setPics] = useState<PartnerPic[]>([emptyPic()]);
  const [logo, setLogo] = useState<Logo | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Id mitra baru disimpan agar percobaan ulang setelah logo gagal tidak membuat mitra kedua
  // A new partner's id is kept so a retry after a failed logo upload does not create a second partner
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [accountNote, setAccountNote] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api(`/api/karier/partners/${id}`).then(({ partner: p }) => {
      setName(p.name); setFieldText(p.field); setAbout(p.about); setWebsite(p.website);
      setSocials(p.socials); setPics(p.pics.length ? p.pics : [emptyPic()]); setLogo(p.logo);
    }).catch((e) => setError(e.message));
  }, [id]);

  const setPic = (i: number, patch: Partial<PartnerPic>) => setPics((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const body = { name, field: fieldText, about, website, socials, pics, logo };
      let pid = id ?? createdId;
      if (pid) await send(`/api/karier/partners/${pid}`, 'PATCH', body);
      else {
        pid = (await send('/api/karier/partners', 'POST', body)).id as string;
        setCreatedId(pid);
      }
      // Logo diunggah ke folder mitra/<id>, jadi mitra baru disimpan dulu agar id-nya ada
      // The logo goes to the mitra/<id> folder, so a new partner is saved first to get its id
      if (logoFile) {
        const uploaded = await uploadImage(logoFile, `mitra/${pid}`);
        await send(`/api/karier/partners/${pid}`, 'PATCH', { ...body, logo: uploaded });
      }
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const fileUrl = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : null), [logoFile]);
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);
  const preview = fileUrl ?? logo?.thumb ?? null;

  return (
    <form onSubmit={save} style={{ ...card, maxWidth: '760px' }}>
      <button type="button" onClick={onDone} style={{ ...btn, alignSelf: 'flex-start', border: 'none', padding: 0 }}>← Kembali</button>
      <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{id ? 'Ubah mitra & PIC' : 'Tambah mitra & PIC'}</h2>
      {error && <div role="alert" style={alertBox}>{error}</div>}

      <label style={label}>Nama perusahaan
        <input value={name} onChange={(e) => setName(e.target.value)} style={field} required placeholder="mis. PT DIPSI" />
        <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '10px' }}>Harus unik, jadi kunci rute lamaran ke PIC.</span>
      </label>
      <label style={label}>Bidang usaha<input value={fieldText} onChange={(e) => setFieldText(e.target.value)} style={field} placeholder="mis. Software house" /></label>
      <label style={label}>Deskripsi singkat (tampil di profil perusahaan untuk siswa)
        <textarea rows={3} value={about} onChange={(e) => setAbout(e.target.value)} style={field} />
      </label>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <PartnerLogo name={name || '?'} logo={preview} size={56} />
        <label style={{ ...label, flex: 1 }}>Logo (JPG, PNG, atau WebP)
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} style={field} />
        </label>
      </div>

      <label style={label}>Situs web<input value={website} onChange={(e) => setWebsite(e.target.value)} style={field} placeholder="https://…" /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        {SOCIALS.map(([k, l, ph]) => (
          <label key={k} style={label}>{l}
            <input value={socials[k]} onChange={(e) => setSocials({ ...socials, [k]: e.target.value })} style={field} placeholder={ph} />
          </label>
        ))}
      </div>

      <h3 style={{ fontSize: '12px', fontWeight: 700, margin: '8px 0 0' }}>PIC</h3>
      <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: 0 }}>
        Satu perusahaan bisa punya lebih dari satu PIC. Akun login PIC dibuat saat portal mitra dibuka.
      </p>
      {pics.map((p, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr)) auto', gap: '8px', alignItems: 'end' }}>
          <label style={label}>Nama PIC<input value={p.name} onChange={(e) => setPic(i, { name: e.target.value })} style={field} /></label>
          <label style={label}>No. HP PIC<input value={p.phone} onChange={(e) => setPic(i, { phone: e.target.value })} style={field} /></label>
          <label style={label}>Email PIC<input type="email" value={p.email} onChange={(e) => setPic(i, { email: e.target.value })} style={field} /></label>
          <button type="button" style={btn} disabled={pics.length === 1} onClick={() => setPics(pics.filter((_, j) => j !== i))} aria-label={`Hapus PIC ${i + 1}`}>Hapus</button>
        </div>
      ))}
      <button type="button" style={{ ...btn, alignSelf: 'flex-start' }} onClick={() => setPics([...pics, emptyPic()])}>+ Tambah PIC</button>

      {id && (
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <b style={{ fontSize: '12px' }}>Login portal mitra</b>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
            PIC masuk di halaman login dengan emailnya. Simpan perubahan PIC dulu sebelum mengaktifkan login.
          </span>
          <button type="button" style={{ ...btn, alignSelf: 'flex-start' }} disabled={busy}
            onClick={async () => {
              setError(null); setAccountNote(null);
              try {
                const r = await send(`/api/karier/partners/${id}/accounts`, 'POST', {});
                setAccountNote(`Login aktif: ${[...r.created, ...r.existing].join(', ')}${r.created.length ? ` (baru: ${r.created.length})` : ''}`);
              } catch (err) { setError((err as Error).message); }
            }}>Aktifkan login PIC</button>
          {accountNote && <span role="status" style={{ fontSize: '11px', color: 'var(--color-success, #067647)' }}>{accountNote}</span>}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button type="button" style={btn} onClick={onDone}>Batal</button>
        <button type="submit" style={btnSolid} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
      </div>
    </form>
  );
}
