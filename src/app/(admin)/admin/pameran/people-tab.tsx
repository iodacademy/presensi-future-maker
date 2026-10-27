'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { COHORTS, TRACKS } from '@/features/exhibition/content';
import type { AdminPersonRow } from '@/features/exhibition/admin-content';
import type { ExhibitionPerson } from '@/features/exhibition/model';
import { alertBox, api, btn, btnSolid, card, field, label, send, uploadImage } from './admin-ui';

const th: React.CSSProperties = { textAlign: 'left', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', padding: '10px 12px', borderBottom: '1px solid var(--color-border)' };
const td: React.CSSProperties = { fontSize: '12px', padding: '10px 12px', borderBottom: '1px solid var(--color-border)' };

/**
 * Tab Peserta: daftar per kelas dan formulir profil. Formulir memuat satu peserta lengkap saat dibuka
 * dan hanya mengirim kolom yang diubah.
 *
 * People tab: list per cohort and a profile form. The form loads the full person when it opens
 * and only sends the fields that were changed.
 */
export function PeopleTab() {
  const [people, setPeople] = useState<AdminPersonRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPersonRow | null>(null);

  const load = useCallback(async () => {
    try { setPeople((await api('/api/pameran/people')).people || []); setError(null); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleVisible(p: AdminPersonRow) {
    try { await send(`/api/pameran/people/${p.uid}`, 'PATCH', { visible: !p.visible }); await load(); } catch (e) { setError((e as Error).message); }
  }

  if (editing) return <PersonForm person={editing} onClose={(saved) => { setEditing(null); if (saved) load(); }} />;

  return (
    <>
      {error && <div role="alert" style={alertBox}>{error}</div>}
      {COHORTS.map((c) => {
        const rows = people.filter((p) => p.cohort === c.key);
        return (
          <div key={c.key} style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', overflowX: 'auto' }}>
            <div style={{ padding: '12px', fontSize: '12px', fontWeight: 700 }}>{TRACKS[c.track].name} · {c.city} ({rows.length})</div>
            <table style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Nama lengkap</th><th style={th}>Nama panggilan</th><th style={th}>Tampil</th><th style={th}>Karya</th><th style={th} /></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.uid}>
                    <td style={td}>{p.fullName}</td>
                    <td style={td}>{p.nickname}</td>
                    <td style={td}><input type="checkbox" aria-label={`Tampilkan ${p.fullName}`} checked={p.visible} onChange={() => toggleVisible(p)} /></td>
                    <td style={td}>{p.workCount}</td>
                    <td style={td}><button type="button" style={btn} onClick={() => setEditing(p)}>Ubah</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

type Draft = { nickname?: string; photoUrl?: string; bio?: string; skills?: string; linkedinUrl?: string; portfolioUrl?: string; visible?: boolean; mainWorkId?: string };

function PersonForm({ person, onClose }: { person: AdminPersonRow; onClose: (saved: boolean) => void }) {
  const [draft, setDraft] = useState<Draft>({});
  const [works, setWorks] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (d: Draft) => setDraft((o) => ({ ...o, ...d }));
  // Nilai tersimpan dimuat saat formulir dibuka / Stored values are loaded when the form opens
  const [stored, setStored] = useState<Partial<ExhibitionPerson>>({});

  useEffect(() => {
    api(`/api/pameran/people/${person.uid}`).then((d: { person: ExhibitionPerson }) => setStored(d.person)).catch((e) => setError((e as Error).message));
  }, [person.uid]);

  useEffect(() => {
    // Daftar karya difilter di klien / Works list is filtered on the client
    api('/api/pameran/works').then((d: { works: { id: string; title: string; personUid: string }[] }) =>
      setWorks(d.works.filter((w) => w.personUid === person.uid))).catch((e) => setError((e as Error).message));
  }, [person.uid]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { skills, mainWorkId, ...rest } = draft;
    const patch: Partial<ExhibitionPerson> = { ...rest };
    if (skills !== undefined) patch.skills = skills.split(',').map((s) => s.trim()).filter(Boolean);
    if (mainWorkId !== undefined) patch.mainWorkId = mainWorkId || null;
    setBusy(true); setError(null);
    try {
      if (Object.keys(patch).length) await send(`/api/pameran/people/${person.uid}`, 'PATCH', patch);
      onClose(true);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(null);
    try { set({ photoUrl: (await uploadImage(file, `peserta/${person.uid}`)).full }); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  const photo = draft.photoUrl ?? stored.photoUrl ?? person.photoUrl;
  return (
    <form onSubmit={save} style={card}>
      <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Ubah peserta: {person.fullName}</h2>
      <label style={label}>Nama panggilan<input value={draft.nickname ?? stored.nickname ?? person.nickname} onChange={(e) => set({ nickname: e.target.value })} style={field} /></label>
      <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
        <input type="checkbox" checked={draft.visible ?? stored.visible ?? person.visible} onChange={(e) => set({ visible: e.target.checked })} /> Tampil di pameran
      </label>
      <div style={label}>
        Foto
        {photo && <img src={photo} alt="Foto peserta" width={96} style={{ borderRadius: '8px' }} />}
        <input type="file" accept="image/*" aria-label="Unggah foto" disabled={busy} onChange={(e) => onPhoto(e.target.files?.[0])} />
      </div>
      <label style={label}>Bio<textarea rows={4} value={draft.bio ?? stored.bio ?? ''} onChange={(e) => set({ bio: e.target.value })} style={field} /></label>
      <label style={label}>Keahlian (pisahkan dengan koma)<input value={draft.skills ?? (stored.skills ?? []).join(', ')} onChange={(e) => set({ skills: e.target.value })} style={field} /></label>
      <label style={label}>LinkedIn<input value={draft.linkedinUrl ?? stored.linkedinUrl ?? ''} placeholder="https://" onChange={(e) => set({ linkedinUrl: e.target.value })} style={field} /></label>
      <label style={label}>Portofolio<input value={draft.portfolioUrl ?? stored.portfolioUrl ?? ''} placeholder="https://" onChange={(e) => set({ portfolioUrl: e.target.value })} style={field} /></label>
      <label style={label}>Karya utama
        <select aria-label="Karya utama" value={draft.mainWorkId ?? stored.mainWorkId ?? person.mainWorkId ?? ''} onChange={(e) => set({ mainWorkId: e.target.value })} style={field}>
          <option value="">Otomatis</option>
          {works.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
        </select>
      </label>
      {error && <div role="alert" style={{ color: 'var(--color-danger)', fontSize: '11px' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={busy} style={btnSolid}>{busy ? 'Menyimpan...' : 'Simpan'}</button>
        <button type="button" style={btn} onClick={() => onClose(false)}>Batal</button>
      </div>
    </form>
  );
}
