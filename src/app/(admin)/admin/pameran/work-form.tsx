'use client';

import React, { useEffect, useState } from 'react';
import { COH, TRACKS } from '@/features/exhibition/content';
import type { AdminPersonRow } from '@/features/exhibition/admin-content';
import type { ExhibitionWork, MediaKind, WorkCover, WorkMedia } from '@/features/exhibition/model';

const KIND_LABEL: Record<MediaKind, string> = {
  site: 'Situs (URL)', video: 'Video (URL)', pdf: 'PDF', html: 'Berkas HTML', carousel: 'Carousel gambar',
};
const field: React.CSSProperties = { padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px', backgroundColor: '#ffffff', width: '100%' };
const btn: React.CSSProperties = { padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--color-primary)', backgroundColor: '#ffffff', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' };
const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-main)' };

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Permintaan gagal');
  return data;
}

/**
 * Formulir karya (ubah dan tambah). Unggahan butuh id karya untuk nama folder,
 * jadi karya baru dibuat lebih dulu saat unggahan pertama atau saat disimpan.
 *
 * Work form (edit and add). Uploads need the work id for the folder name, so a new
 * work is created first, on the first upload or on save.
 */
export function WorkForm({ workId, people, collections, onClose }: {
  workId: string | null;
  people: AdminPersonRow[];
  collections: { id: string; title: string }[];
  onClose: (saved: boolean) => void;
}) {
  const [id, setId] = useState<string | null>(workId);
  const [loaded, setLoaded] = useState(workId === null);
  const [personUid, setPersonUid] = useState('');
  const [personQuery, setPersonQuery] = useState('');
  const [type, setType] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tools, setTools] = useState('');
  const [aiAssisted, setAi] = useState(false);
  const [collectionId, setCollectionId] = useState('');
  const [cover, setCover] = useState<WorkCover>({ thumb: '', full: '' });
  const [media, setMedia] = useState<WorkMedia>({ kind: 'site', url: '', slides: [] });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!workId) return;
    api(`/api/pameran/works/${encodeURIComponent(workId)}`).then(({ work }: { work: ExhibitionWork }) => {
      setPersonUid(work.personUid); setType(work.type); setTitle(work.title); setDescription(work.description);
      setTools(work.tools.join(', ')); setAi(work.aiAssisted); setCollectionId(work.collectionId ?? '');
      setCover(work.cover); setMedia(work.media); setLoaded(true);
    }).catch((e) => setError((e as Error).message));
  }, [workId]);

  const person = people.find((p) => p.uid === personUid);
  const types = person ? TRACKS[COH[person.cohort]?.track]?.types ?? [] : [];
  const needle = personQuery.trim().toLowerCase();
  const matches = needle ? people.filter((p) => p.nickname.toLowerCase().includes(needle) || p.fullName.toLowerCase().includes(needle)).slice(0, 8) : [];

  const body = () => ({
    personUid, type, title: title.trim(), description, aiAssisted, cover,
    tools: tools.split(',').map((t) => t.trim()).filter(Boolean), collectionId: collectionId || null,
    // Carousel memakai slides, jenis lain memakai url / Carousel uses slides, other kinds use url
    media: media.kind === 'carousel' ? { kind: media.kind, url: '', slides: media.slides } : { kind: media.kind, url: media.url.trim(), slides: [] },
  });

  async function persist(): Promise<string> {
    if (!personUid || !type || !title.trim()) throw new Error('Peserta, jenis, dan judul wajib diisi');
    if (id) {
      const { personUid: _omit, ...patch } = body();
      await api(`/api/pameran/works/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      return id;
    }
    const created = await api('/api/pameran/works', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body()) });
    setId(created.id);
    return created.id;
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const upload = (kind: 'image' | 'pdf' | 'html', file: File | undefined, done: (r: { url?: string; thumb?: string; full?: string }) => void) =>
    file && run(async () => {
      const workIdNow = await persist();
      const form = new FormData();
      form.append('file', file); form.append('kind', kind); form.append('folder', `karya/${workIdNow}`);
      done(await api('/api/pameran/upload', { method: 'POST', body: form }));
    });

  const move = (i: number, d: number) => setMedia((m) => {
    const s = [...m.slides]; [s[i], s[i + d]] = [s[i + d], s[i]]; return { ...m, slides: s };
  });

  // Tombol Batal tetap ada agar kegagalan memuat tidak mengunci admin / Batal stays so a load failure does not trap the admin
  if (!loaded) return (
    <div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
      <div role={error ? 'alert' : undefined}>{error ?? 'Memuat karya...'}</div>
      <button type="button" style={btn} onClick={() => onClose(false)}>Batal</button>
    </div>
  );

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); run(async () => { await persist(); onClose(true); }); }}
      style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '720px' }}
    >
      <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{workId ? 'Ubah karya' : 'Tambah karya'}</h2>

      <label style={label}>
        Peserta {person && <span style={{ fontWeight: 400 }}>: {person.nickname} ({person.fullName})</span>}
        <input
          aria-label="Cari peserta" placeholder="Ketik nama panggilan atau nama lengkap" value={personQuery}
          onChange={(e) => setPersonQuery(e.target.value)} disabled={!!id} style={field}
        />
      </label>
      {matches.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {matches.map((p) => (
            <button key={p.uid} type="button" style={btn} onClick={() => { setPersonUid(p.uid); setPersonQuery(''); setType(''); }}>
              {p.nickname} · {p.fullName}
            </button>
          ))}
        </div>
      )}

      <label style={label}>Jenis
        <select aria-label="Jenis karya" value={type} onChange={(e) => setType(e.target.value)} style={field}>
          <option value="">{person ? 'Pilih jenis' : 'Pilih peserta dulu'}</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label style={label}>Judul<input value={title} onChange={(e) => setTitle(e.target.value)} style={field} /></label>
      <label style={label}>Deskripsi<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={field} /></label>
      <label style={label}>Alat (pisahkan dengan koma)<input value={tools} onChange={(e) => setTools(e.target.value)} style={field} /></label>
      <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
        <input type="checkbox" checked={aiAssisted} onChange={(e) => setAi(e.target.checked)} /> Dibuat dengan bantuan AI
      </label>
      <label style={label}>Koleksi
        <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} style={field}>
          <option value="">Tanpa koleksi</option>
          {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>

      <div style={label}>
        Gambar sampul
        {cover.thumb && <img src={cover.thumb} alt="Sampul" width={120} style={{ borderRadius: '6px' }} />}
        <input type="file" accept="image/*" aria-label="Unggah sampul" disabled={busy}
          onChange={(e) => upload('image', e.target.files?.[0], (r) => setCover({ thumb: r.thumb ?? '', full: r.full ?? '' }))} />
      </div>

      <div style={label}>
        Media
        <select aria-label="Jenis media" value={media.kind} onChange={(e) => setMedia({ kind: e.target.value as MediaKind, url: '', slides: [] })} style={field}>
          {(Object.keys(KIND_LABEL) as MediaKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        {(media.kind === 'site' || media.kind === 'video') && (
          <input aria-label="URL media" placeholder="https://" value={media.url} onChange={(e) => setMedia({ ...media, url: e.target.value })} style={field} />
        )}
        {(media.kind === 'pdf' || media.kind === 'html') && (
          <>
            {media.url && <a href={media.url} target="_blank" rel="noreferrer" style={{ fontSize: '11px' }}>{media.url}</a>}
            <input type="file" aria-label="Unggah berkas media" disabled={busy}
              accept={media.kind === 'pdf' ? 'application/pdf' : 'text/html'}
              onChange={(e) => upload(media.kind as 'pdf' | 'html', e.target.files?.[0], (r) => setMedia({ ...media, url: r.url ?? '' }))} />
          </>
        )}
        {media.kind === 'carousel' && (
          <>
            {media.slides.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={s} alt={`Slide ${i + 1}`} width={64} loading="lazy" style={{ borderRadius: '4px' }} />
                <button type="button" style={btn} disabled={i === 0} onClick={() => move(i, -1)}>Naik</button>
                <button type="button" style={btn} disabled={i === media.slides.length - 1} onClick={() => move(i, 1)}>Turun</button>
                <button type="button" style={btn} onClick={() => setMedia({ ...media, slides: media.slides.filter((_, j) => j !== i) })}>Hapus</button>
              </div>
            ))}
            <input type="file" accept="image/*" aria-label="Tambah slide" disabled={busy}
              onChange={(e) => upload('image', e.target.files?.[0], (r) => setMedia((m) => ({ ...m, slides: [...m.slides, r.full ?? ''] })))} />
          </>
        )}
      </div>

      {error && <div role="alert" style={{ color: 'var(--color-danger)', fontSize: '11px' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={busy} style={{ ...btn, backgroundColor: 'var(--color-primary)', color: '#ffffff' }}>{busy ? 'Menyimpan...' : 'Simpan'}</button>
        <button type="button" style={btn} onClick={() => onClose(!!id)}>Batal</button>
      </div>
    </form>
  );
}
