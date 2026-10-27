'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { COHORTS, TRACKS } from '@/features/exhibition/content';
import { alertBox, api, btn, btnSolid, card, field, label, send } from './admin-ui';

type Row = { id: string; title: string; brief: string; cohort: string; type: string; count: number };

/**
 * Tab Koleksi: daftar dengan jumlah karya, buat koleksi, dan ubah judul serta ringkasan.
 *
 * Collections tab: list with work counts, create, and edit title and brief.
 */
export function CollectionsTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [cohort, setCohort] = useState('');
  const [type, setType] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);

  const load = useCallback(async () => {
    try { setRows((await api('/api/pameran/collections')).collections || []); setError(null); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const track = COHORTS.find((c) => c.key === cohort)?.track;
  const types = track ? TRACKS[track].types : [];

  return (
    <>
      {error && <div role="alert" style={alertBox}>{error}</div>}
      <form
        style={card}
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await send('/api/pameran/collections', 'POST', { title: title.trim(), brief, cohort, type, classId: '', coverUrls: [] });
            setTitle(''); setBrief(''); setType('');
          });
        }}
      >
        <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Koleksi baru</h2>
        <label style={label}>Judul<input aria-label="Judul koleksi" value={title} onChange={(e) => setTitle(e.target.value)} style={field} /></label>
        <label style={label}>Ringkasan<textarea aria-label="Ringkasan koleksi" rows={2} value={brief} onChange={(e) => setBrief(e.target.value)} style={field} /></label>
        <label style={label}>Kelas
          <select aria-label="Kelas koleksi" value={cohort} onChange={(e) => { setCohort(e.target.value); setType(''); }} style={field}>
            <option value="">Pilih kelas</option>
            {COHORTS.map((c) => <option key={c.key} value={c.key}>{TRACKS[c.track].short} · {c.city}</option>)}
          </select>
        </label>
        <label style={label}>Jenis
          <select aria-label="Jenis koleksi" value={type} onChange={(e) => setType(e.target.value)} style={field}>
            <option value="">{cohort ? 'Pilih jenis' : 'Pilih kelas dulu'}</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <div><button type="submit" style={btnSolid} disabled={busy || !title.trim() || !cohort || !type}>Buat koleksi</button></div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map((c) => (
          <div key={c.id} style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px 16px', fontSize: '12px' }}>
            {editing?.id === c.id ? (
              <form
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                onSubmit={(e) => { e.preventDefault(); run(async () => { await send(`/api/pameran/collections/${c.id}`, 'PATCH', { title: editing.title.trim(), brief: editing.brief }); setEditing(null); }); }}
              >
                <input aria-label="Ubah judul" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} style={field} />
                <textarea aria-label="Ubah ringkasan" rows={2} value={editing.brief} onChange={(e) => setEditing({ ...editing, brief: e.target.value })} style={field} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" style={btnSolid} disabled={busy}>Simpan</button>
                  <button type="button" style={btn} onClick={() => setEditing(null)}>Batal</button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
                <span><strong>{c.title}</strong> · {c.cohort} · {c.type} · {c.count} karya</span>
                <button type="button" style={btn} onClick={() => setEditing(c)}>Ubah</button>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Belum ada koleksi.</div>}
      </div>
    </>
  );
}
