'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BENTO, COH, COHORTS, DOC_BENTO, DOC_HERO, DOC_MASONRY, DOC_WEEKS, SLIDES, TRACKS } from '@/features/exhibition/content';
import type { TrackKey } from '@/features/exhibition/content';
import type { SiteContent } from '@/features/exhibition/model';
import { alertBox, api, btnSolid, card, field, label, send, uploadImage } from './admin-ui';

/**
 * Id slot foto yang dipakai halaman publik. Slot doc-<kelas>-... meniru cara
 * dokumentasi/page.tsx menyusun id untuk tampilan "semua kelas" dan per kelas.
 *
 * Photo slot ids used by the public pages. The doc-<cohort>-... slots mirror how
 * dokumentasi/page.tsx builds ids for the "all cohorts" view and each single cohort.
 */
function buildSlots(): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [{ id: 'hero-poster', name: 'Poster after movie' }];
  SLIDES.forEach((s, i) => out.push({ id: 'doc-' + (i + 1), name: `Slide dokumentasi ${i + 1}: ${s.caption}` }));
  BENTO.forEach((b, i) => { if (b.type === 'photo') out.push({ id: 'bento-' + (i + 1), name: b.label }); });
  COHORTS.forEach((c) => out.push({ id: 'best-' + c.key, name: `Karya terbaik ${c.city}` }, { id: 'testi-' + c.key, name: `Testimoni ${c.city}` }));
  (Object.keys(TRACKS) as TrackKey[]).forEach((t) => out.push({ id: 'trainer-' + t, name: `Trainer ${TRACKS[t].name}` }));
  out.push({ id: 'testi-plan', name: 'Testimoni Plan Indonesia' });

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
  const slots = useMemo(buildSlots, []);

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
      const { photos, videos, testiPeserta, testiTrainer, testiPlan } = content;
      await send('/api/pameran/site', 'PATCH', { photos, videos, testiPeserta, testiTrainer, testiPlan });
      setSaved(true);
    });
  };

  const h2: React.CSSProperties = { fontSize: '13px', fontWeight: 700, margin: 0 };
  const setTrainer = (i: number, patch: Partial<SiteContent['testiTrainer'][number]>) =>
    edit((s) => ({ ...s, testiTrainer: s.testiTrainer.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section style={card}>
        <h2 style={h2}>Video</h2>
        <label style={label}>Video after movie
          <input aria-label="Video after movie" placeholder="https://" value={content.videos.afterMovie} onChange={(e) => setVideo({ afterMovie: e.target.value })} style={field} />
        </label>
        {COHORTS.map((c) => (
          <label key={c.key} style={label}>Video peserta {c.city}
            <input value={content.videos.peserta[c.key] ?? ''} placeholder="https://" onChange={(e) => setVideo({ peserta: { ...content.videos.peserta, [c.key]: e.target.value } })} style={field} />
          </label>
        ))}
        {(Object.keys(TRACKS) as TrackKey[]).map((t) => (
          <label key={t} style={label}>Video trainer {TRACKS[t].name}
            <input value={content.videos.trainer[t] ?? ''} placeholder="https://" onChange={(e) => setVideo({ trainer: { ...content.videos.trainer, [t]: e.target.value } })} style={field} />
          </label>
        ))}
        <label style={label}>Video Plan Indonesia
          <input value={content.videos.plan} placeholder="https://" onChange={(e) => setVideo({ plan: e.target.value })} style={field} />
        </label>
      </section>

      <section style={card}>
        <h2 style={h2}>Testimoni</h2>
        {COHORTS.map((c) => (
          <label key={c.key} style={label}>Peserta {c.city}
            <textarea rows={2} value={content.testiPeserta[c.key] ?? ''} onChange={(e) => edit((s) => ({ ...s, testiPeserta: { ...s.testiPeserta, [c.key]: e.target.value } }))} style={field} />
          </label>
        ))}
        {content.testiTrainer.map((t, i) => (
          <div key={t.track} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={label}>Nama trainer {TRACKS[t.track].name}
              <input value={t.name} onChange={(e) => setTrainer(i, { name: e.target.value })} style={field} />
            </label>
            <label style={label}>Kutipan trainer {TRACKS[t.track].name}
              <textarea rows={2} value={t.quote} onChange={(e) => setTrainer(i, { quote: e.target.value })} style={field} />
            </label>
          </div>
        ))}
        {([['name', 'nama'], ['role', 'jabatan'], ['quote', 'kutipan']] as const).map(([k, name]) => (
          <label key={k} style={label}>Plan Indonesia: {name}
            <input value={content.testiPlan[k]} onChange={(e) => edit((s) => ({ ...s, testiPlan: { ...s.testiPlan, [k]: e.target.value } }))} style={field} />
          </label>
        ))}
      </section>

      <section style={card}>
        <h2 style={h2}>Foto ({slots.length} slot)</h2>
        {slots.map((s) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px' }}>
            {content.photos[s.id] ? <img src={content.photos[s.id]} alt="" width={48} height={36} loading="lazy" style={{ objectFit: 'cover', borderRadius: '6px' }} /> : <div style={{ width: 48, height: 36, borderRadius: '6px', backgroundColor: 'var(--color-border)' }} />}
            <span style={{ flex: 1 }}><code>{s.id}</code> {s.name}</span>
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
