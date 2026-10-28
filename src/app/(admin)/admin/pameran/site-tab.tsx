'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BENTO, COH, COHORTS, DOC_BENTO, DOC_HERO, DOC_MASONRY, DOC_POLAROID, DOC_WEEKS, SLIDES, TRACKS } from '@/features/exhibition/content';
import type { SiteContent } from '@/features/exhibition/model';
import { alertBox, api, btnSolid, card, field, label, send, uploadImage } from './admin-ui';

/**
 * Id slot foto yang dipakai halaman publik. Slot doc-<kelas>-... meniru cara
 * dokumentasi/page.tsx menyusun id untuk tampilan "semua kelas" dan per kelas.
 *
 * Photo slot ids used by the public pages. The doc-<cohort>-... slots mirror how
 * dokumentasi/page.tsx builds ids for the "all cohorts" view and each single cohort.
 */
export function buildSlots(): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [{ id: 'hero-poster', name: 'Poster after movie' }];
  SLIDES.forEach((s, i) => out.push({ id: 'doc-' + (i + 1), name: `Slide dokumentasi ${i + 1}: ${s.caption}` }));
  BENTO.forEach((b, i) => { if (b.type === 'photo') out.push({ id: 'bento-' + (i + 1), name: b.label }); });
  [1, 2, 3, 4, 5, 6].forEach((n) => out.push({ id: 'trainer-' + n, name: `Testimoni trainer/fasilitator ${n}` }));

  const seen = new Set<string>();
  const docs: { id: string; name: string }[] = [];
  const add = (id: string, name: string) => { if (!seen.has(id)) { seen.add(id); docs.push({ id, name }); } };
  for (const dc of ['all', ...COHORTS.map((c) => c.key)]) {
    const at = (i: number) => (dc === 'all' ? { co: COHORTS[i % 4], n: Math.floor(i / 4) } : { co: COH[dc], n: i });
    const put = (sec: string, i: number, name: string) => { const { co, n } = at(i); add(`doc-${co.key}-${sec}-${n}`, `Dokumentasi ${co.city}, ${sec}: ${name}`); };
    DOC_HERO.forEach((cap, i) => put('hero', i, cap));
    DOC_WEEKS.forEach(([, cap], i) => put('film', i, cap));
    let pi = 0;
    DOC_BENTO.forEach((b) => { if (!b.word) put('bento', pi++, b.cap ?? ''); });
    (dc === 'all' ? COHORTS : [COH[dc]]).forEach((co) => [0, 1, 2].forEach((n) => add(`doc-${co.key}-kelas-${n}`, `Dokumentasi ${co.city}, kelas ${n + 1}`)));
    DOC_MASONRY.forEach((cap, i) => put('momen', i, cap));
    DOC_POLAROID.forEach((cap, i) => put('kenangan', i, cap));
  }
  return [...out, ...docs];
}

/**
 * Tab Konten Situs: foto per slot, tautan video, dan teks testimoni. Semua disimpan sekali jalan.
 *
 * Site content tab: photo per slot, video links, and testimonial text. Everything is saved at once.
 */
export function SiteTab() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [people, setPeople] = useState<{ uid: string; fullName: string; nickname: string; cohort: string }[]>([]);
  const slots = useMemo(buildSlots, []);

  useEffect(() => { api('/api/pameran/people').then((d) => setPeople(d.people ?? [])).catch(() => {}); }, []);
  useEffect(() => { api('/api/pameran/site').then((d) => setContent(d.content)).catch((e) => setError((e as Error).message)); }, []);
  if (!content) return error ? <div role="alert" style={alertBox}>{error}</div> : <div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)' }}>Memuat konten situs...</div>;

  const edit = (fn: (c: SiteContent) => SiteContent) => { setContent(fn(content)); setSaved(false); };
  const setVideo = (patch: Partial<SiteContent['videos']>) => edit((c) => ({ ...c, videos: { ...c.videos, ...patch } }));

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const onPhoto = (id: string, file?: File) => file && run(async () => {
    const full = (await uploadImage(file, 'situs')).full;
    setContent((c) => c && { ...c, photos: { ...c.photos, [id]: full } }); setSaved(false);
  });
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { photos, captions, videos, testiPeserta, testiTrainer, testiPlan } = content;
      await send('/api/pameran/site', 'PATCH', { photos, captions, videos, testiPeserta, testiTrainer, testiPlan });
      setSaved(true);
    });
  };

  const h2: React.CSSProperties = { fontSize: '13px', fontWeight: 700, margin: 0 };
  const setTrainer = (i: number, patch: Partial<SiteContent['testiTrainer'][number]>) =>
    edit((s) => ({ ...s, testiTrainer: s.testiTrainer.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const setPeserta = (i: number, patch: Partial<SiteContent['testiPeserta'][number]>) =>
    edit((s) => ({ ...s, testiPeserta: s.testiPeserta.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section style={card}>
        <h2 style={h2}>Video</h2>
        <label style={label}>Video after movie
          <input aria-label="Video after movie" placeholder="https://" value={content.videos.afterMovie} onChange={(e) => setVideo({ afterMovie: e.target.value })} style={field} />
        </label>
        <label style={label}>Video Plan Indonesia
          <input value={content.videos.plan} placeholder="https://" onChange={(e) => setVideo({ plan: e.target.value })} style={field} />
        </label>
      </section>

      <section style={card}>
        <h2 style={h2}>Testimoni</h2>
        {content.testiPeserta.map((t, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '10px', borderBottom: '1px solid var(--color-border)' }}>
            <label style={label}>{`Testimoni peserta ${i + 1}: peserta`}
              <select value={t.uid} onChange={(e) => setPeserta(i, { uid: e.target.value })} style={field}>
                <option value="">Pilih peserta</option>
                {people.map((p) => <option key={p.uid} value={p.uid}>{p.nickname} ({p.fullName}, {COH[p.cohort]?.city ?? p.cohort})</option>)}
              </select>
            </label>
            <label style={label}>{`Testimoni peserta ${i + 1}: judul`}
              <input value={t.headline} onChange={(e) => setPeserta(i, { headline: e.target.value })} style={field} />
            </label>
            <label style={label}>{`Testimoni peserta ${i + 1}: cerita`}
              <textarea rows={3} value={t.quote} onChange={(e) => setPeserta(i, { quote: e.target.value })} style={field} />
            </label>
            <label style={label}>{`Testimoni peserta ${i + 1}: video`}
              <input value={t.video ?? ''} placeholder="https://" onChange={(e) => setPeserta(i, { video: e.target.value })} style={field} />
            </label>
            <button type="button" onClick={() => edit((s) => ({ ...s, testiPeserta: s.testiPeserta.filter((_, j) => j !== i) }))} style={{ alignSelf: 'flex-start', fontSize: '11px' }}>Hapus testimoni ini</button>
          </div>
        ))}
        <button type="button" onClick={() => edit((s) => ({ ...s, testiPeserta: [...s.testiPeserta, { uid: '', headline: '', quote: '', video: '' }] }))} style={{ alignSelf: 'flex-start', fontSize: '11px' }}>Tambah testimoni peserta</button>
        {content.testiTrainer.map((t, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={label}>{`Testimoni ${i + 1}: nama (${TRACKS[t.track].name})`}
              <input value={t.name} onChange={(e) => setTrainer(i, { name: e.target.value })} style={field} />
            </label>
            <label style={label}>{`Testimoni ${i + 1}: peran`}
              <select value={t.role ?? 'Trainer'} onChange={(e) => setTrainer(i, { role: e.target.value })} style={field}>
                <option>Trainer</option><option>Fasilitator</option>
              </select>
            </label>
            <label style={label}>{`Testimoni ${i + 1}: kutipan`}
              <textarea rows={2} value={t.quote} onChange={(e) => setTrainer(i, { quote: e.target.value })} style={field} />
            </label>
            <label style={label}>{`Testimoni ${i + 1}: video`}
              <input value={t.video ?? ''} placeholder="https://" onChange={(e) => setTrainer(i, { video: e.target.value })} style={field} />
            </label>
          </div>
        ))}
      </section>

      <section style={card}>
        <h2 style={h2}>Foto ({slots.length} slot)</h2>
        {slots.map((s) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px' }}>
            {content.photos[s.id] ? <img src={content.photos[s.id]} alt="" width={48} height={36} loading="lazy" style={{ objectFit: 'cover', borderRadius: '6px' }} /> : <div style={{ width: 48, height: 36, borderRadius: '6px', backgroundColor: 'var(--color-border)' }} />}
            <span style={{ flex: 1 }}><code>{s.id}</code> {s.name}</span>
            <input aria-label={`Keterangan ${s.id}`} placeholder="Keterangan" value={content.captions?.[s.id] ?? ''} onChange={(e) => edit((c) => ({ ...c, captions: { ...c.captions, [s.id]: e.target.value } }))} style={{ ...field, width: 180 }} />
            <input type="file" accept="image/*" aria-label={`Unggah ${s.id}`} disabled={busy} onChange={(e) => onPhoto(s.id, e.target.files?.[0])} />
          </div>
        ))}
      </section>

      {error && <div role="alert" style={alertBox}>{error}</div>}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button type="submit" style={btnSolid} disabled={busy}>Simpan konten situs</button>
        {saved && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Tersimpan.</span>}
      </div>
    </form>
  );
}
