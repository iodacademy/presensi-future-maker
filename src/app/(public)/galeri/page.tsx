'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { COH, DATA, PAGE_SIZE, TRACKS, TYPE, card } from '@/features/exhibition/content';
import { CohortHead, Field, Hv, WorkCard, css } from '@/features/exhibition/ui';

/**
 * Filter awal dibaca dari ?kelas= atau ?jurusan= agar tombol "Karya kelas
 * ini" di halaman lain bisa membuka galeri yang sudah tersaring.
 *
 * The initial filter is read from ?kelas= or ?jurusan= so the "Karya kelas
 * ini" buttons on other pages can open an already-filtered gallery.
 */
export default function GalleryPage() {
  return (
    <Suspense>
      <GalleryFromParams />
    </Suspense>
  );
}

function GalleryFromParams() {
  const params = useSearchParams();
  const kelas = params.get('kelas') ?? '';
  const jurusan = params.get('jurusan') ?? '';
  return <Gallery key={params.toString()} initialCohort={COH[kelas] ? kelas : 'all'} initialTrack={jurusan in TRACKS ? jurusan : 'all'} />;
}

function Gallery({ initialCohort, initialTrack }: { initialCohort: string; initialTrack: string }) {
  const [cohort, setCohort] = useState(initialCohort);
  const [track, setTrack] = useState(initialTrack);
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const qq = q.trim().toLowerCase();
  const filtered = DATA.works.filter((w) => (track === 'all' || w.track === track) && (cohort === 'all' || w.cohort === cohort) && (type === 'all' || w.type === type) &&
    (!qq || w.title.toLowerCase().includes(qq) || DATA.P[w.person].name.toLowerCase().includes(qq)));
  const ctxTrack = cohort !== 'all' ? COH[cohort].track : track;
  const typeList = ctxTrack !== 'all' ? TRACKS[ctxTrack as keyof typeof TRACKS].types : Object.keys(TYPE);
  const hasFilter = cohort !== 'all' || track !== 'all' || type !== 'all' || !!q;
  const reset = () => { setCohort('all'); setTrack('all'); setType('all'); setQ(''); setLimit(PAGE_SIZE); };

  return (
    <>
      <CohortHead
        cohort={cohort} track={track} allColor="#DC0080" allFg="#FFFFFF" eyebrowAll="Pameran karya Future Makers 2026" allLabel="Tiga jurusan"
        title="Galeri karya" intro="Pilih kelas, lalu saring berdasarkan jenis karya atau cari nama peserta."
        count={(k) => (k === 'all' ? DATA.works.length : DATA.works.filter((w) => w.cohort === k).length) + ' karya'}
        pick={(k) => { setCohort(k); setTrack('all'); setType('all'); setLimit(PAGE_SIZE); }}
      />
      <div style={css('background:#fff;border-bottom:1px solid #ececea')}>
        <div style={css('max-width:1180px;margin:0 auto;padding:12px 22px;display:flex;flex-wrap:wrap;gap:12px;align-items:center')}>
          <div style={css('display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;flex:1 1 360px;min-width:0;padding:2px 0')}>
            {['all', ...typeList].map((ty) => (
              <button key={ty} type="button" onClick={() => { setType(ty); setLimit(PAGE_SIZE); }} style={css(`all:unset;cursor:pointer;white-space:nowrap;padding:8px 14px;border-radius:999px;font-size:14px;font-weight:700;background:${type === ty ? '#243C4B' : 'var(--surface-muted)'};color:${type === ty ? '#fff' : '#243C4B'};transition:background 160ms ease`)}>{ty === 'all' ? 'Semua jenis' : ty}</button>
            ))}
          </div>
          <div style={css('flex:0 1 320px;min-width:220px')}><Field placeholder="Cari judul atau nama peserta" value={q} onChange={(v) => { setQ(v); setLimit(PAGE_SIZE); }} /></div>
        </div>
      </div>
      <section style={css('padding:28px 22px clamp(72px,10vw,120px)')}>
        <div style={css('max-width:1180px;margin:0 auto')}>
          <div style={css('display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:24px')}>
            <span style={css('font-size:15px;font-weight:700')}>{filtered.length + ' karya ditemukan'}</span>
            {hasFilter && <Hv onClick={reset} s="all:unset;cursor:pointer;font-size:14px;font-weight:700;color:var(--plan-blue)" h="text-decoration:underline">Hapus semua filter ×</Hv>}
          </div>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px')}>
            {filtered.slice(0, limit).map((w) => <WorkCard key={w.id} w={card(w)} />)}
          </div>
          {filtered.length === 0 && (
            <div style={css('padding:72px 22px;border-radius:24px;background:var(--surface-muted);display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center')}>
              <span style={css('font-family:var(--font-headline);font-weight:700;font-size:24px')}>Belum ada karya yang cocok.</span>
              <span style={css('font-size:16px;color:var(--text-muted)')}>Coba kata kunci lain atau hapus filter.</span>
              <button type="button" onClick={reset} style={css('all:unset;cursor:pointer;padding:14px 28px;border-radius:999px;background:var(--dark-blue);color:#fff;font-weight:700;font-size:16px')}>Hapus filter</button>
            </div>
          )}
          {filtered.length > limit && (
            <div style={css('display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:56px')}>
              <Hv onClick={() => setLimit(limit + PAGE_SIZE)} s="all:unset;cursor:pointer;padding:14px 28px;border-radius:999px;background:var(--dark-blue);color:#fff;font-weight:700;font-size:16px" h="background:var(--plan-blue)">Tampilkan lebih banyak</Hv>
              <span style={css('font-size:13px;color:var(--text-muted)')}>{Math.min(limit, filtered.length) + ' dari ' + filtered.length + ' karya ditampilkan'}</span>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
