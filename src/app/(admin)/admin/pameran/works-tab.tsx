'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { COHORTS, TRACKS } from '@/features/exhibition/content';
import type { AdminWorkRow } from '@/features/exhibition/admin-works';
import type { AdminPersonRow } from '@/features/exhibition/admin-content';
import type { WorkStatus } from '@/features/exhibition/model';
import { WorkForm } from './work-form';

type Collection = { id: string; title: string };
const STATUS_LABEL: Record<WorkStatus, string> = { draft: 'Draf', published: 'Terbit', hidden: 'Disembunyikan' };
const TYPES = Array.from(new Set(Object.values(TRACKS).flatMap((t) => t.types)));

const th: React.CSSProperties = { textAlign: 'left', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', padding: '10px 12px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { fontSize: '12px', color: 'var(--color-text-main)', padding: '10px 12px', borderBottom: '1px solid var(--color-border)', verticalAlign: 'middle' };
const field: React.CSSProperties = { padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px', backgroundColor: '#ffffff' };
const btn: React.CSSProperties = { padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--color-primary)', backgroundColor: '#ffffff', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' };
const btnSolid: React.CSSProperties = { ...btn, backgroundColor: 'var(--color-primary)', color: '#ffffff' };

/**
 * Tab Karya: daftar semua karya, saringan sisi klien, aksi massal, dan formulir karya.
 *
 * Works tab: every work, client-side filters, bulk actions, and the work form.
 */
export function WorksTab() {
  const [works, setWorks] = useState<AdminWorkRow[]>([]);
  const [people, setPeople] = useState<AdminPersonRow[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cohort, setCohort] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [collection, setCollection] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // undefined = formulir tertutup, null = karya baru, string = id karya / undefined = closed, null = new work, string = work id
  const [editing, setEditing] = useState<string | null | undefined>(undefined);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [w, p, c] = await Promise.all(['works', 'people', 'collections'].map(async (k) => {
        const res = await fetch(`/api/pameran/${k}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Gagal memuat ${k}`);
        return data;
      }));
      setWorks(w.works || []); setPeople(p.people || []); setCollections(c.collections || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return works.filter((w) =>
      (!cohort || w.cohort === cohort) && (!type || w.type === type) && (!status || w.status === status) &&
      (!collection || (collection === '-' ? !w.collectionId : w.collectionId === collection)) &&
      (!needle || w.title.toLowerCase().includes(needle) || w.nickname.toLowerCase().includes(needle)));
  }, [works, cohort, type, status, collection, query]);

  async function bulk(ids: string[], patch: Record<string, unknown>) {
    if (ids.length === 0) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/pameran/works/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aksi massal gagal');
      setPicked(new Set());
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function publishShown() {
    if (!confirm(`Terbitkan ${shown.length} karya yang tampil?`)) return;
    bulk(shown.map((w) => w.id), { status: 'published' });
  }
  const ids = [...picked];
  const allShown = shown.length > 0 && shown.every((w) => picked.has(w.id));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setPicked(allShown ? new Set() : new Set(shown.map((w) => w.id)));

  if (editing !== undefined) {
    return <WorkForm workId={editing} people={people} collections={collections} onClose={(saved) => { setEditing(undefined); if (saved) load(); }} />;
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select aria-label="Kelas" value={cohort} onChange={(e) => setCohort(e.target.value)} style={field}>
          <option value="">Semua kelas</option>
          {COHORTS.map((c) => <option key={c.key} value={c.key}>{TRACKS[c.track].short} · {c.city}</option>)}
        </select>
        <select aria-label="Jenis" value={type} onChange={(e) => setType(e.target.value)} style={field}>
          <option value="">Semua jenis</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} style={field}>
          <option value="">Semua status</option>
          {(Object.keys(STATUS_LABEL) as WorkStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select aria-label="Koleksi" value={collection} onChange={(e) => setCollection(e.target.value)} style={field}>
          <option value="">Semua koleksi</option>
          <option value="-">Tanpa koleksi</option>
          {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <input aria-label="Cari karya" placeholder="Cari judul atau nama" value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...field, flex: 1, minWidth: '160px' }} />
        <button type="button" style={btnSolid} onClick={() => setEditing(null)}>Tambah karya</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={btnSolid} disabled={busy || shown.length === 0} onClick={publishShown}>Terbitkan semua yang tampil</button>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{picked.size} dipilih dari {shown.length} tampil</span>
        {([
          ['Terbitkan', { status: 'published' }], ['Sembunyikan', { status: 'hidden' }], ['Jadikan draf', { status: 'draft' }],
          ['Nyalakan label AI', { aiAssisted: true }], ['Matikan label AI', { aiAssisted: false }],
        ] as const).map(([label, patch]) => (
          <button key={label} type="button" style={btn} disabled={busy || picked.size === 0} onClick={() => bulk(ids, patch)}>{label}</button>
        ))}
        <select
          aria-label="Masukkan ke koleksi" value="" disabled={busy || picked.size === 0} style={field}
          onChange={(e) => e.target.value && bulk(ids, { collectionId: e.target.value === '-' ? null : e.target.value })}
        >
          <option value="">Masukkan ke koleksi</option>
          <option value="-">Keluarkan dari koleksi</option>
          {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

      {error && <div role="alert" style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', borderRadius: '12px', padding: '12px 16px', fontSize: '11px' }}>{error}</div>}

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>Memuat karya...</div>
      ) : (
        <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: '36px' }}><input type="checkbox" aria-label="Pilih semua yang tampil" checked={allShown} onChange={toggleAll} /></th>
                <th style={th}>Karya</th><th style={th}>Peserta</th><th style={th}>Jenis</th><th style={th}>Kelas</th><th style={th}>Status</th><th style={th}>AI</th><th style={th} />
              </tr>
            </thead>
            <tbody>
              {shown.map((w) => (
                <tr key={w.id}>
                  <td style={td}><input type="checkbox" aria-label={`Pilih ${w.title}`} checked={picked.has(w.id)} onChange={() => toggle(w.id)} /></td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {w.thumb ? <img src={w.thumb} alt="" loading="lazy" width={48} height={36} style={{ objectFit: 'cover', borderRadius: '6px' }} /> : <div style={{ width: 48, height: 36, borderRadius: '6px', backgroundColor: 'var(--color-border)' }} />}
                      <span>{w.title}</span>
                    </div>
                  </td>
                  <td style={td}>{w.nickname}</td>
                  <td style={td}>{w.type}</td>
                  <td style={td}>{w.cohort}</td>
                  <td style={td}>{STATUS_LABEL[w.status]}</td>
                  <td style={td}>{w.aiAssisted ? 'Ya' : '-'}</td>
                  <td style={td}><button type="button" style={btn} onClick={() => setEditing(w.id)}>Ubah</button></td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: 'var(--color-text-muted)' }}>Tidak ada karya yang cocok</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
